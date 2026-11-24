import datetime
from decimal import Decimal
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import select, and_, func
from api.app.models.entities import (
    Order, OrderLine, Invoice, InvoiceLine, InvoiceCounter, CreditNote,
    Dispatch, DispatchLine, Payment, PaymentAllocation, Customer, Product,
    Item, Batch, BatchBalance, StockBalance, AppSettings, User, utcnow
)
from api.app.services.ledger_service import post_movement
from api.app.services.money import round_paise

def get_financial_year(dt: datetime.date) -> str:
    """Computes Indian Financial Year (1 Apr - 31 Mar) e.g., '2026-27'."""
    year = dt.year
    if dt.month >= 4:
        return f"{year}-{str(year + 1)[-2:]}"
    else:
        return f"{year - 1}-{str(year)[-2:]}"

def create_order(
    db: Session,
    client_uuid: str,
    customer_id: int,
    salesman_id: int,
    lines_data: List[Dict[str, Any]],
    notes: Optional[str] = None
) -> Order:
    """
    Creates an order with idempotency check (Invariant I10).
    If client_uuid already exists, returns the existing order.
    """
    existing = db.query(Order).filter(Order.client_uuid == client_uuid).first()
    if existing:
        return existing

    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise ValueError(f"Customer {customer_id} not found")

    today_str = datetime.date.today().strftime("%y%m%d")
    count_today = db.query(Order).count() + 1
    order_no = f"ORD-{today_str}-{count_today:03d}"

    order = Order(
        order_no=order_no,
        client_uuid=client_uuid,
        customer_id=customer_id,
        salesman_id=salesman_id,
        status="SUBMITTED",
        notes=notes
    )
    db.add(order)
    db.flush()

    for item in lines_data:
        product_id = item["product_id"]
        qty_ordered = int(item["qty_ordered"])
        if qty_ordered <= 0:
            raise ValueError("Order quantity must be a positive integer whole packet count")

        product = db.query(Product).filter(Product.id == product_id).first()
        if not product:
            raise ValueError(f"Product {product_id} not found")

        price_paise = item.get("price_paise") or product.price_paise
        price_reason = item.get("price_edit_reason")

        line = OrderLine(
            order_id=order.id,
            product_id=product_id,
            qty_ordered=qty_ordered,
            qty_approved=0,
            price_paise_snapshot=price_paise,
            price_edit_reason=price_reason
        )
        db.add(line)

    db.flush()
    return order

def check_order_stock(db: Session, order_id: int) -> Dict[str, Any]:
    """
    Calculates Available FG = on_hand - reserved.
    Shows ordered, available, and shortage.
    """
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise ValueError(f"Order {order_id} not found")

    lines_status = []
    total_shortage = 0
    all_fulfillable = True

    for line in order.lines:
        product = db.query(Product).filter(Product.id == line.product_id).first()
        bal = db.query(StockBalance).filter(StockBalance.item_id == product.item_id).first()
        on_hand = int(bal.qty) if bal else 0
        reserved = int(bal.reserved_qty) if bal else 0
        available = max(0, on_hand - reserved)
        
        shortage = max(0, line.qty_ordered - available)
        if shortage > 0:
            all_fulfillable = False
            total_shortage += shortage

        lines_status.append({
            "product_id": product.id,
            "product_name": product.pack_size_label,
            "qty_ordered": line.qty_ordered,
            "on_hand": on_hand,
            "reserved": reserved,
            "available": available,
            "shortage": shortage
        })

    return {
        "order_id": order.id,
        "order_no": order.order_no,
        "all_fulfillable": all_fulfillable,
        "total_shortage": total_shortage,
        "lines": lines_status
    }

def approve_order(
    db: Session,
    order_id: int,
    approved_lines: Optional[List[Dict[str, Any]]] = None,
    user_id: Optional[int] = None
) -> Order:
    """
    Approves an order (full or partial).
    Increments reserved_qty on StockBalance.
    """
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise ValueError(f"Order {order_id} not found")
    if order.status != "SUBMITTED":
        raise ValueError(f"Cannot approve order {order_id}: current status is '{order.status}'")

    approval_map = {}
    if approved_lines:
        for al in approved_lines:
            approval_map[al["product_id"]] = int(al["qty_approved"])

    for line in order.lines:
        product = db.query(Product).filter(Product.id == line.product_id).first()
        bal = db.query(StockBalance).filter(StockBalance.item_id == product.item_id).first()
        if not bal:
            bal = StockBalance(item_id=product.item_id, qty=Decimal("0.000"), reserved_qty=Decimal("0.000"))
            db.add(bal)
            db.flush()

        available = int(bal.qty - bal.reserved_qty)
        qty_to_approve = approval_map.get(line.product_id, line.qty_ordered)
        
        if qty_to_approve > available:
            raise ValueError(
                f"Cannot approve {qty_to_approve} packets for product {line.product_id}: only {available} available."
            )

        line.qty_approved = qty_to_approve
        bal.reserved_qty += Decimal(qty_to_approve)

    order.status = "APPROVED"
    db.flush()
    return order

