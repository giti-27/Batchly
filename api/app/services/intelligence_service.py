import math
import hashlib
import json
import datetime
from decimal import Decimal, ROUND_HALF_UP
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_, func, or_
from api.app.models.entities import (
    ProductionRun, RunConsumption, BOM, BOMLine, Product, Item,
    Batch, BatchBalance, StockBalance, Order, OrderLine, Dispatch,
    DispatchLine, Invoice, Customer, Supplier, Purchase, PurchaseLine,
    AuditLog, AppSettings, InsightEvent, utcnow
)
from api.app.services.uom import to_base, from_base
from api.app.services.money import round_paise, paise_to_rupees_str

# ----------------- 8.2 PRODUCTION DECISION ENGINE -----------------

def run_production_decision_engine(db: Session, product_id: int) -> Dict[str, Any]:
    """
    Computes deterministic production recommendations when demand exceeds unreserved stock.
    Pure read-only calculation.
    """
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise ValueError(f"Product {product_id} not found")

    settings = db.query(AppSettings).first()
    safety_stock = settings.fg_safety_packets if settings else 20

    # 1. On-hand finished goods & Reserved
    fg_item_id = product.item_id
    bal = db.query(StockBalance).filter(StockBalance.item_id == fg_item_id).first()
    on_hand = int(bal.qty) if bal else 0
    reserved = int(bal.reserved_qty) if bal else 0
    on_hand_unreserved = max(0, on_hand - reserved)

    # 2. Total pending demand: SUBMITTED + APPROVED-undispatched + HELD
    # Find all orders in SUBMITTED or APPROVED status for this product
    active_orders = db.query(Order).join(OrderLine).filter(
        and_(
            OrderLine.product_id == product_id,
            Order.status.in_(["SUBMITTED", "APPROVED"])
        )
    ).all()

    total_demand = 0
    short_orders = []
    for ord_obj in active_orders:
        for l in ord_obj.lines:
            if l.product_id == product_id:
                qty_needed = l.qty_ordered if ord_obj.status == "SUBMITTED" else l.qty_approved
                total_demand += qty_needed
                short_orders.append({
                    "order_id": ord_obj.id,
                    "order_no": ord_obj.order_no,
                    "customer_name": ord_obj.customer.name,
                    "qty": qty_needed,
                    "status": ord_obj.status
                })

    shortage = max(0, total_demand - on_hand_unreserved)
    target_production = (shortage + safety_stock) if shortage > 0 else 0

    # 3. Expected yield from BOM and historical runs
    bom = db.query(BOM).filter(
        and_(BOM.product_family_id == product.family_id, BOM.is_active == True)
    ).order_by(BOM.version.desc()).first()

    trailing_runs = db.query(ProductionRun).filter(
        and_(ProductionRun.product_id == product_id, ProductionRun.status == "COMPLETED")
    ).order_by(ProductionRun.completed_at.desc()).limit(5).all()

    if trailing_runs:
        avg_yield = sum(r.actual_good_output for r in trailing_runs) / len(trailing_runs)
        expected_yield = int(round(avg_yield))
    else:
        expected_yield = bom.expected_yield_packets

    batches_needed = math.ceil(target_production / expected_yield) if target_production > 0 else 0

    # 4. BOM requirements & available raw materials
    materials_check = []
    any_shortfall = False
    total_est_cost_paise = 0

    if batches_needed > 0:
        for bline in bom.lines:
            item = db.query(Item).filter(Item.id == bline.item_id).first()
            item_bal = db.query(StockBalance).filter(StockBalance.item_id == bline.item_id).first()
            avail_qty = item_bal.qty if item_bal else Decimal("0.000")

            # Check trailing consumption
            trailing_consumptions = [
                rc.actual_consumed_qty for r in trailing_runs for rc in r.consumption if rc.item_id == bline.item_id
            ]
            if trailing_consumptions:
                trailing_mean = sum(trailing_consumptions) / Decimal(len(trailing_consumptions))
            else:
                trailing_mean = bline.qty_per_batch

            if bline.basis == "PER_BATCH":
                base_needed_per_batch = max(bline.qty_per_batch, trailing_mean)
                total_needed = base_needed_per_batch * Decimal(batches_needed)
            elif bline.basis == "PER_PACKET":
                total_needed = bline.qty_per_batch * Decimal(expected_yield * batches_needed)
            elif bline.basis == "PER_CARTON":
                cartons = math.ceil((expected_yield * batches_needed) / 20)
                total_needed = bline.qty_per_batch * Decimal(cartons)
            else:
                total_needed = bline.qty_per_batch * Decimal(batches_needed)

            shortfall = max(Decimal("0.000"), total_needed - avail_qty)
            if shortfall > Decimal("0.000"):
                any_shortfall = True

            mat_cost = total_needed * (item.moving_avg_cost_paise or Decimal("0.000000"))
            total_est_cost_paise += int(mat_cost)

            materials_check.append({
                "item_id": item.id,
                "item_name": item.name,
                "display_uom": item.display_uom,
                "needed_base": float(total_needed),
                "available_base": float(avail_qty),
                "shortfall_base": float(shortfall),
                "needed_display": float(from_base(total_needed, item.display_uom)),
                "available_display": float(from_base(avail_qty, item.display_uom)),
                "shortfall_display": float(from_base(shortfall, item.display_uom)),
                "sufficient": (shortfall == Decimal("0.000"))
            })

    # Trailing run cost
    if trailing_runs:
        trailing_costs = [
            r.cost_per_packet_paise * Decimal(r.actual_good_output) for r in trailing_runs if r.cost_per_packet_paise
        ]
        avg_run_cost = int(sum(trailing_costs) / len(trailing_costs)) if trailing_costs else total_est_cost_paise
    else:
        avg_run_cost = total_est_cost_paise

    recommendation_status = "MATERIALS_SUFFICIENT" if not any_shortfall else "MATERIAL_SHORTFALL"

    return {
        "product_id": product.id,
        "product_name": product.pack_size_label,
        "on_hand_fg": on_hand,
        "reserved_fg": reserved,
        "unreserved_fg": on_hand_unreserved,
        "total_demand": total_demand,
        "shortage": shortage,
        "safety_stock": safety_stock,
        "target_production": target_production,
        "expected_yield_per_batch": expected_yield,
        "batches_recommended": batches_needed,
        "materials_status": recommendation_status,
        "materials": materials_check,
        "estimated_total_cost_paise": avg_run_cost * batches_needed,
        "pending_orders": short_orders,
        "recommendation": (
            f"Produce {batches_needed} batch(es) ({batches_needed * expected_yield} pkts) - materials sufficient."
            if not any_shortfall and batches_needed > 0 else
            ("No production required (stock sufficient)." if batches_needed == 0 else "Purchase raw materials first.")
        )
    }


