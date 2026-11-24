import csv
import io
import datetime
from decimal import Decimal
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_, func, or_
from api.app.models.entities import (
    Invoice, InvoiceLine, Order, OrderLine, Customer, Product, Item,
    Purchase, PurchaseLine, Supplier, StockLedger, ProductionRun,
    RunConsumption, Payment, PaymentAllocation, CreditNote, AuditLog,
    AppSettings
)
from api.app.services.money import paise_to_rupees_str, paise_to_rupees_decimal
from api.app.services.uom import from_base

def sanitize_csv_cell(val: Any) -> Any:
    """Escapes formula injection characters (=, +, -, @). Invariant I25."""
    if isinstance(val, str) and len(val) > 0 and val[0] in ["=", "+", "-", "@"]:
        return f"'{val}"
    return val

def generate_sales_register(db: Session, from_date: Optional[datetime.date] = None, to_date: Optional[datetime.date] = None) -> List[Dict[str, Any]]:
    query = db.query(Invoice).order_by(Invoice.created_at.desc())
    if from_date:
        query = query.filter(func.date(Invoice.created_at) >= from_date)
    if to_date:
        query = query.filter(func.date(Invoice.created_at) <= to_date)
    
    rows = []
    for inv in query.all():
        rows.append({
            "invoice_no": inv.invoice_no,
            "date": str(inv.created_at.date() if isinstance(inv.created_at, datetime.datetime) else inv.created_at),
            "customer_name": inv.customer_name,
            "gstin": inv.customer_gstin or "Unregistered (B2CS)",
            "state_code": inv.customer_state_code,
            "supply_type": inv.supply_type,
            "taxable_rupees": paise_to_rupees_str(inv.total_taxable_paise),
            "cgst_rupees": paise_to_rupees_str(inv.total_cgst_paise),
            "sgst_rupees": paise_to_rupees_str(inv.total_sgst_paise),
            "igst_rupees": paise_to_rupees_str(inv.total_igst_paise),
            "total_rupees": paise_to_rupees_str(inv.total_amount_paise),
            "status": inv.status
        })
    return rows

def generate_gst_summary(db: Session) -> Dict[str, Any]:
    invoices = db.query(Invoice).filter(Invoice.status == "POSTED").all()
    b2b = []
    b2cs = []
    hsn_dict = {}

    tot_taxable = 0
    tot_cgst = 0
    tot_sgst = 0
    tot_igst = 0

    for inv in invoices:
        tot_taxable += inv.total_taxable_paise
        tot_cgst += inv.total_cgst_paise
        tot_sgst += inv.total_sgst_paise
        tot_igst += inv.total_igst_paise

        inv_data = {
            "invoice_no": inv.invoice_no,
            "customer_name": inv.customer_name,
            "pos": inv.place_of_supply_state,
            "taxable": paise_to_rupees_str(inv.total_taxable_paise),
            "cgst": paise_to_rupees_str(inv.total_cgst_paise),
            "sgst": paise_to_rupees_str(inv.total_sgst_paise),
            "igst": paise_to_rupees_str(inv.total_igst_paise),
            "total": paise_to_rupees_str(inv.total_amount_paise)
        }
        if inv.customer_gstin:
            inv_data["gstin"] = inv.customer_gstin
            b2b.append(inv_data)
        else:
            b2cs.append(inv_data)

        for l in inv.lines:
            entry = hsn_dict.setdefault(l.hsn, {"qty": 0, "taxable": 0, "tax": 0})
            entry["qty"] += l.qty
            entry["taxable"] += l.taxable_paise
            entry["tax"] += (l.cgst_paise + l.sgst_paise + l.igst_paise)

    hsn_summary = [
        {
            "hsn": h,
            "uqc": "PAC",
            "qty": data["qty"],
            "taxable_rupees": paise_to_rupees_str(data["taxable"]),
            "tax_rupees": paise_to_rupees_str(data["tax"])
        }
        for h, data in hsn_dict.items()
    ]

    return {
        "gstr_3b_3_1_a": {
            "outward_taxable_rupees": paise_to_rupees_str(tot_taxable),
            "cgst_rupees": paise_to_rupees_str(tot_cgst),
            "sgst_rupees": paise_to_rupees_str(tot_sgst),
            "igst_rupees": paise_to_rupees_str(tot_igst),
            "total_tax_rupees": paise_to_rupees_str(tot_cgst + tot_sgst + tot_igst)
        },
        "b2b": b2b,
        "b2cs": b2cs,
        "hsn_summary": hsn_summary
    }

