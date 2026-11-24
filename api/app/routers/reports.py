from fastapi import APIRouter, Depends, HTTPException, Query, Response
from typing import Optional
import datetime
from sqlalchemy.orm import Session
from api.app.db import get_db
from api.app.models.entities import User
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
    format: str = Query("json", enum=["json", "csv"]),
    db: Session = Depends(get_db),
    user: User = Depends(require_role(["ADMIN", "AUDITOR", "OWNER"]))
):
    data = generate_sales_register(db, from_date, to_date)
    if format == "csv":
        csv_text = export_to_csv(data)
        return Response(content=csv_text, media_type="text/csv", headers={"Content-Disposition": "attachment; filename=sales_register.csv"})
    return data

@router.get("/gst-summary")
def get_gst_summary_report(
    db: Session = Depends(get_db),
    user: User = Depends(require_role(["ADMIN", "AUDITOR", "OWNER"]))
):
    return generate_gst_summary(db)

@router.get("/stock-summary")
def get_stock_summary_report(
    format: str = Query("json", enum=["json", "csv"]),
    db: Session = Depends(get_db),
    user: User = Depends(require_role(["ADMIN", "PRODUCTION", "AUDITOR", "OWNER"]))
):
    data = generate_stock_summary(db)
    if format == "csv":
        csv_text = export_to_csv(data)
        return Response(content=csv_text, media_type="text/csv", headers={"Content-Disposition": "attachment; filename=stock_summary.csv"})
    return data

@router.get("/production-report")
def get_production_report(
    format: str = Query("json", enum=["json", "csv"]),
    db: Session = Depends(get_db),
    user: User = Depends(require_role(["ADMIN", "PRODUCTION", "AUDITOR", "OWNER"]))
):
    data = generate_production_report(db)
    if format == "csv":
        csv_text = export_to_csv(data)
        return Response(content=csv_text, media_type="text/csv", headers={"Content-Disposition": "attachment; filename=production_report.csv"})
    return data