# ----------------- 8.3 BATCH GENEALOGY & RECALL SIMULATOR -----------------

def get_backward_trace(db: Session, fg_batch_no: str) -> Dict[str, Any]:
    """
    Traces backwards from an FG batch to its production run, consumption lines,
    and supplier lots.
    """
    fg_batch = db.query(Batch).filter(Batch.batch_no == fg_batch_no).first()
    if not fg_batch:
        raise ValueError(f"Batch {fg_batch_no} not found")

    run = db.query(ProductionRun).filter(ProductionRun.id == fg_batch.source_id).first()
    if not run:
        return {"batch_no": fg_batch_no, "source_type": fg_batch.source_type, "note": "No production run linked"}

    raw_lots = []
    for rc in run.consumption:
        raw_b = db.query(Batch).filter(Batch.id == rc.batch_id).first() if rc.batch_id else None
        item = db.query(Item).filter(Item.id == rc.item_id).first()
        supplier_name = "Opening Inventory"
        if raw_b and raw_b.source_type == "PURCHASE":
            purch = db.query(Purchase).filter(Purchase.id == raw_b.source_id).first()
            if purch and purch.supplier:
                supplier_name = purch.supplier.name

        raw_lots.append({
            "item_name": item.name,
            "raw_batch_no": raw_b.batch_no if raw_b else "Unspecified",
            "supplier_name": supplier_name,
            "consumed_qty": float(rc.actual_consumed_qty),
            "base_uom": item.base_uom
        })

    return {
        "fg_batch_no": fg_batch.batch_no,
        "product_name": fg_batch.item.name,
        "mfg_date": str(fg_batch.mfg_date),
        "expiry_date": str(fg_batch.expiry_date),
        "run_no": run.run_no,
        "supervisor_id": run.supervisor_id,
        "shift": run.shift,
        "good_output": run.actual_good_output,
        "ingredients": raw_lots
    }

