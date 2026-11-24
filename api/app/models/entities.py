import datetime
from decimal import Decimal
from sqlalchemy import (
    Column, Integer, String, BigInteger, Numeric, Boolean, DateTime, Date,
    ForeignKey, Text, CheckConstraint, UniqueConstraint, Index
)
from sqlalchemy.orm import relationship
from api.app.db import Base

def utcnow():
    return datetime.datetime.now(datetime.timezone.utc)

# ----------------- MASTERS -----------------

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(20), nullable=False)  # SALESMAN, ADMIN, PRODUCTION, AUDITOR, OWNER
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)


class AppSettings(Base):
    __tablename__ = "settings"
    id = Column(Integer, primary_key=True)
    company_name = Column(String(100), default="Batchly Foods Private Limited", nullable=False)
    company_gstin = Column(String(15), default="33AABCB1234F1Z5", nullable=False)
    company_state_code = Column(String(2), default="33", nullable=False)
    company_address = Column(Text, default="Plot 42, SIDCO Industrial Estate, Thuvakudi, Tiruchirappalli, Tamil Nadu 620015", nullable=False)
    fy_start_month = Column(Integer, default=4, nullable=False)
    invoice_prefix = Column(String(10), default="BTL", nullable=False)
    variance_tolerance_pct = Column(Numeric(5, 2), default=Decimal("3.00"), nullable=False)
    fg_safety_packets = Column(Integer, default=20, nullable=False)
    invoice_round_off = Column(Boolean, default=False, nullable=False)


class Item(Base):
    __tablename__ = "items"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, index=True)
    type = Column(String(10), nullable=False)  # RAW, PACK, FG
    base_uom = Column(String(20), nullable=False)  # g, ml, pcs, packet
    display_uom = Column(String(20), nullable=False)  # kg, L, pcs, carton, packet
    hsn = Column(String(10), nullable=True)
    gst_rate_pct = Column(Numeric(5, 2), default=Decimal("5.00"), nullable=False)
    shelf_life_days = Column(Integer, default=90, nullable=False)
    reorder_level = Column(Numeric(14, 3), default=Decimal("0.000"), nullable=False)
    moving_avg_cost_paise = Column(Numeric(18, 6), default=Decimal("0.000000"), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)


class UomConversion(Base):
    __tablename__ = "uom_conversions"
    id = Column(Integer, primary_key=True)
    item_id = Column(Integer, ForeignKey("items.id"), nullable=True)
    from_uom = Column(String(20), nullable=False)
    to_uom = Column(String(20), nullable=False)
    factor = Column(Numeric(14, 6), nullable=False)


class Product(Base):
    __tablename__ = "products"
    id = Column(Integer, primary_key=True, index=True)
    item_id = Column(Integer, ForeignKey("items.id"), nullable=False, unique=True)
    pack_size_label = Column(String(50), nullable=False)  # e.g., "200 g" or "500 g"
    pack_size_g = Column(Numeric(10, 2), nullable=False)  # 200 or 500
    family_id = Column(String(50), nullable=False, index=True)  # "MURUKKU_CLASSIC"
    price_paise = Column(BigInteger, nullable=False)  # default list price in paise
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    item = relationship("Item", foreign_keys=[item_id])


class PriceList(Base):
    __tablename__ = "price_lists"
    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)


