from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from sqlalchemy.orm import Session
from api.app.db import get_db
from api.app.models.entities import Purchase, PurchaseLine, User
from api.app.schemas.schemas import PurchaseCreate
from api.app.services.auth_service import require_role
from api.app.services.purchase_service import post_purchase

router = APIRouter(prefix="/purchases", tags=["Purchases"])

@router.get("")
def list_purchases(db: Session = Depends(get_db), user: User = Depends(require_role(["ADMIN", "PRODUCTION", "AUDITOR", "OWNER"]))):
    return db.query(Purchase).order_by(Purchase.id.desc()).all()

@router.post("")
def create_purchase(req: PurchaseCreate, db: Session = Depends(get_db), user: User = Depends(require_role(["ADMIN", "PRODUCTION"]))):
    purch = Purchase(
        purchase_no=req.purchase_no,
        supplier_id=req.supplier_id,
        date=req.date,
        status="DRAFT",
        notes=req.notes,
        created_by=user.id
    )
    db.add(purch)
    db.flush()

    for l in req.lines:
        line = PurchaseLine(
            purchase_id=purch.id,
            item_id=l.item_id,
            qty=l.qty,
            rate_paise_per_base=l.rate_paise_per_base,
            supplier_lot_no=l.supplier_lot_no,
            expiry_date=l.expiry_date
        )
        db.add(line)

    db.commit()
    db.refresh(purch)
    return purch

@router.post("/{purchase_id}/post")
def post_purchase_endpoint(purchase_id: int, db: Session = Depends(get_db), user: User = Depends(require_role(["ADMIN", "PRODUCTION"]))):
    try:
        purch = post_purchase(db, purchase_id=purchase_id, user_id=user.id)
        db.commit()
        db.refresh(purch)
        return purch
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
