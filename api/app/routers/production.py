from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Optional
from sqlalchemy.orm import Session
from api.app.db import get_db
from api.app.models.entities import ProductionRun, User
from api.app.schemas.schemas import PlannedRunCreate, RunIssueRequest, RunCompleteRequest
from api.app.services.auth_service import require_role
from api.app.services.production_service import (
    create_planned_run, start_and_issue_run, complete_production_run
)

router = APIRouter(prefix="/runs", tags=["Production"])

@router.get("")
def list_runs(db: Session = Depends(get_db), user: User = Depends(require_role(["ADMIN", "PRODUCTION", "AUDITOR", "OWNER"]))):
    runs = db.query(ProductionRun).order_by(ProductionRun.id.desc()).all()
    results = []
    for r in runs:
        results.append({
            "id": r.id,
            "run_no": r.run_no,
            "product_id": r.product_id,
            "product_name": r.product.pack_size_label,
            "status": r.status,
            "batch_multiplier": float(r.batch_multiplier),
            "expected_output": r.expected_output,
            "actual_good_output": r.actual_good_output,
            "cost_per_packet_paise": float(r.cost_per_packet_paise) if r.cost_per_packet_paise else None,
            "started_at": str(r.started_at) if r.started_at else None,
            "completed_at": str(r.completed_at) if r.completed_at else None,
            "shift": r.shift
        })
    return results

@router.post("")
def create_run(req: PlannedRunCreate, db: Session = Depends(get_db), user: User = Depends(require_role(["ADMIN", "PRODUCTION"]))):
    try:
        run = create_planned_run(
            db=db,
            product_id=req.product_id,
            batch_multiplier=req.batch_multiplier,
            supervisor_id=user.id,
            shift=req.shift
        )
        db.commit()
        db.refresh(run)
        return run
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/{run_id}/issue")
def issue_run_materials(run_id: int, req: RunIssueRequest, db: Session = Depends(get_db), user: User = Depends(require_role(["ADMIN", "PRODUCTION"]))):
    try:
        issues = [i.model_dump() for i in req.raw_issues]
        run = start_and_issue_run(db, run_id=run_id, raw_issues=issues, user_id=user.id)
        db.commit()
        db.refresh(run)
        return run
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/{run_id}/complete")
def complete_run_endpoint(run_id: int, req: RunCompleteRequest, db: Session = Depends(get_db), user: User = Depends(require_role(["ADMIN", "PRODUCTION"]))):
    try:
        pack_consumptions = [p.model_dump() for p in req.pack_consumptions]
        overheads = [o.model_dump() for o in req.overheads]
        run = complete_production_run(
            db=db,
            run_id=run_id,
            actual_good_output=req.actual_good_output,
            pack_consumptions=pack_consumptions,
            overheads=overheads,
            user_id=user.id
        )
        db.commit()
        db.refresh(run)
        return run
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/{run_id}/variance")
def get_run_variance(run_id: int, db: Session = Depends(get_db), user: User = Depends(require_role(["ADMIN", "PRODUCTION", "AUDITOR", "OWNER"]))):
    run = db.query(ProductionRun).filter(ProductionRun.id == run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    
    variances = []
    for rc in run.consumption:
        variances.append({
            "item_name": rc.item.name,
            "planned_qty": float(rc.planned_qty),
            "issued_qty": float(rc.issued_qty),
            "damaged_qty": float(rc.damaged_qty),
            "returned_qty": float(rc.returned_qty),
            "actual_consumed_qty": float(rc.actual_consumed_qty),
            "variance_pct": float(rc.variance_pct),
            "flagged": rc.flagged
        })
    return {
        "run_no": run.run_no,
        "expected_output": run.expected_output,
        "actual_good_output": run.actual_good_output,
        "cost_per_packet_paise": float(run.cost_per_packet_paise) if run.cost_per_packet_paise else None,
        "variances": variances
    }