def hold_order(db: Session, order_id: int, note: str = "Awaiting production") -> Order:
    """Places order on HOLD (status remains SUBMITTED with hold note)."""
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise ValueError(f"Order {order_id} not found")
    order.notes = f"{order.notes or ''} [HOLD: {note}]".strip()
    db.flush()
    return order

def reject_order(db: Session, order_id: int, reason: str) -> Order:
    """Rejects order with mandatory reason, releasing any reservations."""
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise ValueError(f"Order {order_id} not found")
    
    # If previously approved, release reservations
    if order.status == "APPROVED":
        for line in order.lines:
            product = db.query(Product).filter(Product.id == line.product_id).first()
            bal = db.query(StockBalance).filter(StockBalance.item_id == product.item_id).first()
            if bal and line.qty_approved > 0:
                bal.reserved_qty = max(Decimal("0.000"), bal.reserved_qty - Decimal(line.qty_approved))

    order.status = "REJECTED"
    order.notes = f"{order.notes or ''} [REJECTED: {reason}]".strip()
    db.flush()
    return order

def generate_invoice(
    db: Session,
    order_id: int,
    user_id: Optional[int] = None,
    invoice_date: Optional[datetime.date] = None
) -> Invoice:
    """
    Generates an immutable GST Invoice from an APPROVED order:
    1. Financial year numbering with row-locked counter: BTL/YYYY-YY/0001
    2. Intra-state vs Inter-state tax calculation per line using Decimal ROUND_HALF_UP.
    3. Summing rounded lines for invoice total.
    """
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise ValueError(f"Order {order_id} not found")
    if order.status != "APPROVED":
        raise ValueError(f"Cannot invoice order {order_id}: status is '{order.status}', must be 'APPROVED'")

    customer = db.query(Customer).filter(Customer.id == order.customer_id).first()
    settings = db.query(AppSettings).first()
    inv_date = invoice_date or datetime.date.today()
    fy = get_financial_year(inv_date)

    # Row-lock InvoiceCounter for gap-free sequence
    counter = db.query(InvoiceCounter).filter(InvoiceCounter.fy == fy).with_for_update().first()
    if not counter:
        counter = InvoiceCounter(fy=fy, last_seq=0)
        db.add(counter)
        db.flush()

    counter.last_seq += 1
    seq = counter.last_seq
    invoice_prefix = settings.invoice_prefix if settings else "BTL"
    invoice_no = f"{invoice_prefix}/{fy}/{seq:04d}"

    # Determine Place of Supply and Supply Type
    company_state = settings.company_state_code if settings else "33"
    customer_state = customer.state_code
    is_intra = (company_state == customer_state)
    supply_type = "INTRA" if is_intra else "INTER"

    tot_taxable = 0
    tot_cgst = 0
    tot_sgst = 0
    tot_igst = 0
    tot_amount = 0

    invoice = Invoice(
        invoice_no=invoice_no,
        fy=fy,
        seq=seq,
        order_id=order.id,
        customer_id=customer.id,
        customer_name=customer.name,
        customer_gstin=customer.gstin,
        customer_state_code=customer.state_code,
        customer_address=customer.address,
        place_of_supply_state=customer.state_code,
        supply_type=supply_type,
        status="POSTED",
        total_taxable_paise=0,
        total_cgst_paise=0,
        total_sgst_paise=0,
        total_igst_paise=0,
        total_amount_paise=0,
        created_at=utcnow(),
        created_by=user_id
    )
    db.add(invoice)
    db.flush()

    for line in order.lines:
        if line.qty_approved <= 0:
            continue
        product = db.query(Product).filter(Product.id == line.product_id).first()
        item = db.query(Item).filter(Item.id == product.item_id).first()

        qty = line.qty_approved
        rate_paise = line.price_paise_snapshot
        taxable_paise = qty * rate_paise
        gst_rate = item.gst_rate_pct  # e.g., Decimal("5.00")

        if is_intra:
            half_rate = gst_rate / Decimal("2")
            cgst_paise = round_paise((Decimal(taxable_paise) * half_rate) / Decimal("100"))
            sgst_paise = round_paise((Decimal(taxable_paise) * half_rate) / Decimal("100"))
            igst_paise = 0
        else:
            cgst_paise = 0
            sgst_paise = 0
            igst_paise = round_paise((Decimal(taxable_paise) * gst_rate) / Decimal("100"))

        line_total = taxable_paise + cgst_paise + sgst_paise + igst_paise

        inv_line = InvoiceLine(
            invoice_id=invoice.id,
            product_id=product.id,
            hsn=item.hsn or "2106",
            qty=qty,
            rate_paise=rate_paise,
            taxable_paise=taxable_paise,
            cgst_paise=cgst_paise,
            sgst_paise=sgst_paise,
            igst_paise=igst_paise,
            total_paise=line_total
        )
        db.add(inv_line)

        tot_taxable += taxable_paise
        tot_cgst += cgst_paise
        tot_sgst += sgst_paise
        tot_igst += igst_paise
        tot_amount += line_total

    invoice.total_taxable_paise = tot_taxable
    invoice.total_cgst_paise = tot_cgst
    invoice.total_sgst_paise = tot_sgst
    invoice.total_igst_paise = tot_igst
    invoice.total_amount_paise = tot_amount

    order.status = "INVOICED"
    db.flush()
    return invoice

