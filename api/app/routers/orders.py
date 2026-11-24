from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Optional
from sqlalchemy.orm import Session
from api.app.db import get_db
from api.app.models.entities import Order, OrderLine, User
from api.app.schemas.schemas import OrderCreate, OrderApproveRequest, OrderRejectRequest, OrderHoldRequest
from api.app.services.auth_service import get_current_user, require_role
from api.app.services.sales_service import (
    create_order, approve_order, hold_order, reject_order, check_order_stock
)

router = APIRouter(prefix="/orders", tags=["Orders"])

@router.get("")
def list_orders(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    # Salesman sees only own orders; foreign IDs return 404/excluded (PRD 7.1)
    if user.role == "SALESMAN":
        query = db.query(Order).filter(Order.salesman_id == user.id)
    else:
        query = db.query(Order)
    
    orders = query.order_by(Order.id.desc()).all()
    results = []
    for o in orders:
        tot_qty = sum(l.qty_ordered for l in o.lines)
        tot_value_paise = sum(l.qty_ordered * l.price_paise_snapshot for l in o.lines)
        results.append({
            "id": o.id,
            "order_no": o.order_no,
            "client_uuid": o.client_uuid,
            "customer_id": o.customer_id,
            "customer_name": o.customer.name,
            "salesman_id": o.salesman_id,
            "status": o.status,
            "total_packets": tot_qty,
            "total_value_paise": tot_value_paise,
            "created_at": str(o.created_at),
            "notes": o.notes
        })
    return results

@router.get("/{order_id}")
def get_order_details(order_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if user.role == "SALESMAN" and order.salesman_id != user.id:
        raise HTTPException(status_code=404, detail="Order not found")

    lines = []
    for l in order.lines:
        lines.append({
            "line_id": l.id,
            "product_id": l.product_id,
            "product_name": l.product.pack_size_label,
            "qty_ordered": l.qty_ordered,
            "qty_approved": l.qty_approved,
            "price_paise": l.price_paise_snapshot,
            "line_total_paise": l.qty_ordered * l.price_paise_snapshot
        })

    return {
        "id": order.id,
        "order_no": order.order_no,
        "customer_id": order.customer_id,
        "customer_name": order.customer.name,
        "customer_state": order.customer.state_code,
        "status": order.status,
        "lines": lines,
        "notes": order.notes
    }

@router.post("")
def place_order(req: OrderCreate, db: Session = Depends(get_db), user: User = Depends(require_role(["SALESMAN", "ADMIN"]))):
    try:
        lines = [l.model_dump() for l in req.lines]
        order = create_order(
            db=db,
            client_uuid=req.client_uuid,
            customer_id=req.customer_id,
            salesman_id=user.id,
            lines_data=lines,
            notes=req.notes
        )
        db.commit()
        db.refresh(order)
        return {"id": order.id, "order_no": order.order_no, "status": order.status}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/{order_id}/stock-check")
def check_stock_endpoint(order_id: int, db: Session = Depends(get_db), user: User = Depends(require_role(["ADMIN", "OWNER"]))):
    try:
        return check_order_stock(db, order_id=order_id)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/{order_id}/approve")
def approve_order_endpoint(order_id: int, req: Optional[OrderApproveRequest] = None, db: Session = Depends(get_db), user: User = Depends(require_role(["ADMIN"]))):
    try:
        approved_lines = [al.model_dump() for al in req.approved_lines] if req and req.approved_lines else None
        order = approve_order(db, order_id=order_id, approved_lines=approved_lines, user_id=user.id)
        db.commit()
        return {"order_id": order.id, "status": order.status}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/{order_id}/hold")
def hold_order_endpoint(order_id: int, req: OrderHoldRequest, db: Session = Depends(get_db), user: User = Depends(require_role(["ADMIN"]))):
    order = hold_order(db, order_id=order_id, note=req.note)
    db.commit()
    return {"order_id": order.id, "status": order.status, "notes": order.notes}

@router.post("/{order_id}/reject")
def reject_order_endpoint(order_id: int, req: OrderRejectRequest, db: Session = Depends(get_db), user: User = Depends(require_role(["ADMIN"]))):
    order = reject_order(db, order_id=order_id, reason=req.reason)
    db.commit()
    return {"order_id": order.id, "status": order.status, "notes": order.notes}