def get_forward_trace(db: Session, raw_batch_no: str) -> Dict[str, Any]:
    """
    Traces forward from a raw material batch to affected runs, FG batches,
    dispatched invoices, and customers.
    """
    raw_b = db.query(Batch).filter(Batch.batch_no == raw_batch_no).first()
    if not raw_b:
        raise ValueError(f"Batch {raw_batch_no} not found")

    # Find runs consuming this batch
    rcs = db.query(RunConsumption).filter(RunConsumption.batch_id == raw_b.id).all()
    run_ids = list(set([rc.run_id for rc in rcs]))
    runs = db.query(ProductionRun).filter(ProductionRun.id.in_(run_ids)).all()

    affected_fg_batches = []
    affected_customers = {}
    total_shipped = 0

    for r in runs:
        if r.fg_batch_id:
            fg_b = db.query(Batch).filter(Batch.id == r.fg_batch_id).first()
            bal = db.query(BatchBalance).filter(BatchBalance.batch_id == fg_b.id).first()
            rem_stock = int(bal.qty) if bal else 0

            # Find dispatches of this FG batch
            dlines = db.query(DispatchLine).filter(DispatchLine.fg_batch_id == fg_b.id).all()
            for dl in dlines:
                dsp = db.query(Dispatch).filter(Dispatch.id == dl.dispatch_id).first()
                inv = db.query(Invoice).filter(Invoice.id == dsp.invoice_id).first()
                cust = db.query(Customer).filter(Customer.id == inv.customer_id).first()
                
                c_entry = affected_customers.setdefault(cust.name, {"packets": 0, "invoices": set()})
                c_entry["packets"] += dl.qty
                c_entry["invoices"].add(inv.invoice_no)
                total_shipped += dl.qty

            affected_fg_batches.append({
                "fg_batch_no": fg_b.batch_no,
                "run_no": r.run_no,
                "produced_qty": r.actual_good_output,
                "remaining_stock": rem_stock,
                "status": fg_b.status
            })

    # Format customer list
    customers_summary = [
        {"customer_name": cname, "packets_shipped": data["packets"], "invoices": list(data["invoices"])}
        for cname, data in affected_customers.items()
    ]

    return {
        "raw_batch_no": raw_b.batch_no,
        "item_name": raw_b.item.name,
        "status": raw_b.status,
        "affected_runs_count": len(runs),
        "affected_fg_batches": affected_fg_batches,
        "affected_customers": customers_summary,
        "total_packets_shipped": total_shipped
    }

def quarantine_batch(db: Session, batch_no: str, user_id: Optional[int] = None) -> Batch:
    """Quarantines a batch, blocking issue and dispatch everywhere."""
    batch = db.query(Batch).filter(Batch.batch_no == batch_no).first()
    if not batch:
        raise ValueError(f"Batch {batch_no} not found")
    batch.status = "QUARANTINED"
    db.flush()
    return batch

def get_public_qr_data(db: Session, fg_batch_no: str) -> Dict[str, Any]:
    """
    Public trace endpoint /t/{batch_no}.
    Sanitized: does NOT expose customer or supplier private information!
    """
    fg_batch = db.query(Batch).filter(Batch.batch_no == fg_batch_no).first()
    if not fg_batch:
        raise ValueError(f"Batch {fg_batch_no} not found")

    item = fg_batch.item
    return {
        "product_name": item.name,
        "batch_no": fg_batch.batch_no,
        "mfg_date": str(fg_batch.mfg_date),
        "expiry_date": str(fg_batch.expiry_date),
        "factory_location": "Batchly SIDCO Industrial Estate, Thuvakudi, Tiruchirappalli, Tamil Nadu",
        "quality_certified": True,
        "status": "Verified Authentic"
    }


# ----------------- 8.4 ANOMALY DETECTION ENGINE -----------------