def dispatch_invoice(
    db: Session,
    invoice_id: int,
    vehicle_no: Optional[str] = None,
    user_id: Optional[int] = None
) -> Dispatch:
    """
    Executes FEFO dispatch for an invoice:
    1. Selects batches ordered by expiry_date ASC, mfg_date ASC (skipping QUARANTINED/EXHAUSTED).
    2. Posts DISPATCH -qty to stock_ledger.
    3. Releases reservation on StockBalance.
    4. Sets Order status to DISPATCHED.
    """
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise ValueError(f"Invoice {invoice_id} not found")
    if invoice.status != "POSTED":
        raise ValueError(f"Cannot dispatch invoice {invoice_id}: status is '{invoice.status}'")

    order = db.query(Order).filter(Order.id == invoice.order_id).first()
    today_str = datetime.date.today().strftime("%y%m%d")
    count_today = db.query(Dispatch).count() + 1
    dispatch_no = f"DSP-{today_str}-{count_today:03d}"

    dispatch = Dispatch(
        dispatch_no=dispatch_no,
        invoice_id=invoice.id,
        date=datetime.date.today(),
        vehicle_no=vehicle_no,
        created_at=utcnow(),
        created_by=user_id
    )
    db.add(dispatch)
    db.flush()

    for line in invoice.lines:
        product = db.query(Product).filter(Product.id == line.product_id).first()
        fg_item_id = product.item_id
        qty_needed = line.qty

        # FEFO query for Finished Goods batches
        batches_avail = db.query(BatchBalance).join(Batch).filter(
            and_(
                BatchBalance.item_id == fg_item_id,
                BatchBalance.qty > 0,
                Batch.status == "ACTIVE"
            )
        ).order_by(Batch.expiry_date.asc(), Batch.mfg_date.asc()).all()

        remaining = Decimal(qty_needed)
        for bbal in batches_avail:
            if remaining <= Decimal("0.000"):
                break
            take_qty = min(remaining, bbal.qty)

            # Record dispatch line
            dline = DispatchLine(
                dispatch_id=dispatch.id,
                product_id=product.id,
                fg_batch_id=bbal.batch_id,
                qty=int(take_qty)
            )
            db.add(dline)

            # Post ledger DISPATCH
            post_movement(
                db=db,
                item_id=fg_item_id,
                batch_id=bbal.batch_id,
                qty_delta=-take_qty,
                movement_type="DISPATCH",
                source_type="DISPATCH",
                source_id=dispatch.id,
                user_id=user_id,
                note=f"Dispatch {dispatch.dispatch_no} for Invoice {invoice.invoice_no}"
            )

            remaining -= take_qty

        if remaining > Decimal("0.000"):
            raise ValueError(f"Insufficient stock for dispatch of product {product.id}: short by {remaining}")

        # Consume reservation on StockBalance
        bal = db.query(StockBalance).filter(StockBalance.item_id == fg_item_id).first()
        if bal:
            bal.reserved_qty = max(Decimal("0.000"), bal.reserved_qty - Decimal(qty_needed))

    order.status = "DISPATCHED"
    db.flush()
    return dispatch