def generate_stock_summary(db: Session) -> List[Dict[str, Any]]:
    items = db.query(Item).all()
    results = []

    for item in items:
        # Sum deltas by movement types
        rows = db.query(StockLedger.movement_type, func.sum(StockLedger.qty_delta)).filter(
            StockLedger.item_id == item.id
        ).group_by(StockLedger.movement_type).all()

        m_map = {m_type: qty for m_type, qty in rows}
        opening = m_map.get("OPENING", Decimal("0.000"))
        purchases = m_map.get("PURCHASE", Decimal("0.000"))
        issues = abs(m_map.get("ISSUE", Decimal("0.000")))
        scrap = abs(m_map.get("SCRAP", Decimal("0.000")))
        prod_in = m_map.get("PRODUCTION_IN", Decimal("0.000"))
        dispatch = abs(m_map.get("DISPATCH", Decimal("0.000")))
        adjustments = m_map.get("ADJUSTMENT", Decimal("0.000"))

        closing = opening + purchases - issues - scrap + prod_in - dispatch + adjustments
        
        # Identity check: opening + in - out +/- adj - closing must == 0
        identity_check = (opening + purchases + prod_in) - (issues + scrap + dispatch) + adjustments - closing

        rate = item.moving_avg_cost_paise or Decimal("0.000000")
        closing_value_paise = int(closing * rate)

        results.append({
            "item_id": item.id,
            "name": item.name,
            "type": item.type,
            "uom": item.display_uom,
            "opening": float(from_base(opening, item.display_uom)),
            "receipts": float(from_base(purchases, item.display_uom)),
            "issues": float(from_base(issues, item.display_uom)),
            "scrap": float(from_base(scrap, item.display_uom)),
            "production_in": float(from_base(prod_in, item.display_uom)),
            "dispatch": float(from_base(dispatch, item.display_uom)),
            "closing": float(from_base(closing, item.display_uom)),
            "closing_value_rupees": paise_to_rupees_str(closing_value_paise),
            "identity_check_zero": (identity_check == Decimal("0.000"))
        })

    return results

def generate_production_report(db: Session) -> List[Dict[str, Any]]:
    runs = db.query(ProductionRun).order_by(ProductionRun.id.desc()).all()
    results = []

    for r in runs:
        flagged_lines = [rc.item.name for rc in r.consumption if rc.flagged]
        cost_str = paise_to_rupees_str(int(r.cost_per_packet_paise)) if r.cost_per_packet_paise else "0.00"
        
        results.append({
            "run_no": r.run_no,
            "product": r.product.pack_size_label,
            "status": r.status,
            "expected_output": r.expected_output,
            "actual_good_output": r.actual_good_output,
            "yield_loss": r.expected_output - r.actual_good_output,
            "cost_per_packet_rupees": cost_str,
            "flagged_variances": flagged_lines,
            "date": str(r.created_at.date())
        })

    return results

def export_to_csv(data: List[Dict[str, Any]]) -> str:
    """Exports dataset to sanitized CSV string."""
    if not data:
        return ""
    output = io.StringIO()
    headers = list(data[0].keys())
    writer = csv.DictWriter(output, fieldnames=headers)
    writer.writeheader()
    for row in data:
        sanitized_row = {k: sanitize_csv_cell(v) for k, v in row.items()}
        writer.writerow(sanitized_row)
    return output.getvalue()
