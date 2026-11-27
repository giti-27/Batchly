from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional
from decimal import Decimal
from sqlalchemy.orm import Session
from api.app.db import get_db
from api.app.models.entities import StockBalance, BatchBalance, StockLedger, Item, User
from api.app.services.auth_service import require_role
from api.app.services.ledger_service import post_movement, reconcile_balances
from api.app.services.uom import from_base

router = APIRouter(prefix="/stock", tags=["Stock"])

@router.get("/summary")
def get_stock_summary(db: Session = Depends(get_db), user: User = Depends(require_role(["ADMIN", "PRODUCTION", "AUDITOR", "OWNER"]))):
    balances = db.query(StockBalance).all()
    results = []
    for b in balances:
        item = db.query(Item).filter(Item.id == b.item_id).first()
        results.append({
            "item_id": b.item_id,
            "item_name": item.name,
            "type": item.type,
            "display_uom": item.display_uom,
            "qty_base": float(b.qty),  # canonical internal quantity (g, ml, pcs, packet)
            "reserved_qty": float(b.reserved_qty),
            "available_qty": float(b.qty - b.reserved_qty),
            # Human-facing quantities use the item's configured display unit.
            "qty_display": float(from_base(b.qty, item.display_uom)),
            "reserved_qty_display": float(from_base(b.reserved_qty, item.display_uom)),
            "available_qty_display": float(from_base(b.qty - b.reserved_qty, item.display_uom)),
            "base_uom": item.base_uom,
            "moving_avg_cost_paise": float(item.moving_avg_cost_paise)
        })
    return results

@router.get("/ledger")
def get_stock_ledger(
    item_id: Optional[int] = None,
    limit: int = 100,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(["ADMIN", "PRODUCTION", "AUDITOR", "OWNER"]))
):
    query = db.query(StockLedger).order_by(StockLedger.id.desc())
    if item_id:
        query = query.filter(StockLedger.item_id == item_id)
    rows = query.limit(limit).all()
    
    results = []
    for r in rows:
        item = db.query(Item).filter(Item.id == r.item_id).first()
        results.append({
            "id": r.id,
            "item_id": r.item_id,
            "item_name": item.name if item else "Unknown",
            "batch_id": r.batch_id,
            "qty_delta": float(r.qty_delta),
            "movement_type": r.movement_type,
            "source_type": r.source_type,
            "source_id": r.source_id,
            "unit_cost_snapshot": float(r.unit_cost_snapshot) if r.unit_cost_snapshot else None,
            "ts": str(r.ts),
            "hash": r.hash
        })
    return results

@router.get("/reconcile")
def run_stock_reconciliation(db: Session = Depends(get_db), user: User = Depends(require_role(["ADMIN", "AUDITOR", "OWNER"]))):
    return reconcile_balances(db)
