from fastapi import APIRouter, Depends, HTTPException, Response
from typing import List
from sqlalchemy.orm import Session
from api.app.db import get_db
from api.app.models.entities import Invoice, InvoiceLine, Order, User
from api.app.services.auth_service import require_role
from api.app.services.sales_service import generate_invoice
from api.app.services.money import paise_to_rupees_str

router = APIRouter(prefix="/invoices", tags=["Billing & Invoices"])

@router.get("")
def list_invoices(db: Session = Depends(get_db), user: User = Depends(require_role(["ADMIN", "AUDITOR", "OWNER"]))):
    invoices = db.query(Invoice).order_by(Invoice.id.desc()).all()
    results = []
    for inv in invoices:
        results.append({
            "id": inv.id,
            "invoice_no": inv.invoice_no,
            "order_id": inv.order_id,
            "customer_name": inv.customer_name,
            "place_of_supply": inv.place_of_supply_state,
            "supply_type": inv.supply_type,
            "total_taxable_rupees": paise_to_rupees_str(inv.total_taxable_paise),
            "total_cgst_rupees": paise_to_rupees_str(inv.total_cgst_paise),
            "total_sgst_rupees": paise_to_rupees_str(inv.total_sgst_paise),
            "total_igst_rupees": paise_to_rupees_str(inv.total_igst_paise),
            "total_amount_rupees": paise_to_rupees_str(inv.total_amount_paise),
            "status": inv.status,
            "created_at": str(inv.created_at)
        })
    return results

@router.post("/from-order/{order_id}")
def create_invoice_from_order(order_id: int, db: Session = Depends(get_db), user: User = Depends(require_role(["ADMIN"]))):
    try:
        inv = generate_invoice(db, order_id=order_id, user_id=user.id)
        db.commit()
        return {
            "invoice_id": inv.id,
            "invoice_no": inv.invoice_no,
            "total_amount_paise": inv.total_amount_paise,
            "status": inv.status
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/{invoice_id}/pdf")
def get_invoice_pdf(invoice_id: int, db: Session = Depends(get_db), user: User = Depends(require_role(["ADMIN", "AUDITOR", "OWNER"]))):
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    # Return HTML representation ready for display/print
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <title>Tax Invoice {invoice.invoice_no}</title>
        <style>
            body {{ font-family: 'Fauna One', sans-serif; margin: 40px; color: #1a1a1a; }}
            .header {{ text-align: center; border-bottom: 2px solid #8050ED; padding-bottom: 10px; }}
            .title {{ font-family: 'Cinzel', serif; font-size: 24px; color: #8050ED; font-weight: bold; }}
            .info-grid {{ display: flex; justify-content: space-between; margin-top: 20px; }}
            table {{ width: 100%; border-collapse: collapse; margin-top: 20px; }}
            th, td {{ border: 1px solid #ccc; padding: 8px; text-align: left; }}
            th {{ background: #f4f4f4; }}
            .total-row {{ font-weight: bold; background: #fafafa; }}
        </style>
    </head>
    <body>
        <div class="header">
            <div class="title">BATCHLY FOODS PRIVATE LIMITED</div>
            <p>GSTIN: 33AABCB1234F1Z5 | Tamil Nadu (33)<br>Plot 42, SIDCO Industrial Estate, Thuvakudi, Tiruchirappalli 620015</p>
            <h3>TAX INVOICE</h3>
        </div>
        <div class="info-grid">
            <div>
                <strong>Invoice No:</strong> {invoice.invoice_no}<br>
                <strong>Date:</strong> {invoice.created_at.strftime('%d-%b-%Y')}<br>
                <strong>Supply Type:</strong> {invoice.supply_type}
            </div>
            <div>
                <strong>Billed To:</strong><br>
                {invoice.customer_name}<br>
                GSTIN: {invoice.customer_gstin or 'Unregistered'}<br>
                State: {invoice.customer_state_code}
            </div>
        </div>
        <table>
            <thead>
                <tr>
                    <th>HSN</th><th>Qty (pkts)</th><th>Rate (₹)</th><th>Taxable (₹)</th>
                    <th>CGST (₹)</th><th>SGST (₹)</th><th>IGST (₹)</th><th>Total (₹)</th>
                </tr>
            </thead>
            <tbody>
    """
    for l in invoice.lines:
        html_content += f"""
            <tr>
                <td>{l.hsn}</td>
                <td>{l.qty}</td>
                <td>{paise_to_rupees_str(l.rate_paise)}</td>
                <td>{paise_to_rupees_str(l.taxable_paise)}</td>
                <td>{paise_to_rupees_str(l.cgst_paise)}</td>
                <td>{paise_to_rupees_str(l.sgst_paise)}</td>
                <td>{paise_to_rupees_str(l.igst_paise)}</td>
                <td>{paise_to_rupees_str(l.total_paise)}</td>
            </tr>
        """
    html_content += f"""
            <tr class="total-row">
                <td colspan="3">Total</td>
                <td>{paise_to_rupees_str(invoice.total_taxable_paise)}</td>
                <td>{paise_to_rupees_str(invoice.total_cgst_paise)}</td>
                <td>{paise_to_rupees_str(invoice.total_sgst_paise)}</td>
                <td>{paise_to_rupees_str(invoice.total_igst_paise)}</td>
                <td>₹{paise_to_rupees_str(invoice.total_amount_paise)}</td>
            </tr>
            </tbody>
        </table>
    </body>
    </html>
    """
    return Response(content=html_content, media_type="text/html")
