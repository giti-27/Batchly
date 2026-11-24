import hashlib
import json
from decimal import Decimal
from typing import Optional, List, Dict, Any, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import select, func, text, and_
from api.app.models.entities import (
    StockLedger, StockBalance, BatchBalance, Item, Batch, utcnow
)

class InsufficientStockError(Exception):
    """Raised when an operation would cause stock to go below zero."""
    pass

class NegativeStockError(Exception):
    """Raised when quantity is negative or invalid."""
    pass

def compute_row_hash(prev_hash: Optional[str], canonical_data: Dict[str, Any]) -> str:
    """Computes SHA-256 hash chaining for tamper evidence."""
    payload = f"{prev_hash or ''}:{json.dumps(canonical_data, sort_keys=True, default=str)}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()

def init_db_triggers(session: Session):
    """
    Creates append-only trigger on stock_ledger preventing UPDATE and DELETE.
    Works on PostgreSQL and SQLite.
    """
    bind = session.get_bind()
    dialect = bind.dialect.name
    
    if dialect == "sqlite":
        # SQLite triggers
        session.execute(text("""
            CREATE TRIGGER IF NOT EXISTS trg_prevent_stock_ledger_update
            BEFORE UPDATE ON stock_ledger
            BEGIN
                SELECT RAISE(ABORT, 'Invariant I1 Violation: stock_ledger is append-only. UPDATE not permitted.');
            END;
        """))
        session.execute(text("""
            CREATE TRIGGER IF NOT EXISTS trg_prevent_stock_ledger_delete
            BEFORE DELETE ON stock_ledger
            BEGIN
                SELECT RAISE(ABORT, 'Invariant I1 Violation: stock_ledger is append-only. DELETE not permitted.');
            END;
        """))
    elif dialect == "postgresql":
        session.execute(text("""
            CREATE OR REPLACE FUNCTION fn_prevent_stock_ledger_mutation()
            RETURNS TRIGGER AS $$
            BEGIN
                RAISE EXCEPTION 'Invariant I1 Violation: stock_ledger is append-only. UPDATE/DELETE not permitted.';
            END;
            $$ LANGUAGE plpgsql;
        """))
        session.execute(text("""
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_prevent_stock_ledger_mutation'
                ) THEN
                    CREATE TRIGGER trg_prevent_stock_ledger_mutation
                    BEFORE UPDATE OR DELETE ON stock_ledger
                    FOR EACH ROW EXECUTE FUNCTION fn_prevent_stock_ledger_mutation();
                END IF;
            END $$;
        """))
    session.commit()

def post_movement(
    db: Session,
    item_id: int,
    batch_id: Optional[int],
    qty_delta: Decimal,
    movement_type: str,
    source_type: str,
    source_id: Optional[int],
    user_id: Optional[int],
    unit_cost_snapshot: Optional[Decimal] = None,
    note: Optional[str] = None
) -> StockLedger:
    """
    Appends a stock ledger movement, updates cached stock_balance and batch_balance.
    Enforces Invariants I1, I2, I3, I7, I13.
    """
    if qty_delta == 0:
        return None
    
    # Invariant I13: Row lock cache records in fixed lock order (by item_id)
    bind = db.get_bind()
    is_postgres = (bind.dialect.name == "postgresql")
    
    # 1. Lock / Retrieve StockBalance
    if is_postgres:
        stmt = select(StockBalance).where(StockBalance.item_id == item_id).with_for_update()
        balance_row = db.execute(stmt).scalars().first()
    else:
        balance_row = db.query(StockBalance).filter(StockBalance.item_id == item_id).first()

    if not balance_row:
        balance_row = StockBalance(item_id=item_id, qty=Decimal("0.000"), reserved_qty=Decimal("0.000"))
        db.add(balance_row)
        db.flush()

    new_stock_qty = balance_row.qty + qty_delta
    if new_stock_qty < 0:
        raise InsufficientStockError(
            f"Insufficient stock for item_id {item_id}: available {balance_row.qty}, requested delta {qty_delta}"
        )
    balance_row.qty = new_stock_qty

    # 2. Lock / Retrieve BatchBalance if batch_id is provided
    if batch_id:
        if is_postgres:
            b_stmt = select(BatchBalance).where(
                and_(BatchBalance.item_id == item_id, BatchBalance.batch_id == batch_id)
            ).with_for_update()
            batch_bal_row = db.execute(b_stmt).scalars().first()
        else:
            batch_bal_row = db.query(BatchBalance).filter(
                and_(BatchBalance.item_id == item_id, BatchBalance.batch_id == batch_id)
            ).first()

        if not batch_bal_row:
            batch_bal_row = BatchBalance(item_id=item_id, batch_id=batch_id, qty=Decimal("0.000"))
            db.add(batch_bal_row)
            db.flush()

        new_batch_qty = batch_bal_row.qty + qty_delta
        if new_batch_qty < 0:
            raise InsufficientStockError(
                f"Insufficient stock in batch {batch_id}: available {batch_bal_row.qty}, requested delta {qty_delta}"
            )
        batch_bal_row.qty = new_batch_qty

    # 3. Hash chaining (P2 / I33)
    last_row = db.query(StockLedger).order_by(StockLedger.id.desc()).first()
    prev_hash = last_row.hash if last_row else None
    
    entry_ts = utcnow()
    canonical_data = {
        "item_id": item_id,
        "batch_id": batch_id,
        "qty_delta": str(qty_delta),
        "movement_type": movement_type,
        "source_type": source_type,
        "source_id": source_id,
        "user_id": user_id,
        "ts": entry_ts.isoformat(),
        "unit_cost_snapshot": str(unit_cost_snapshot) if unit_cost_snapshot else None
    }
    curr_hash = compute_row_hash(prev_hash, canonical_data)

    # 4. Insert Ledger Record
    ledger_entry = StockLedger(
        item_id=item_id,
        batch_id=batch_id,
        qty_delta=qty_delta,
        movement_type=movement_type,
        source_type=source_type,
        source_id=source_id,
        unit_cost_snapshot=unit_cost_snapshot,
        user_id=user_id,
        ts=entry_ts,
        note=note,
        prev_hash=prev_hash,
        hash=curr_hash
    )
    db.add(ledger_entry)
    db.flush()
    return ledger_entry

