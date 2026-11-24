from fastapi import APIRouter, Depends, HTTPException
from typing import Optional
from sqlalchemy.orm import Session
from api.app.db import get_db
from api.app.models.entities import User
from api.app.schemas.schemas import PaymentCreate
from api.app.services.auth_service import require_role
from api.app.services.sales_service import (
    dispatch_invoice, record_payment, get_customer_outstanding
)

router = APIRouter(tags=["Dispatch & Payments"])

@router.post("/invoices/{invoice_id}/dispatch")
def dispatch_invoice_endpoint(invoice_id: int, vehicle_no: Optional[str] = None, db: Session = Depends(get_db), user: User = Depends(require_role(["ADMIN"]))):
    try:
        dsp = dispatch_invoice(db, invoice_id=invoice_id, vehicle_no=vehicle_no, user_id=user.id)
        db.commit()
        return {"dispatch_id": dsp.id, "dispatch_no": dsp.dispatch_no, "lines_count": len(dsp.lines)}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/payments")
def create_payment_endpoint(req: PaymentCreate, db: Session = Depends(get_db), user: User = Depends(require_role(["ADMIN"]))):
    try:
        allocations = [a.model_dump() for a in req.allocations] if req.allocations else None
        pay = record_payment(
            db=db,
            customer_id=req.customer_id,
            amount_paise=req.amount_paise,
            mode=req.mode,
            ref=req.ref,
            date=req.date,
            invoice_allocations=allocations,
            user_id=user.id
        )
        db.commit()
        return {"payment_id": pay.id, "payment_no": pay.payment_no, "amount_paise": pay.amount_paise}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/customers/{customer_id}/outstanding")
def get_outstanding_endpoint(customer_id: int, db: Session = Depends(get_db), user: User = Depends(require_role(["ADMIN", "AUDITOR", "OWNER", "SALESMAN"]))):
    try:
        return get_customer_outstanding(db, customer_id=customer_id)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
