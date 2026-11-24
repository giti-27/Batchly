from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional
from sqlalchemy.orm import Session
from api.app.db import get_db
from api.app.models.entities import User
from api.app.schemas.schemas import WhatIfRequest
from api.app.services.auth_service import require_role
from api.app.services.intelligence_service import (
    run_production_decision_engine, get_forward_trace, get_backward_trace,
    quarantine_batch, detect_anomalies, simulate_what_if, verify_audit_integrity,
    get_public_qr_data
)

router = APIRouter(tags=["Intelligence"])

# Decision Engine
@router.get("/insights/decision")
def get_production_decision(product_id: int, db: Session = Depends(get_db), user: User = Depends(require_role(["ADMIN", "PRODUCTION", "OWNER"]))):
    try:
        return run_production_decision_engine(db, product_id)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# Batch Traceability & Recall
@router.get("/trace/backward")
def trace_backward(batch_no: str, db: Session = Depends(get_db), user: User = Depends(require_role(["ADMIN", "AUDITOR", "OWNER"]))):
    try:
        return get_backward_trace(db, batch_no)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/trace/forward")
def trace_forward(batch_no: str, db: Session = Depends(get_db), user: User = Depends(require_role(["ADMIN", "AUDITOR", "OWNER"]))):
    try:
        return get_forward_trace(db, batch_no)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/batches/{batch_no}/quarantine")
def quarantine_batch_endpoint(batch_no: str, db: Session = Depends(get_db), user: User = Depends(require_role(["ADMIN"]))):
    try:
        b = quarantine_batch(db, batch_no=batch_no, user_id=user.id)
        db.commit()
        return {"batch_no": b.batch_no, "status": b.status}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

# Anomalies
@router.get("/insights/anomalies")
def get_anomalies_endpoint(product_id: Optional[int] = None, db: Session = Depends(get_db), user: User = Depends(require_role(["ADMIN", "AUDITOR", "OWNER"]))):
    return detect_anomalies(db, product_id)

# What-if Simulator
@router.post("/whatif")
def what_if_simulation(req: WhatIfRequest, db: Session = Depends(get_db), user: User = Depends(require_role(["ADMIN", "OWNER"]))):
    try:
        return simulate_what_if(
            db=db,
            product_id=req.product_id,
            selling_price_delta_paise=req.selling_price_delta_paise,
            input_price_pct_change=req.input_price_pct_change,
            yield_override=req.yield_override,
            extra_demand_packets=req.extra_demand_packets,
            overhead_per_run_paise=req.overhead_per_run_paise
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# Integrity Check
@router.get("/audit/integrity")
def check_audit_integrity(db: Session = Depends(get_db), user: User = Depends(require_role(["ADMIN", "AUDITOR", "OWNER"]))):
    return verify_audit_integrity(db)

# Public QR Trace (Sanitized - no auth required)
@router.get("/t/{batch_no}")
def public_qr_trace(batch_no: str, db: Session = Depends(get_db)):
    try:
        return get_public_qr_data(db, batch_no)
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))