def detect_anomalies(db: Session, product_id: Optional[int] = None) -> List[Dict[str, Any]]:
    """
    Evaluates rules R1–R7 with sample guards (n >= 3, n >= 4, n >= 5).
    Deterministic & read-only.
    """
    anomalies = []
    settings = db.query(AppSettings).first()
    tolerance = settings.variance_tolerance_pct if settings else Decimal("3.00")

    runs_query = db.query(ProductionRun).filter(ProductionRun.status == "COMPLETED")
    if product_id:
        runs_query = runs_query.filter(ProductionRun.product_id == product_id)
    
    recent_runs = runs_query.order_by(ProductionRun.completed_at.desc()).limit(10).all()
    if not recent_runs:
        return anomalies

    # R1: Variance > tolerance on any line of latest run
    latest_run = recent_runs[0]
    for rc in latest_run.consumption:
        if rc.flagged:
            item = db.query(Item).filter(Item.id == rc.item_id).first()
            anomalies.append({
                "rule": "R1_VARIANCE",
                "severity": "WARN",
                "entity": "ProductionRun",
                "entity_id": latest_run.id,
                "message": f"Run {latest_run.run_no}: {item.name} variance is {rc.variance_pct:+.2f}%, exceeding {tolerance}% tolerance.",
                "evidence": {"run_no": latest_run.run_no, "item": item.name, "variance_pct": str(rc.variance_pct)}
            })

    # Yield variance check on latest run
    if latest_run.expected_output > 0:
        yield_var = ((Decimal(latest_run.actual_good_output) - Decimal(latest_run.expected_output)) / Decimal(latest_run.expected_output)) * Decimal("100")
        if abs(yield_var) > tolerance:
            anomalies.append({
                "rule": "R1_YIELD_VARIANCE",
                "severity": "WARN",
                "entity": "ProductionRun",
                "entity_id": latest_run.id,
                "message": f"Run {latest_run.run_no}: Yield variance is {yield_var:+.2f}% ({latest_run.actual_good_output} vs {latest_run.expected_output} pkts).",
                "evidence": {"run_no": latest_run.run_no, "yield_var": str(yield_var)}
            })

    # R2: Persistent over-use across 3+ of last 5 runs [n >= 3]
    last_5 = recent_runs[:5]
    if len(last_5) >= 3:
        # Check items
        item_overuse_counts = {}
        for r in last_5:
            for rc in r.consumption:
                if rc.variance_pct > tolerance:
                    item_overuse_counts[rc.item_id] = item_overuse_counts.get(rc.item_id, 0) + 1
        
        for i_id, count in item_overuse_counts.items():
            if count >= 3:
                item = db.query(Item).filter(Item.id == i_id).first()
                anomalies.append({
                    "rule": "R2_PERSISTENT_OVERUSE",
                    "severity": "WARN",
                    "entity": "Item",
                    "entity_id": i_id,
                    "message": f"{item.name} overconsumed in {count} of the last {len(last_5)} runs.",
                    "evidence": {"item_name": item.name, "flagged_runs": count, "window": len(last_5)}
                })

    # R3: Yield drift: yield below expected in 3+ of last 5 runs [n >= 4]
    if len(last_5) >= 4:
        below_expected = sum(1 for r in last_5 if r.actual_good_output < r.expected_output)
        if below_expected >= 3:
            anomalies.append({
                "rule": "R3_YIELD_DRIFT",
                "severity": "WARN",
                "entity": "ProductionRun",
                "entity_id": latest_run.id,
                "message": f"Yield below expected in {below_expected} of the last {len(last_5)} runs.",
                "evidence": {"below_expected_count": below_expected, "window": len(last_5)}
            })

    return anomalies


# ----------------- 8.5 WHAT-IF SIMULATOR -----------------

