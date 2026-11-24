import datetime
from decimal import Decimal, ROUND_HALF_UP
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import select, and_
from api.app.models.entities import (
    ProductionRun, RunConsumption, RunOverhead, BOM, BOMLine,
    Product, Item, Batch, BatchBalance, StockBalance, AppSettings, utcnow
)
from api.app.services.ledger_service import post_movement
from api.app.services.money import round_paise

def get_material_availability(db: Session, bom: BOM, batch_multiplier: Decimal) -> List[Dict[str, Any]]:
    """Checks current on-hand stock for all BOM lines against required quantities."""
    results = []
    for line in bom.lines:
        item = db.query(Item).filter(Item.id == line.item_id).first()
        bal = db.query(StockBalance).filter(StockBalance.item_id == line.item_id).first()
        available_qty = bal.qty if bal else Decimal("0.000")
        
        # calculate planned
        if line.basis == "PER_BATCH":
            planned = line.qty_per_batch * batch_multiplier
        elif line.basis == "PER_PACKET":
            expected_pkts = bom.expected_yield_packets * batch_multiplier
            planned = line.qty_per_batch * expected_pkts
        elif line.basis == "PER_CARTON":
            expected_pkts = bom.expected_yield_packets * batch_multiplier
            # 1 carton = 20 packets (Murukku standard)
            cartons = (expected_pkts / Decimal("20")).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
            planned = line.qty_per_batch * cartons
        else:
            planned = line.qty_per_batch * batch_multiplier

        shortfall = max(Decimal("0.000"), planned - available_qty)
        results.append({
            "item_id": item.id,
            "item_name": item.name,
            "line_type": line.line_type,
            "planned_qty": planned,
            "available_qty": available_qty,
            "shortfall": shortfall,
            "sufficient": (shortfall == Decimal("0.000"))
        })
    return results

def create_planned_run(
    db: Session,
    product_id: int,
    batch_multiplier: Decimal = Decimal("1.00"),
    supervisor_id: Optional[int] = None,
    shift: str = "Day"
) -> ProductionRun:
    """Creates a PLANNED production run, snapshotting the active BOM."""
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise ValueError(f"Product {product_id} not found")

    bom = db.query(BOM).filter(
        and_(BOM.product_family_id == product.family_id, BOM.is_active == True)
    ).order_by(BOM.version.desc()).first()
    if not bom:
        raise ValueError(f"Active BOM not found for product family {product.family_id}")

    # Compute expected output based on pack size:
    # yield = batch_output_g / pack_size_g * batch_multiplier
    expected_packets = int((bom.batch_output_g / product.pack_size_g) * batch_multiplier)
    
    today_str = datetime.date.today().strftime("%y%m%d")
    count_today = db.query(ProductionRun).count() + 1
    run_no = f"RUN-{today_str}-{count_today:03d}"

    run = ProductionRun(
        run_no=run_no,
        product_id=product_id,
        bom_id=bom.id,
        batch_multiplier=batch_multiplier,
        expected_output=expected_packets,
        actual_good_output=0,
        status="PLANNED",
        supervisor_id=supervisor_id,
        shift=shift
    )
    db.add(run)
    db.flush()

    # Pre-populate planned consumption lines
    for line in bom.lines:
        if line.basis == "PER_BATCH":
            planned = line.qty_per_batch * batch_multiplier
        elif line.basis == "PER_PACKET":
            planned = line.qty_per_batch * Decimal(expected_packets)
        elif line.basis == "PER_CARTON":
            cartons = (Decimal(expected_packets) / Decimal("20")).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
            planned = line.qty_per_batch * cartons
        else:
            planned = line.qty_per_batch * batch_multiplier

        rc = RunConsumption(
            run_id=run.id,
            item_id=line.item_id,
            planned_qty=planned,
            issued_qty=Decimal("0.000"),
            damaged_qty=Decimal("0.000"),
            returned_qty=Decimal("0.000"),
            actual_consumed_qty=Decimal("0.000"),
            variance_pct=Decimal("0.0000"),
            flagged=False
        )
        db.add(rc)
    
    db.flush()
    return run