def reconcile_balances(db: Session) -> Dict[str, Any]:
    """
    Compares cached stock_balance and batch_balance against the SUM(qty_delta) of stock_ledger.
    Reports drift. Invariant I2 requirement.
    """
    # 1. Total drift across items
    ledger_item_sums = db.query(
        StockLedger.item_id,
        func.sum(StockLedger.qty_delta).label("ledger_qty")
    ).group_by(StockLedger.item_id).all()
    
    item_ledger_map = {row.item_id: row.ledger_qty for row in ledger_item_sums}
    
    all_balances = db.query(StockBalance).all()
    item_drift_list = []
    
    for bal in all_balances:
        ledger_qty = item_ledger_map.get(bal.item_id, Decimal("0.000"))
        drift = bal.qty - ledger_qty
        if drift != Decimal("0.000"):
            item_drift_list.append({
                "item_id": bal.item_id,
                "cached_qty": bal.qty,
                "ledger_qty": ledger_qty,
                "drift": drift
            })
            
    # Check items that might be in ledger but not in stock_balance
    for item_id, l_qty in item_ledger_map.items():
        if not any(b.item_id == item_id for b in all_balances):
            if l_qty != Decimal("0.000"):
                item_drift_list.append({
                    "item_id": item_id,
                    "cached_qty": Decimal("0.000"),
                    "ledger_qty": l_qty,
                    "drift": -l_qty
                })

    # 2. Batch balances drift
    ledger_batch_sums = db.query(
        StockLedger.item_id,
        StockLedger.batch_id,
        func.sum(StockLedger.qty_delta).label("ledger_qty")
    ).filter(StockLedger.batch_id.isnot(None)).group_by(
        StockLedger.item_id, StockLedger.batch_id
    ).all()
    
    batch_ledger_map = {(row.item_id, row.batch_id): row.ledger_qty for row in ledger_batch_sums}
    batch_balances = db.query(BatchBalance).all()
    batch_drift_list = []
    
    for bbal in batch_balances:
        l_qty = batch_ledger_map.get((bbal.item_id, bbal.batch_id), Decimal("0.000"))
        drift = bbal.qty - l_qty
        if drift != Decimal("0.000"):
            batch_drift_list.append({
                "item_id": bbal.item_id,
                "batch_id": bbal.batch_id,
                "cached_qty": bbal.qty,
                "ledger_qty": l_qty,
                "drift": drift
            })

    total_drift_count = len(item_drift_list) + len(batch_drift_list)
    return {
        "status": "HEALTHY" if total_drift_count == 0 else "DRIFT_DETECTED",
        "total_drift_count": total_drift_count,
        "item_drifts": item_drift_list,
        "batch_drifts": batch_drift_list,
        "zero_drift": (total_drift_count == 0)
    }
