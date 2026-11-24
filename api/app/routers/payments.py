from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import func
import datetime
from api.app.db import get_db
from api.app.models.entities import Payment, PaymentAllocation, Invoice, Customer, CreditNote, User, utcnow
from api.app.services.auth_service import require_role
from api.app.services.sales_service import record_payment, get_customer_outstanding
from api.app.services.money import paise_to_rupees_str

router = APIRouter(prefix="/payments", tags=["Payments & Collections"])

class PaymentCreateRequest(BaseModel):
    invoice_id: Optional[int] = None
    customer_id: Optional[int] = None
    amount_paise: int = Field(gt=0, description="Amount in integer paise")
    mode: str = "CASH"
    reference_no: Optional[str] = None

class CreditNoteCreateRequest(BaseModel):
    invoice_id: int
    amount_paise: int = Field(gt=0)
    reason: str

@router.get("")
def list_payments(db: Session = Depends(get_db), user: User = Depends(require_role(["ADMIN", "AUDITOR", "OWNER"]))):
    payments = db.query(Payment).order_by(Payment.id.desc()).all()
    results = []
    for p in payments:
        cust = db.query(Customer).filter(Customer.id == p.customer_id).first()
        results.append({
            "id": p.id,
            "payment_no": p.payment_no,
            "customer_id": p.customer_id,
            "customer_name": cust.name if cust else "Unknown",
            "amount_paise": p.amount_paise,
            "amount_rupees": paise_to_rupees_str(p.amount_paise),
            "mode": p.mode,
            "reference_no": p.ref,
            "date": str(p.date)
        })
    return results

@router.post("")
def create_payment(
    req: PaymentCreateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(["ADMIN"]))
):
    try:
        cust_id = req.customer_id
        allocations = None
        if req.invoice_id:
            inv = db.query(Invoice).filter(Invoice.id == req.invoice_id).first()
            if not inv:
                raise HTTPException(status_code=404, detail=f"Invoice {req.invoice_id} not found")
            cust_id = inv.customer_id
            allocations = [{"invoice_id": req.invoice_id, "amount_paise": req.amount_paise}]
        elif not cust_id:
            raise HTTPException(status_code=400, detail="Either invoice_id or customer_id must be provided")

        payment = record_payment(
            db=db,
            customer_id=cust_id,
            amount_paise=req.amount_paise,
            mode=req.mode,
            ref=req.reference_no,
            invoice_allocations=allocations,
            user_id=user.id
        )
        db.commit()

        # Compute outstanding for invoice or customer
        out = get_customer_outstanding(db, cust_id)
        return {
            "payment_id": payment.id,
            "payment_no": payment.payment_no,
            "amount_paise": payment.amount_paise,
            "outstanding_paise": out["net_outstanding_paise"]
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/outstanding")
def get_all_outstanding(db: Session = Depends(get_db), user: User = Depends(require_role(["ADMIN", "AUDITOR", "OWNER"]))):
    customers = db.query(Customer).filter(Customer.active == True).all()
    results = []
    for c in customers:
        out = get_customer_outstanding(db, c.id)
        inv_count = db.query(Invoice).filter(Invoice.customer_id == c.id, Invoice.status == "POSTED").count()
        overdue = out["ageing"]["31_60"] + out["ageing"]["61_90"] + out["ageing"]["90_plus"]
        results.append({
            "customer_id": c.id,
            "customer_name": c.name,
            "invoice_count": inv_count,
            "total_outstanding": paise_to_rupees_str(out["net_outstanding_paise"]),
            "overdue_amount": paise_to_rupees_str(overdue),
            "ageing": {
                "0_30": paise_to_rupees_str(out["ageing"]["0_30"]),
                "31_60": paise_to_rupees_str(out["ageing"]["31_60"]),
                "61_90": paise_to_rupees_str(out["ageing"]["61_90"]),
                "90_plus": paise_to_rupees_str(out["ageing"]["90_plus"])
            }
        })
    return results

@router.post("/credit-notes")
def create_credit_note(
    req: CreditNoteCreateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(["ADMIN"]))
):
    inv = db.query(Invoice).filter(Invoice.id == req.invoice_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    today_str = datetime.date.today().strftime("%y%m%d")
    count_today = db.query(CreditNote).count() + 1
    cn_no = f"CN-{today_str}-{count_today:03d}"

    cn = CreditNote(
        cn_no=cn_no,
        invoice_id=inv.id,
        customer_id=inv.customer_id,
        amount_paise=req.amount_paise,
        reason=req.reason,
        created_at=utcnow(),
        created_by=user.id
    )
    db.add(cn)
    db.commit()
    return {
        "id": cn.id,
        "cn_no": cn.cn_no,
        "amount_paise": cn.amount_paise,
        "amount_rupees": paise_to_rupees_str(cn.amount_paise)
    }