def start_and_issue_run(
    db: Session,
    run_id: int,
    raw_issues: List[Dict[str, Any]],
    user_id: Optional[int] = None
) -> ProductionRun:
    """
    Transitions PLANNED -> IN_PROGRESS.
    Issues raw materials using FEFO allocation if batch is not explicitly specified.
    Appends ledger ISSUE -qty.
    """
    run = db.query(ProductionRun).filter(ProductionRun.id == run_id).first()
    if not run:
        raise ValueError(f"Run {run_id} not found")
    if run.status != "PLANNED":
        raise ValueError(f"Run {run_id} is in status '{run.status}', expected 'PLANNED'")

    run.status = "IN_PROGRESS"
    run.started_at = utcnow()

    # Process issues
    for issue in raw_issues:
        item_id = issue["item_id"]
        qty_to_issue = Decimal(str(issue["issued_qty"]))
        explicit_batch_id = issue.get("batch_id")
        
        item = db.query(Item).filter(Item.id == item_id).first()
        if not item:
            raise ValueError(f"Item {item_id} not found")

        # FEFO allocation
        remaining = qty_to_issue
        if explicit_batch_id:
            candidate_batches = db.query(BatchBalance).join(Batch).filter(
                and_(BatchBalance.item_id == item_id, BatchBalance.batch_id == explicit_batch_id, BatchBalance.qty > 0)
            ).all()
        else:
            candidate_batches = db.query(BatchBalance).join(Batch).filter(
                and_(BatchBalance.item_id == item_id, BatchBalance.qty > 0, Batch.status == "ACTIVE")
            ).order_by(Batch.expiry_date.asc(), Batch.mfg_date.asc()).all()

        if not candidate_batches:
            raise ValueError(f"No available active stock for item {item.name}")

        for bbal in candidate_batches:
            if remaining <= Decimal("0.000"):
                break
            take_qty = min(remaining, bbal.qty)
            
            # Post ISSUE to ledger
            post_movement(
                db=db,
                item_id=item_id,
                batch_id=bbal.batch_id,
                qty_delta=-take_qty,
                movement_type="ISSUE",
                source_type="PRODUCTION",
                source_id=run.id,
                user_id=user_id,
                unit_cost_snapshot=item.moving_avg_cost_paise,
                note=f"Material issue for Run {run.run_no}"
            )

            # Update or create run consumption record
            rc = db.query(RunConsumption).filter(
                and_(RunConsumption.run_id == run.id, RunConsumption.item_id == item_id)
            ).first()
            if rc:
                rc.issued_qty += take_qty
                if not rc.batch_id:
                    rc.batch_id = bbal.batch_id
            remaining -= take_qty

        if remaining > Decimal("0.000"):
            raise ValueError(f"Insufficient stock to issue full quantity for item {item.name}: short by {remaining}")

    db.flush()
    return run