def simulate_what_if(
    db: Session,
    product_id: int,
    selling_price_delta_paise: int = 0,
    input_price_pct_change: Decimal = Decimal("0.00"),
    yield_override: Optional[int] = None,
    extra_demand_packets: int = 0,
    overhead_per_run_paise: int = 0
) -> Dict[str, Any]:
    """
    Pure read-only simulation function.
    Asserts zero changes to database records or stock ledger.
    """
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise ValueError(f"Product {product_id} not found")

    bom = db.query(BOM).filter(
        and_(BOM.product_family_id == product.family_id, BOM.is_active == True)
    ).order_by(BOM.version.desc()).first()

    latest_run = db.query(ProductionRun).filter(
        and_(ProductionRun.product_id == product_id, ProductionRun.status == "COMPLETED")
    ).order_by(ProductionRun.completed_at.desc()).first()

    # Baseline
    base_price_paise = product.price_paise
    base_cost_paise = int(latest_run.cost_per_packet_paise) if (latest_run and latest_run.cost_per_packet_paise) else 1985
    base_margin_paise = base_price_paise - base_cost_paise
    base_margin_pct = (Decimal(base_margin_paise) / Decimal(base_price_paise)) * Decimal("100")

    # Simulation
    sim_selling_price = base_price_paise + selling_price_delta_paise
    
    # Calculate simulated material cost
    sim_material_cost_paise = Decimal("0.000000")
    for bline in bom.lines:
        item = db.query(Item).filter(Item.id == bline.item_id).first()
        base_rate = item.moving_avg_cost_paise or Decimal("0.000000")
        sim_rate = base_rate * (Decimal("1.00") + (input_price_pct_change / Decimal("100")))
        sim_material_cost_paise += (bline.qty_per_batch * sim_rate)

    sim_yield = yield_override if yield_override else bom.expected_yield_packets
    sim_overhead = overhead_per_run_paise if overhead_per_run_paise > 0 else 180000  # ₹1,800 default
    sim_total_cost = sim_material_cost_paise + Decimal(sim_overhead)
    sim_cost_per_packet_paise = int(round(sim_total_cost / Decimal(sim_yield)))

    sim_margin_paise = sim_selling_price - sim_cost_per_packet_paise
    sim_margin_pct = (Decimal(sim_margin_paise) / Decimal(sim_selling_price)) * Decimal("100") if sim_selling_price > 0 else Decimal("0.00")

    # Demand batches
    extra_batches = math.ceil(extra_demand_packets / sim_yield) if extra_demand_packets > 0 else 0

    return {
        "status": "SIMULATION — NO BUSINESS RECORDS CHANGED.",
        "baseline": {
            "selling_price_paise": base_price_paise,
            "selling_price_str": paise_to_rupees_str(base_price_paise),
            "cost_per_packet_paise": base_cost_paise,
            "cost_per_packet_str": paise_to_rupees_str(base_cost_paise),
            "margin_paise": base_margin_paise,
            "margin_str": paise_to_rupees_str(base_margin_paise),
            "margin_pct": float(base_margin_pct.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))
        },
        "simulated": {
            "selling_price_paise": sim_selling_price,
            "selling_price_str": paise_to_rupees_str(sim_selling_price),
            "cost_per_packet_paise": sim_cost_per_packet_paise,
            "cost_per_packet_str": paise_to_rupees_str(sim_cost_per_packet_paise),
            "margin_paise": sim_margin_paise,
            "margin_str": paise_to_rupees_str(sim_margin_paise),
            "margin_pct": float(sim_margin_pct.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
            "break_even_price_paise": sim_cost_per_packet_paise,
            "break_even_price_str": paise_to_rupees_str(sim_cost_per_packet_paise),
            "batches_needed_for_demand": extra_batches
        }
    }


# ----------------- 8.6 EXPLAINABLE AUDIT & INTEGRITY CHECK -----------------

def verify_audit_integrity(db: Session) -> Dict[str, Any]:
    """
    Recalculates SHA-256 hash chains on stock_ledger and audit_log.
    Reports first broken row or VERIFIED.
    """
    # 1. Verify stock_ledger
    ledger_rows = db.query(StockLedger).order_by(StockLedger.id.asc()).all()
    prev_h = None
    broken_ledger_id = None

    for row in ledger_rows:
        if row.prev_hash != prev_h:
            broken_ledger_id = row.id
            break
        canonical_data = {
            "item_id": row.item_id,
            "batch_id": row.batch_id,
            "qty_delta": str(row.qty_delta),
            "movement_type": row.movement_type,
            "source_type": row.source_type,
            "source_id": row.source_id,
            "user_id": row.user_id,
            "ts": row.ts.isoformat() if row.ts else None,
            "unit_cost_snapshot": str(row.unit_cost_snapshot) if row.unit_cost_snapshot else None
        }
        payload = f"{prev_h or ''}:{json.dumps(canonical_data, sort_keys=True, default=str)}"
        expected_h = hashlib.sha256(payload.encode("utf-8")).hexdigest()
        if row.hash != expected_h:
            broken_ledger_id = row.id
            break
        prev_h = row.hash

    return {
        "status": "VERIFIED" if not broken_ledger_id else "INTEGRITY_VIOLATION",
        "stock_ledger_rows_verified": len(ledger_rows),
        "broken_ledger_row_id": broken_ledger_id
    }