class PriceListItem(Base):
    __tablename__ = "price_list_items"
    id = Column(Integer, primary_key=True)
    price_list_id = Column(Integer, ForeignKey("price_lists.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    price_paise = Column(BigInteger, nullable=False)
    valid_from = Column(Date, default=datetime.date.today, nullable=False)


class CustomerPrice(Base):
    __tablename__ = "customer_prices"
    id = Column(Integer, primary_key=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    price_paise = Column(BigInteger, nullable=False)


class Customer(Base):
    __tablename__ = "customers"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    type = Column(String(20), default="RETAILER", nullable=False)  # RETAILER, DISTRIBUTOR
    gstin = Column(String(15), nullable=True)
    state_code = Column(String(2), nullable=False)  # "33", "29", etc.
    address = Column(Text, nullable=False)
    assigned_salesman_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    credit_days = Column(Integer, default=30, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)


class Supplier(Base):
    __tablename__ = "suppliers"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    gstin = Column(String(15), nullable=True)
    state_code = Column(String(2), default="33", nullable=False)
    phone = Column(String(20), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)


class BOM(Base):
    __tablename__ = "boms"
    id = Column(Integer, primary_key=True)
    product_family_id = Column(String(50), nullable=False, index=True)
    version = Column(Integer, default=1, nullable=False)
    batch_output_g = Column(Numeric(14, 3), default=Decimal("40000.000"), nullable=False)
    expected_yield_packets = Column(Integer, default=200, nullable=False)
    output_item_id = Column(Integer, ForeignKey("items.id"), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    effective_from = Column(Date, default=datetime.date.today, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    lines = relationship("BOMLine", back_populates="bom", cascade="all, delete-orphan")


class BOMLine(Base):
    __tablename__ = "bom_lines"
    id = Column(Integer, primary_key=True)
    bom_id = Column(Integer, ForeignKey("boms.id"), nullable=False)
    item_id = Column(Integer, ForeignKey("items.id"), nullable=False)
    qty_per_batch = Column(Numeric(14, 3), nullable=False)  # in base unit (g, ml, pcs)
    line_type = Column(String(10), nullable=False)  # RAW, PACK
    basis = Column(String(20), default="PER_BATCH", nullable=False)  # PER_BATCH, PER_PACKET, PER_CARTON

    bom = relationship("BOM", back_populates="lines")
    item = relationship("Item")


# ----------------- TRANSACTIONS: PURCHASES & BATCHES -----------------

class Purchase(Base):
    __tablename__ = "purchases"
    id = Column(Integer, primary_key=True, index=True)
    purchase_no = Column(String(50), unique=True, nullable=False)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=False)
    date = Column(Date, default=datetime.date.today, nullable=False)
    status = Column(String(20), default="DRAFT", nullable=False)  # DRAFT, POSTED, CANCELLED
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    lines = relationship("PurchaseLine", back_populates="purchase", cascade="all, delete-orphan")
    supplier = relationship("Supplier")


class PurchaseLine(Base):
    __tablename__ = "purchase_lines"
    id = Column(Integer, primary_key=True)
    purchase_id = Column(Integer, ForeignKey("purchases.id"), nullable=False)
    item_id = Column(Integer, ForeignKey("items.id"), nullable=False)
    qty = Column(Numeric(14, 3), nullable=False)  # base unit
    rate_paise_per_base = Column(Numeric(18, 6), nullable=False)  # paise per base unit (e.g. 4.5 paise/g)
    supplier_lot_no = Column(String(50), nullable=True)
    expiry_date = Column(Date, nullable=True)
    batch_id = Column(Integer, ForeignKey("batches.id"), nullable=True)

    purchase = relationship("Purchase", back_populates="lines")
    item = relationship("Item")


class Batch(Base):
    __tablename__ = "batches"
    id = Column(Integer, primary_key=True, index=True)
    batch_no = Column(String(50), unique=True, nullable=False, index=True)
    item_id = Column(Integer, ForeignKey("items.id"), nullable=False)
    source_type = Column(String(20), nullable=False)  # PURCHASE, OPENING, PRODUCTION
    source_id = Column(Integer, nullable=True)
    mfg_date = Column(Date, default=datetime.date.today, nullable=False)
    expiry_date = Column(Date, nullable=True)
    status = Column(String(20), default="ACTIVE", nullable=False)  # ACTIVE, QUARANTINED, EXHAUSTED
    unit_cost_paise = Column(Numeric(18, 6), default=Decimal("0.000000"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    item = relationship("Item")


# ----------------- TRANSACTIONS: PRODUCTION -----------------

class ProductionRun(Base):
    __tablename__ = "production_runs"
    id = Column(Integer, primary_key=True, index=True)
    run_no = Column(String(50), unique=True, nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    bom_id = Column(Integer, ForeignKey("boms.id"), nullable=False)
    batch_multiplier = Column(Numeric(5, 2), default=Decimal("1.00"), nullable=False)
    expected_output = Column(Integer, default=200, nullable=False)
    actual_good_output = Column(Integer, default=0, nullable=False)
    status = Column(String(20), default="PLANNED", nullable=False)  # PLANNED, IN_PROGRESS, COMPLETED, REVERSED
    fg_batch_id = Column(Integer, ForeignKey("batches.id"), nullable=True)
    supervisor_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    shift = Column(String(20), default="Day", nullable=False)
    cost_per_packet_paise = Column(Numeric(18, 6), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    product = relationship("Product")
    bom = relationship("BOM")
    consumption = relationship("RunConsumption", back_populates="run", cascade="all, delete-orphan")
    overheads = relationship("RunOverhead", back_populates="run", cascade="all, delete-orphan")


class RunConsumption(Base):
    __tablename__ = "run_consumption"
    id = Column(Integer, primary_key=True)
    run_id = Column(Integer, ForeignKey("production_runs.id"), nullable=False)
    item_id = Column(Integer, ForeignKey("items.id"), nullable=False)
    batch_id = Column(Integer, ForeignKey("batches.id"), nullable=True)
    planned_qty = Column(Numeric(14, 3), nullable=False)
    issued_qty = Column(Numeric(14, 3), default=Decimal("0.000"), nullable=False)
    damaged_qty = Column(Numeric(14, 3), default=Decimal("0.000"), nullable=False)
    returned_qty = Column(Numeric(14, 3), default=Decimal("0.000"), nullable=False)
    actual_consumed_qty = Column(Numeric(14, 3), default=Decimal("0.000"), nullable=False)
    variance_pct = Column(Numeric(8, 4), default=Decimal("0.0000"), nullable=False)
    flagged = Column(Boolean, default=False, nullable=False)

    run = relationship("ProductionRun", back_populates="consumption")
    item = relationship("Item")
    batch = relationship("Batch")


class RunOverhead(Base):
    __tablename__ = "run_overheads"
    id = Column(Integer, primary_key=True)
    run_id = Column(Integer, ForeignKey("production_runs.id"), nullable=False)
    type = Column(String(50), nullable=False)  # LABOUR, GAS_POWER, OTHER
    amount_paise = Column(BigInteger, nullable=False)

    run = relationship("ProductionRun", back_populates="overheads")


# ----------------- STOCK LEDGER & CACHES (INVARIANTS I1, I2, I3) -----------------

class StockLedger(Base):
    __tablename__ = "stock_ledger"
    id = Column(Integer, primary_key=True, index=True)
    item_id = Column(Integer, ForeignKey("items.id"), nullable=False, index=True)
    batch_id = Column(Integer, ForeignKey("batches.id"), nullable=True, index=True)
    qty_delta = Column(Numeric(14, 3), nullable=False)  # +in, -out in base unit
    movement_type = Column(String(30), nullable=False)  # OPENING, PURCHASE, ISSUE, RETURN_TO_STOCK, SCRAP, PRODUCTION_IN, DISPATCH, SALES_RETURN, ADJUSTMENT, REVERSAL
    source_type = Column(String(50), nullable=False)
    source_id = Column(Integer, nullable=True)
    unit_cost_snapshot = Column(Numeric(18, 6), nullable=True)  # paise per base unit
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    ts = Column(DateTime(timezone=True), default=utcnow, nullable=False, index=True)
    note = Column(Text, nullable=True)
    prev_hash = Column(String(64), nullable=True)
    hash = Column(String(64), nullable=True)


class StockBalance(Base):
    __tablename__ = "stock_balance"
    id = Column(Integer, primary_key=True)
    item_id = Column(Integer, ForeignKey("items.id"), unique=True, nullable=False)
    qty = Column(Numeric(14, 3), default=Decimal("0.000"), nullable=False)
    reserved_qty = Column(Numeric(14, 3), default=Decimal("0.000"), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)

    __table_args__ = (
        CheckConstraint("qty >= 0", name="chk_stock_balance_positive"),
        CheckConstraint("reserved_qty >= 0", name="chk_stock_balance_reserved_positive"),
    )


class BatchBalance(Base):
    __tablename__ = "batch_balance"
    id = Column(Integer, primary_key=True)
    item_id = Column(Integer, ForeignKey("items.id"), nullable=False)
    batch_id = Column(Integer, ForeignKey("batches.id"), unique=True, nullable=False)
    qty = Column(Numeric(14, 3), default=Decimal("0.000"), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)

    __table_args__ = (
        CheckConstraint("qty >= 0", name="chk_batch_balance_positive"),
    )


# ----------------- SALES, GST BILLING & DISPATCH -----------------

class Order(Base):
    __tablename__ = "orders"
    id = Column(Integer, primary_key=True, index=True)
    order_no = Column(String(50), unique=True, nullable=False, index=True)
    client_uuid = Column(String(64), unique=True, nullable=False, index=True)  # Idempotency I10
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    salesman_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(String(30), default="SUBMITTED", nullable=False)  # SUBMITTED, APPROVED, REJECTED, INVOICED, PARTIALLY_DISPATCHED, DISPATCHED, CANCELLED
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    customer = relationship("Customer")
    salesman = relationship("User", foreign_keys=[salesman_id])
    lines = relationship("OrderLine", back_populates="order", cascade="all, delete-orphan")


class OrderLine(Base):
    __tablename__ = "order_lines"
    id = Column(Integer, primary_key=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    qty_ordered = Column(Integer, nullable=False)  # whole packets
    qty_approved = Column(Integer, default=0, nullable=False)
    price_paise_snapshot = Column(BigInteger, nullable=False)
    price_edit_reason = Column(String(255), nullable=True)

    order = relationship("Order", back_populates="lines")
    product = relationship("Product")


class Invoice(Base):
    __tablename__ = "invoices"
    id = Column(Integer, primary_key=True, index=True)
    invoice_no = Column(String(50), unique=True, nullable=False, index=True)  # BTL/2026-27/0001
    fy = Column(String(10), nullable=False, index=True)  # "2026-27"
    seq = Column(Integer, nullable=False)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    customer_name = Column(String(100), nullable=False)
    customer_gstin = Column(String(15), nullable=True)
    customer_state_code = Column(String(2), nullable=False)
    customer_address = Column(Text, nullable=False)
    place_of_supply_state = Column(String(2), nullable=False)
    supply_type = Column(String(10), nullable=False)  # INTRA, INTER
    status = Column(String(20), default="POSTED", nullable=False)  # POSTED, CANCELLED
    total_taxable_paise = Column(BigInteger, nullable=False)
    total_cgst_paise = Column(BigInteger, default=0, nullable=False)
    total_sgst_paise = Column(BigInteger, default=0, nullable=False)
    total_igst_paise = Column(BigInteger, default=0, nullable=False)
    total_amount_paise = Column(BigInteger, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    order = relationship("Order")
    customer = relationship("Customer")
    lines = relationship("InvoiceLine", back_populates="invoice", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("fy", "seq", name="uq_invoice_fy_seq"),
    )


class InvoiceLine(Base):
    __tablename__ = "invoice_lines"
    id = Column(Integer, primary_key=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    hsn = Column(String(10), nullable=False)
    qty = Column(Integer, nullable=False)
    rate_paise = Column(BigInteger, nullable=False)
    taxable_paise = Column(BigInteger, nullable=False)
    cgst_paise = Column(BigInteger, default=0, nullable=False)
    sgst_paise = Column(BigInteger, default=0, nullable=False)
    igst_paise = Column(BigInteger, default=0, nullable=False)
    total_paise = Column(BigInteger, nullable=False)

    invoice = relationship("Invoice", back_populates="lines")
    product = relationship("Product")


class CreditNote(Base):
    __tablename__ = "credit_notes"
    id = Column(Integer, primary_key=True, index=True)
    cn_no = Column(String(50), unique=True, nullable=False)
    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=False)
    reason = Column(Text, nullable=False)
    restock = Column(Boolean, default=True, nullable=False)
    amount_paise = Column(BigInteger, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    invoice = relationship("Invoice")


class Dispatch(Base):
    __tablename__ = "dispatches"
    id = Column(Integer, primary_key=True, index=True)
    dispatch_no = Column(String(50), unique=True, nullable=False)
    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=False)
    date = Column(Date, default=datetime.date.today, nullable=False)
    vehicle_no = Column(String(30), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    invoice = relationship("Invoice")
    lines = relationship("DispatchLine", back_populates="dispatch", cascade="all, delete-orphan")


class DispatchLine(Base):
    __tablename__ = "dispatch_lines"
    id = Column(Integer, primary_key=True)
    dispatch_id = Column(Integer, ForeignKey("dispatches.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    fg_batch_id = Column(Integer, ForeignKey("batches.id"), nullable=False)
    qty = Column(Integer, nullable=False)  # packets

    dispatch = relationship("Dispatch", back_populates="lines")
    batch = relationship("Batch")


class Payment(Base):
    __tablename__ = "payments"
    id = Column(Integer, primary_key=True, index=True)
    payment_no = Column(String(50), unique=True, nullable=False)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    amount_paise = Column(BigInteger, nullable=False)
    mode = Column(String(30), default="UPI", nullable=False)  # cash, UPI, bank, cheque
    ref = Column(String(100), nullable=True)
    date = Column(Date, default=datetime.date.today, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    allocations = relationship("PaymentAllocation", back_populates="payment", cascade="all, delete-orphan")


class PaymentAllocation(Base):
    __tablename__ = "payment_allocations"
    id = Column(Integer, primary_key=True)
    payment_id = Column(Integer, ForeignKey("payments.id"), nullable=False)
    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=False)
    amount_paise = Column(BigInteger, nullable=False)

    payment = relationship("Payment", back_populates="allocations")
    invoice = relationship("Invoice")


class MonthlyOverhead(Base):
    __tablename__ = "overheads_monthly"
    id = Column(Integer, primary_key=True)
    month = Column(String(7), nullable=False)  # "YYYY-MM"
    type = Column(String(50), nullable=False)
    amount_paise = Column(BigInteger, nullable=False)


class InvoiceCounter(Base):
    __tablename__ = "invoice_counters"
    id = Column(Integer, primary_key=True)
    fy = Column(String(10), unique=True, nullable=False)  # "2026-27"
    last_seq = Column(Integer, default=0, nullable=False)


# ----------------- AUDIT & INTELLIGENCE -----------------

class AuditLog(Base):
    __tablename__ = "audit_log"
    id = Column(Integer, primary_key=True, index=True)
    entity = Column(String(50), nullable=False, index=True)
    entity_id = Column(Integer, nullable=False)
    action = Column(String(50), nullable=False)  # CREATE, UPDATE, APPROVE, REJECT, CANCEL, POST, ADJUST
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    ts = Column(DateTime(timezone=True), default=utcnow, nullable=False, index=True)
    before_json = Column(Text, nullable=True)
    after_json = Column(Text, nullable=True)
    reason = Column(Text, nullable=True)
    flags = Column(Text, nullable=True)  # Comma-separated or JSON list of flags
    prev_hash = Column(String(64), nullable=True)
    hash = Column(String(64), nullable=True)


class InsightEvent(Base):
    __tablename__ = "insight_events"
    id = Column(Integer, primary_key=True, index=True)
    type = Column(String(50), nullable=False)  # VARIANCE, OVERCONSUMPTION, YIELD_DRIFT, OUTLIER, etc.
    severity = Column(String(20), default="INFO", nullable=False)  # INFO, WARN, CRITICAL
    entity = Column(String(50), nullable=False)
    entity_id = Column(Integer, nullable=True)
    message = Column(Text, nullable=False)
    evidence_json = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    acknowledged_by = Column(Integer, ForeignKey("users.id"), nullable=True)