def complete_production_run(
    db: Session,
    run_id: int,
    actual_good_output: int,
    pack_consumptions: List[Dict[str, Any]],
    overheads: List[Dict[str, Any]],
    user_id: Optional[int] = None
) -> ProductionRun:
    """
    Transitions IN_PROGRESS -> COMPLETED:
    1. Consumes packaging (ISSUE for good, SCRAP for damaged).
    2. Receives Finished Goods (PRODUCTION_IN) into a new Batch.
    3. Calculates variance and flags lines where abs(variance_pct) > tolerance.
    4. Computes run cost and cost_per_packet.
    """
    run = db.query(ProductionRun).filter(ProductionRun.id == run_id).first()
    if not run:
        raise ValueError(f"Run {run_id} not found")
    if run.status != "IN_PROGRESS":
        raise ValueError(f"Cannot complete run {run_id}: status is {run.status}")

    product = db.query(Product).filter(Product.id == run.product_id).first()
    settings = db.query(AppSettings).first()
    tolerance = settings.variance_tolerance_pct if settings else Decimal("3.00")

    # 1. Process packaging lines
    total_material_cost_paise = Decimal("0.000000")

    # Add cost of raw materials previously issued
    for rc in run.consumption:
        item = db.query(Item).filter(Item.id == rc.item_id).first()
        if item.type == "RAW":
            rc.actual_consumed_qty = rc.issued_qty - rc.returned_qty
            # Material cost = actual_consumed * moving_avg_cost_paise at issue
            line_cost = rc.actual_consumed_qty * item.moving_avg_cost_paise
            total_material_cost_paise += line_cost
            
            # Variance calculation
            if rc.planned_qty > Decimal("0.000"):
                rc.variance_pct = ((rc.actual_consumed_qty - rc.planned_qty) / rc.planned_qty) * Decimal("100")
                # Rule: abs(variance_pct) > tolerance (STRICTLY GREATER)
                rc.flagged = abs(rc.variance_pct) > tolerance
            else:
                rc.variance_pct = Decimal("0.0000")
                rc.flagged = False

    # Process PACK materials
    for p_entry in pack_consumptions:
        item_id = p_entry["item_id"]
        used_qty = Decimal(str(p_entry["used_qty"]))
        damaged_qty = Decimal(str(p_entry.get("damaged_qty", "0")))
        item = db.query(Item).filter(Item.id == item_id).first()

        # FEFO for pack materials
        total_needed = used_qty + damaged_qty
        remaining = total_needed
        candidate_batches = db.query(BatchBalance).join(Batch).filter(
            and_(BatchBalance.item_id == item_id, BatchBalance.qty > 0, Batch.status == "ACTIVE")
        ).order_by(Batch.expiry_date.asc(), Batch.mfg_date.asc()).all()

        for bbal in candidate_batches:
            if remaining <= Decimal("0.000"):
                break
            take_qty = min(remaining, bbal.qty)
            
            # Allocate used vs damaged
            qty_good = min(take_qty, used_qty)
            qty_scrap = take_qty - qty_good

            if qty_good > Decimal("0.000"):
                post_movement(
                    db=db,
                    item_id=item_id,
                    batch_id=bbal.batch_id,
                    qty_delta=-qty_good,
                    movement_type="ISSUE",
                    source_type="PRODUCTION",
                    source_id=run.id,
                    user_id=user_id,
                    unit_cost_snapshot=item.moving_avg_cost_paise,
                    note=f"Packaging used in Run {run.run_no}"
                )
            if qty_scrap > Decimal("0.000"):
                post_movement(
                    db=db,
                    item_id=item_id,
                    batch_id=bbal.batch_id,
                    qty_delta=-qty_scrap,
                    movement_type="SCRAP",
                    source_type="PRODUCTION",
                    source_id=run.id,
                    user_id=user_id,
                    unit_cost_snapshot=item.moving_avg_cost_paise,
                    note=f"Packaging damaged in Run {run.run_no}"
                )
            remaining -= take_qty

        # Cost for pack line (damaged packaging is absorbed into good output cost)
        total_pack_consumed = used_qty + damaged_qty
        pack_cost = total_pack_consumed * item.moving_avg_cost_paise
        total_material_cost_paise += pack_cost

        # Update RunConsumption
        rc = db.query(RunConsumption).filter(
            and_(RunConsumption.run_id == run.id, RunConsumption.item_id == item_id)
        ).first()
        if not rc:
            rc = RunConsumption(run_id=run.id, item_id=item_id, planned_qty=used_qty)
            db.add(rc)

        rc.issued_qty = used_qty
        rc.damaged_qty = damaged_qty
        rc.actual_consumed_qty = total_pack_consumed
        if rc.planned_qty > Decimal("0.000"):
            rc.variance_pct = ((rc.actual_consumed_qty - rc.planned_qty) / rc.planned_qty) * Decimal("100")
            # Strict inequality for tolerance
            rc.flagged = abs(rc.variance_pct) > tolerance
        else:
            rc.variance_pct = Decimal("0.0000")
            rc.flagged = False

    # 2. Add Run Overheads
    total_overhead_paise = 0
    for ovh in overheads:
        amt = int(ovh["amount_paise"])
        total_overhead_paise += amt
        ro = RunOverhead(
            run_id=run.id,
            type=ovh["type"],
            amount_paise=amt
        )
        db.add(ro)

    # 3. Create Finished Goods Batch and post PRODUCTION_IN
    run.actual_good_output = actual_good_output
    run.completed_at = utcnow()
    run.status = "COMPLETED"

    fg_item = db.query(Item).filter(Item.id == product.item_id).first()
    today_dt = datetime.date.today()
    fg_batch_no = f"MUR200-{today_dt.strftime('%y%m%d')}-{run.id:02d}"
    
    # 4. Cost calculation: Cost Per Packet = (material_cost + overheads) / actual_good_packets
    total_run_cost_paise = total_material_cost_paise + Decimal(total_overhead_paise)
    if actual_good_output > 0:
        cost_per_packet = total_run_cost_paise / Decimal(actual_good_output)
    else:
        cost_per_packet = Decimal("0.000000")
    
    run.cost_per_packet_paise = cost_per_packet

    if actual_good_output > 0:
        fg_batch = Batch(
            batch_no=fg_batch_no,
            item_id=fg_item.id,
            source_type="PRODUCTION",
            source_id=run.id,
            mfg_date=today_dt,
            expiry_date=today_dt + datetime.timedelta(days=fg_item.shelf_life_days),
            status="ACTIVE",
            unit_cost_paise=cost_per_packet
        )
        db.add(fg_batch)
        db.flush()
        run.fg_batch_id = fg_batch.id

        # Update FG moving average cost
        bal = db.query(StockBalance).filter(StockBalance.item_id == fg_item.id).first()
        current_fg_qty = bal.qty if bal else Decimal("0.000")
        current_fg_avg = fg_item.moving_avg_cost_paise or Decimal("0.000000")
        total_fg_qty = current_fg_qty + Decimal(actual_good_output)
        if total_fg_qty > Decimal("0.000"):
            fg_item.moving_avg_cost_paise = (
                (current_fg_qty * current_fg_avg) + (Decimal(actual_good_output) * cost_per_packet)
            ) / total_fg_qty

        # Post PRODUCTION_IN
        post_movement(
            db=db,
            item_id=fg_item.id,
            batch_id=fg_batch.id,
            qty_delta=Decimal(actual_good_output),
            movement_type="PRODUCTION_IN",
            source_type="PRODUCTION",
            source_id=run.id,
            user_id=user_id,
            unit_cost_snapshot=cost_per_packet,
            note=f"Finished goods from Run {run.run_no}"
        )

    db.flush()
    return run