def record_payment(
    db: Session,
    customer_id: int,
    amount_paise: int,
    mode: str = "UPI",
    ref: Optional[str] = None,
    date: Optional[datetime.date] = None,
    invoice_allocations: Optional[List[Dict[str, Any]]] = None,
    user_id: Optional[int] = None
) -> Payment:
    """
    Records payment and allocates to outstanding invoices (or auto oldest-first).
    Any unallocated amount is customer advance.
    """
    if amount_paise <= 0:
        raise ValueError("Payment amount must be greater than zero")

    today_str = datetime.date.today().strftime("%y%m%d")
    count_today = db.query(Payment).count() + 1
    payment_no = f"PAY-{today_str}-{count_today:03d}"

    payment = Payment(
        payment_no=payment_no,
        customer_id=customer_id,
        amount_paise=amount_paise,
        mode=mode,
        ref=ref,
        date=date or datetime.date.today(),
        created_at=utcnow(),
        created_by=user_id
    )
    db.add(payment)
    db.flush()

    allocated_total = 0
    if invoice_allocations:
        for alloc in invoice_allocations:
            inv_id = alloc["invoice_id"]
            amt = int(alloc["amount_paise"])
            pa = PaymentAllocation(
                payment_id=payment.id,
                invoice_id=inv_id,
                amount_paise=amt
            )
            db.add(pa)
            allocated_total += amt
    else:
        # Automatic oldest-first allocation
        unallocated = amount_paise
        invoices = db.query(Invoice).filter(
            and_(Invoice.customer_id == customer_id, Invoice.status == "POSTED")
        ).order_by(Invoice.created_at.asc()).all()

        for inv in invoices:
            if unallocated <= 0:
                break
            # Calculate current paid for this invoice
            paid_sum = db.query(func.coalesce(func.sum(PaymentAllocation.amount_paise), 0)).filter(
                PaymentAllocation.invoice_id == inv.id
            ).scalar()
            
            # Check credit notes
            cn_sum = db.query(func.coalesce(func.sum(CreditNote.amount_paise), 0)).filter(
                CreditNote.invoice_id == inv.id
            ).scalar()

            outstanding = inv.total_amount_paise - paid_sum - cn_sum
            if outstanding > 0:
                alloc_amt = min(unallocated, outstanding)
                pa = PaymentAllocation(
                    payment_id=payment.id,
                    invoice_id=inv.id,
                    amount_paise=alloc_amt
                )
                db.add(pa)
                unallocated -= alloc_amt
                allocated_total += alloc_amt

    db.flush()
    return payment

def get_customer_outstanding(db: Session, customer_id: int) -> Dict[str, Any]:
    """
    Computes customer outstanding:
    Invoice outstanding = invoice total - credit notes - allocations.
    Customer outstanding = sum over non-cancelled invoices minus advances.
    Ageing buckets: 0-30, 31-60, 61-90, 90+ days.
    """
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise ValueError(f"Customer {customer_id} not found")

    invoices = db.query(Invoice).filter(
        and_(Invoice.customer_id == customer_id, Invoice.status == "POSTED")
    ).all()

    total_invoiced = 0
    total_allocated = 0
    total_credit_notes = 0
    invoice_list = []

    today = datetime.date.today()
    ageing = {"0_30": 0, "31_60": 0, "61_90": 0, "90_plus": 0}

    for inv in invoices:
        paid = db.query(func.coalesce(func.sum(PaymentAllocation.amount_paise), 0)).filter(
            PaymentAllocation.invoice_id == inv.id
        ).scalar()
        cn = db.query(func.coalesce(func.sum(CreditNote.amount_paise), 0)).filter(
            CreditNote.invoice_id == inv.id
        ).scalar()
        out = inv.total_amount_paise - paid - cn

        total_invoiced += inv.total_amount_paise
        total_allocated += paid
        total_credit_notes += cn

        # Ageing
        inv_date = inv.created_at.date() if isinstance(inv.created_at, datetime.datetime) else inv.created_at
        days_old = (today - inv_date).days

        if out > 0:
            if days_old <= 30:
                ageing["0_30"] += out
            elif days_old <= 60:
                ageing["31_60"] += out
            elif days_old <= 90:
                ageing["61_90"] += out
            else:
                ageing["90_plus"] += out

        invoice_list.append({
            "invoice_id": inv.id,
            "invoice_no": inv.invoice_no,
            "date": str(inv_date),
            "total_paise": inv.total_amount_paise,
            "paid_paise": paid,
            "credit_note_paise": cn,
            "outstanding_paise": out,
            "days_old": days_old
        })

    # Total payments made by customer
    total_paid_customer = db.query(func.coalesce(func.sum(Payment.amount_paise), 0)).filter(
        Payment.customer_id == customer_id
    ).scalar()

    advances = max(0, total_paid_customer - total_allocated)
    net_outstanding = max(0, (total_invoiced - total_credit_notes - total_allocated) - advances)

    return {
        "customer_id": customer.id,
        "customer_name": customer.name,
        "total_invoiced_paise": total_invoiced,
        "total_paid_paise": total_paid_customer,
        "total_credit_notes_paise": total_credit_notes,
        "customer_advance_paise": advances,
        "net_outstanding_paise": net_outstanding,
        "ageing": ageing,
        "invoices": invoice_list
    }
