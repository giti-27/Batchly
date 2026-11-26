from fastapi import APIRouter, Depends, HTTPException, Query, Response
from typing import Optional
import datetime
from sqlalchemy.orm import Session
from api.app.db import get_db
from api.app.models.entities import User, AuditLog, Invoice, StockLedger, Item
from api.app.services.auth_service import require_role
from api.app.reports.reporting import (
    generate_sales_register, generate_gst_summary, generate_stock_summary,
    generate_production_report, export_to_csv
)

router = APIRouter(prefix="/reports", tags=["Reports"])

@router.get("/sales-register")
def get_sales_register(
    from_date: Optional[datetime.date] = None,
    to_date: Optional[datetime.date] = None,
    format: str = Query("json", pattern="^(json|csv)$"),
    db: Session = Depends(get_db),
    user: User = Depends(require_role(["ADMIN", "AUDITOR", "OWNER"]))
):
    data = generate_sales_register(db, from_date, to_date)
    if format == "csv":
        csv_text = export_to_csv(data)
        return Response(content=csv_text, media_type="text/csv", headers={"Content-Disposition": "attachment; filename=sales_register.csv"})
    return data

@router.get("/sales-register/csv")
def get_sales_register_csv(
    db: Session = Depends(get_db),
    user: User = Depends(require_role(["ADMIN", "AUDITOR", "OWNER"]))
):
    data = generate_sales_register(db)
    csv_text = export_to_csv(data)
    return Response(content=csv_text, media_type="text/csv", headers={"Content-Disposition": "attachment; filename=sales_register.csv"})

@router.get("/gst-summary")
def get_gst_summary_report(
    db: Session = Depends(get_db),
    user: User = Depends(require_role(["ADMIN", "AUDITOR", "OWNER"]))
):
    return generate_gst_summary(db)

@router.get("/gst/gstr1")
def get_gstr1(
    db: Session = Depends(get_db),
    user: User = Depends(require_role(["ADMIN", "AUDITOR", "OWNER"]))
):
    summary = generate_gst_summary(db)
    return {
        "report": "GSTR-1 Outward Supplies",
        "period": datetime.date.today().strftime("%B %Y"),
        "b2b": summary.get("b2b_invoices", []),
        "b2cs": summary.get("b2cs_invoices", []),
        "hsn_summary": summary.get("hsn_summary", []),
        "total_taxable": summary.get("total_taxable"),
        "total_tax": summary.get("total_tax")
    }

@router.get("/gst/gstr3b")
def get_gstr3b(
    db: Session = Depends(get_db),
    user: User = Depends(require_role(["ADMIN", "AUDITOR", "OWNER"]))
):
    summary = generate_gst_summary(db)
    return {
        "report": "GSTR-3B Summary of Outward Supplies & ITC",
        "period": datetime.date.today().strftime("%B %Y"),
        "outward_taxable_supplies": {
            "total_taxable_value": summary.get("total_taxable"),
            "cgst": summary.get("total_cgst"),
            "sgst": summary.get("total_sgst"),
            "igst": summary.get("total_igst")
        },
        "itc_eligible": {
            "all_other_itc": "Computed from Purchase Register"
        }
    }

@router.get("/stock-summary")
def get_stock_summary_report(
    format: str = Query("json", pattern="^(json|csv)$"),
    db: Session = Depends(get_db),
    user: User = Depends(require_role(["ADMIN", "PRODUCTION", "AUDITOR", "OWNER"]))
):
    data = generate_stock_summary(db)
    if format == "csv":
        csv_text = export_to_csv(data)
        return Response(content=csv_text, media_type="text/csv", headers={"Content-Disposition": "attachment; filename=stock_summary.csv"})
    return data

@router.get("/stock-summary/csv")
def get_stock_summary_csv(
    db: Session = Depends(get_db),
    user: User = Depends(require_role(["ADMIN", "PRODUCTION", "AUDITOR", "OWNER"]))
):
    data = generate_stock_summary(db)
    csv_text = export_to_csv(data)
    return Response(content=csv_text, media_type="text/csv", headers={"Content-Disposition": "attachment; filename=stock_summary.csv"})

@router.get("/production-report")
def get_production_report(
    format: str = Query("json", pattern="^(json|csv)$"),
    db: Session = Depends(get_db),
    user: User = Depends(require_role(["ADMIN", "PRODUCTION", "AUDITOR", "OWNER"]))
):
    data = generate_production_report(db)
    if format == "csv":
        csv_text = export_to_csv(data)
        return Response(content=csv_text, media_type="text/csv", headers={"Content-Disposition": "attachment; filename=production_report.csv"})
    return data

@router.get("/production-report/csv")
def get_production_report_csv(
    db: Session = Depends(get_db),
    user: User = Depends(require_role(["ADMIN", "PRODUCTION", "AUDITOR", "OWNER"]))
):
    data = generate_production_report(db)
    csv_text = export_to_csv(data)
    return Response(content=csv_text, media_type="text/csv", headers={"Content-Disposition": "attachment; filename=production_report.csv"})

@router.get("/audit-log")
def get_audit_log(
    db: Session = Depends(get_db),
    user: User = Depends(require_role(["ADMIN", "AUDITOR", "OWNER"]))
):
    logs = db.query(AuditLog).order_by(AuditLog.id.desc()).limit(100).all()
    results = []
    for l in logs:
        results.append({
            "id": l.id,
            "entity": l.entity,
            "entity_id": l.entity_id,
            "action": l.action,
            "user_id": l.user_id,
            "timestamp": str(l.ts),
            "reason": l.reason,
            "hash": l.hash
        })
    return results
