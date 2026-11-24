import datetime
from decimal import Decimal
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from api.app.models.entities import (
    Purchase, PurchaseLine, Batch, Item, StockBalance, utcnow
)
from api.app.services.ledger_service import post_movement
from api.app.services.uom import to_base
from api.app.services.money import round_paise

def post_purchase(
    db: Session,
    purchase_id: int,
    user_id: Optional[int] = None
) -> Purchase:
    """
    Posts a purchase:
    1. Creates Batch rows.
    2. Creates PURCHASE ledger rows.
    3. Updates Item perpetual moving weighted-average cost.
    4. Updates transactional caches and audit log.
    Enforces Invariants I1, I2, I3, I4, I8.
    """
    purchase = db.query(Purchase).filter(Purchase.id == purchase_id).first()
    if not purchase:
        raise ValueError(f"Purchase {purchase_id} not found")
    if purchase.status == "POSTED":
        raise ValueError("Cannot edit or re-post an already POSTED purchase (Invariant I8)")

    for line in purchase.lines:
        item = db.query(Item).filter(Item.id == line.item_id).first()
        if not item:
            raise ValueError(f"Item {line.item_id} not found")

        # 1. Create Batch row
        batch_no = f"PUR-{item.name[:4].upper()}-{purchase.purchase_no}-{line.id}"
        batch = Batch(
            batch_no=batch_no,
            item_id=item.id,
            source_type="PURCHASE",
            source_id=purchase.id,
            mfg_date=purchase.date,
            expiry_date=line.expiry_date or (purchase.date + datetime.timedelta(days=item.shelf_life_days)),
            status="ACTIVE",
            unit_cost_paise=line.rate_paise_per_base
        )
        db.add(batch)
        db.flush()
        line.batch_id = batch.id

        # 2. Get current stock qty from StockBalance
        bal = db.query(StockBalance).filter(StockBalance.item_id == item.id).first()
        current_qty = bal.qty if bal else Decimal("0.000")
        current_avg = item.moving_avg_cost_paise or Decimal("0.000000")

        # 3. Calculate new moving weighted average cost:
        # new_avg = (current_qty * current_avg + line_qty * rate) / (current_qty + line_qty)
        total_new_qty = current_qty + line.qty
        if total_new_qty > Decimal("0.000"):
            total_cost_paise = (current_qty * current_avg) + (line.qty * line.rate_paise_per_base)
            new_moving_avg = total_cost_paise / total_new_qty
            item.moving_avg_cost_paise = new_moving_avg

        # 4. Post Ledger movement (+qty)
        post_movement(
            db=db,
            item_id=item.id,
            batch_id=batch.id,
            qty_delta=line.qty,
            movement_type="PURCHASE",
            source_type="PURCHASE",
            source_id=purchase.id,
            user_id=user_id,
            unit_cost_snapshot=line.rate_paise_per_base,
            note=f"Purchase {purchase.purchase_no} line {line.id}"
        )

    purchase.status = "POSTED"
    db.flush()
    return purchase
