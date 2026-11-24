from pydantic import BaseModel, ConfigDict
from typing import Optional, List, Any
from decimal import Decimal
import datetime

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    username: str
    role: str

class LoginRequest(BaseModel):
    username: str
    password: str

class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    username: str
    role: str
    is_active: bool

# Masters Schemas
class ItemCreate(BaseModel):
    name: str
    type: str  # RAW, PACK, FG
    base_uom: str
    display_uom: str
    hsn: Optional[str] = None
    gst_rate_pct: Decimal = Decimal("5.00")
    shelf_life_days: int = 90
    reorder_level: Decimal = Decimal("0.000")

class ItemResponse(ItemCreate):
    model_config = ConfigDict(from_attributes=True)
    id: int
    moving_avg_cost_paise: Decimal
    is_active: bool

class ProductCreate(BaseModel):
    item_id: int
    pack_size_label: str
    pack_size_g: Decimal
    family_id: str
    price_paise: int

class ProductResponse(ProductCreate):
    model_config = ConfigDict(from_attributes=True)
    id: int
    is_active: bool

class CustomerCreate(BaseModel):
    name: str
    type: str = "RETAILER"
    gstin: Optional[str] = None
    state_code: str
    address: str
    assigned_salesman_id: Optional[int] = None
    credit_days: int = 30

class CustomerResponse(CustomerCreate):
    model_config = ConfigDict(from_attributes=True)
    id: int
    is_active: bool

class SupplierCreate(BaseModel):
    name: str
    gstin: Optional[str] = None
    state_code: str = "33"
    phone: Optional[str] = None

class SupplierResponse(SupplierCreate):
    model_config = ConfigDict(from_attributes=True)
    id: int
    is_active: bool

# Purchases Schemas
class PurchaseLineCreate(BaseModel):
    item_id: int
    qty: Decimal
    rate_paise_per_base: Decimal
    supplier_lot_no: Optional[str] = None
    expiry_date: Optional[datetime.date] = None

class PurchaseCreate(BaseModel):
    supplier_id: int
    purchase_no: str
    date: datetime.date = datetime.date.today()
    lines: List[PurchaseLineCreate]
    notes: Optional[str] = None

# Production Schemas
class PlannedRunCreate(BaseModel):
    product_id: int
    batch_multiplier: Decimal = Decimal("1.00")
    supervisor_id: Optional[int] = None
    shift: str = "Day"

class RawIssueItem(BaseModel):
    item_id: int
    issued_qty: Decimal
    batch_id: Optional[int] = None

class RunIssueRequest(BaseModel):
    raw_issues: List[RawIssueItem]

class PackConsumptionItem(BaseModel):
    item_id: int
    used_qty: Decimal
    damaged_qty: Decimal = Decimal("0.000")

class OverheadItem(BaseModel):
    type: str
    amount_paise: int

class RunCompleteRequest(BaseModel):
    actual_good_output: int
    pack_consumptions: List[PackConsumptionItem]
    overheads: List[OverheadItem]

# Orders Schemas
class OrderLineCreate(BaseModel):
    product_id: int
    qty_ordered: int
    price_paise: Optional[int] = None
    price_edit_reason: Optional[str] = None

class OrderCreate(BaseModel):
    client_uuid: str
    customer_id: int
    lines: List[OrderLineCreate]
    notes: Optional[str] = None

class ApproveLineItem(BaseModel):
    product_id: int
    qty_approved: int

class OrderApproveRequest(BaseModel):
    approved_lines: Optional[List[ApproveLineItem]] = None

class OrderRejectRequest(BaseModel):
    reason: str

class OrderHoldRequest(BaseModel):
    note: str = "Awaiting production"

# Payment Schemas
class PaymentAllocationItem(BaseModel):
    invoice_id: int
    amount_paise: int

class PaymentCreate(BaseModel):
    customer_id: int
    amount_paise: int
    mode: str = "UPI"
    ref: Optional[str] = None
    date: datetime.date = datetime.date.today()
    allocations: Optional[List[PaymentAllocationItem]] = None

# What-if Schemas
class WhatIfRequest(BaseModel):
    product_id: int
    selling_price_delta_paise: int = 0
    input_price_pct_change: Decimal = Decimal("0.00")
    yield_override: Optional[int] = None
    extra_demand_packets: int = 0
    overhead_per_run_paise: int = 0
