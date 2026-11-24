import pytest
import datetime
from decimal import Decimal
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from api.app.db import Base
from api.app.models.entities import (
    User, AppSettings, Item, Product, Customer, Supplier, BOM, BOMLine,
    Batch, StockBalance, BatchBalance, ProductionRun, RunConsumption,
    Order, OrderLine, Invoice, InvoiceLine, Dispatch, DispatchLine,
    Payment, PaymentAllocation
)
from api.app.services.ledger_service import post_movement, init_db_triggers, reconcile_balances
from api.app.services.purchase_service import post_purchase
from api.app.services.production_service import (
    create_planned_run, start_and_issue_run, complete_production_run
)
from api.app.services.sales_service import (
    create_order, approve_order, hold_order, generate_invoice,
    dispatch_invoice, record_payment, get_customer_outstanding,
    check_order_stock
)
from api.app.models.entities import Purchase, PurchaseLine

@pytest.fixture
def db():
    engine = create_engine("sqlite:///:memory:")
    TestingSession = sessionmaker(bind=engine)
    Base.metadata.create_all(bind=engine)
    session = TestingSession()
    init_db_triggers(session)
    yield session
    session.close()

def test_full_benchmark_flow(db):
    """
    Executes and asserts the exact PRD Section 11 benchmark numbers.
    GATE 1 REQUIREMENT: Must match 100%.
    """
    # 0. Setup masters & opening stock
    settings = AppSettings(
        company_name="Batchly Foods Private Limited",
        company_gstin="33AABCB1234F1Z5",
        company_state_code="33",
        variance_tolerance_pct=Decimal("3.00"),
        fg_safety_packets=20
    )
    db.add(settings)

    admin = User(username="admin", password_hash="hash", role="ADMIN")
    salesman_a = User(username="salesman_a", password_hash="hash", role="SALESMAN")
    salesman_b = User(username="salesman_b", password_hash="hash", role="SALESMAN")
    db.add_all([admin, salesman_a, salesman_b])
    db.flush()

    flour = Item(name="Flour", type="RAW", base_uom="g", display_uom="kg", hsn="1101", moving_avg_cost_paise=Decimal("4.200000"))
    oil = Item(name="Oil", type="RAW", base_uom="ml", display_uom="L", hsn="1512", moving_avg_cost_paise=Decimal("14.000000"))
    spice = Item(name="Spice Mix", type="RAW", base_uom="g", display_uom="kg", hsn="0910", moving_avg_cost_paise=Decimal("20.000000"))
    pouches = Item(name="Pouches", type="PACK", base_uom="pcs", display_uom="pcs", hsn="3923", moving_avg_cost_paise=Decimal("250.000000"))
    cartons = Item(name="Cartons", type="PACK", base_uom="pcs", display_uom="pcs", hsn="4819", moving_avg_cost_paise=Decimal("1500.000000"))
    fg_item = Item(name="Murukku 200g", type="FG", base_uom="packet", display_uom="packet", hsn="2106", gst_rate_pct=Decimal("5.00"), moving_avg_cost_paise=Decimal("1985.000000"))
    db.add_all([flour, oil, spice, pouches, cartons, fg_item])
    db.flush()

    product = Product(item_id=fg_item.id, pack_size_label="Murukku 200 g", pack_size_g=Decimal("200.00"), family_id="MURUKKU_CLASSIC", price_paise=5000)
    db.add(product)
    db.flush()

    supplier = Supplier(name="Trichy Agro", gstin="33AAACT9999Z1Z8", state_code="33")
    retailer_a = Customer(name="Retailer A", state_code="33", address="Madurai", assigned_salesman_id=salesman_a.id)
    distributor_b = Customer(name="Distributor B", state_code="29", address="Bengaluru", assigned_salesman_id=salesman_b.id)
    db.add_all([supplier, retailer_a, distributor_b])
    db.flush()

    bom = BOM(product_family_id="MURUKKU_CLASSIC", batch_output_g=Decimal("40000.000"), expected_yield_packets=200, output_item_id=fg_item.id)
    db.add(bom)
    db.flush()
    bom_lines = [
        BOMLine(bom_id=bom.id, item_id=flour.id, qty_per_batch=Decimal("40000.000"), line_type="RAW", basis="PER_BATCH"),
        BOMLine(bom_id=bom.id, item_id=oil.id, qty_per_batch=Decimal("10000.000"), line_type="RAW", basis="PER_BATCH"),
        BOMLine(bom_id=bom.id, item_id=spice.id, qty_per_batch=Decimal("1200.000"), line_type="RAW", basis="PER_BATCH"),
        BOMLine(bom_id=bom.id, item_id=pouches.id, qty_per_batch=Decimal("1.000"), line_type="PACK", basis="PER_PACKET"),
        BOMLine(bom_id=bom.id, item_id=cartons.id, qty_per_batch=Decimal("1.000"), line_type="PACK", basis="PER_CARTON"),
    ]
    db.add_all(bom_lines)
    db.flush()

    today = datetime.date.today()
    b_flour = Batch(batch_no="OPEN-FLOUR-001", item_id=flour.id, source_type="OPENING", mfg_date=today, expiry_date=today + datetime.timedelta(days=90), status="ACTIVE", unit_cost_paise=Decimal("4.200000"))
    b_oil = Batch(batch_no="OPEN-OIL-001", item_id=oil.id, source_type="OPENING", mfg_date=today, expiry_date=today + datetime.timedelta(days=90), status="ACTIVE", unit_cost_paise=Decimal("14.000000"))
    b_spice = Batch(batch_no="OPEN-SPICE-001", item_id=spice.id, source_type="OPENING", mfg_date=today, expiry_date=today + datetime.timedelta(days=90), status="ACTIVE", unit_cost_paise=Decimal("20.000000"))
    b_pouches = Batch(batch_no="OPEN-POUCHES-001", item_id=pouches.id, source_type="OPENING", mfg_date=today, expiry_date=today + datetime.timedelta(days=180), status="ACTIVE", unit_cost_paise=Decimal("250.000000"))
    b_cartons = Batch(batch_no="OPEN-CARTONS-001", item_id=cartons.id, source_type="OPENING", mfg_date=today, expiry_date=today + datetime.timedelta(days=180), status="ACTIVE", unit_cost_paise=Decimal("1500.000000"))
    b_fg = Batch(batch_no="OPEN-FG-001", item_id=fg_item.id, source_type="OPENING", mfg_date=today - datetime.timedelta(days=5), expiry_date=today + datetime.timedelta(days=20), status="ACTIVE", unit_cost_paise=Decimal("1985.000000"))
    db.add_all([b_flour, b_oil, b_spice, b_pouches, b_cartons, b_fg])
    db.flush()

    post_movement(db, flour.id, b_flour.id, Decimal("100000.000"), "OPENING", "OPENING", None, admin.id, Decimal("4.200000"))
    post_movement(db, oil.id, b_oil.id, Decimal("30000.000"), "OPENING", "OPENING", None, admin.id, Decimal("14.000000"))
    post_movement(db, spice.id, b_spice.id, Decimal("5000.000"), "OPENING", "OPENING", None, admin.id, Decimal("20.000000"))
    post_movement(db, pouches.id, b_pouches.id, Decimal("500.000"), "OPENING", "OPENING", None, admin.id, Decimal("250.000000"))
    post_movement(db, cartons.id, b_cartons.id, Decimal("30.000"), "OPENING", "OPENING", None, admin.id, Decimal("1500.000000"))
    post_movement(db, fg_item.id, b_fg.id, Decimal("50.000"), "OPENING", "OPENING", None, admin.id, Decimal("1985.000000"))
    db.commit()

    # STEP 1: Purchase 60 kg flour @ ₹45
    purch = Purchase(purchase_no="PUR-001", supplier_id=supplier.id, date=today, status="DRAFT")
    db.add(purch)
    db.flush()
    pline = PurchaseLine(purchase_id=purch.id, item_id=flour.id, qty=Decimal("60000.000"), rate_paise_per_base=Decimal("4.500000"))
    db.add(pline)
    db.flush()
    post_purchase(db, purch.id, admin.id)
    db.commit()

    db.refresh(flour)
    flour_bal = db.query(StockBalance).filter(StockBalance.item_id == flour.id).first()
    assert flour_bal.qty == Decimal("160000.000")  # 160 kg
    assert flour.moving_avg_cost_paise == Decimal("4.312500")  # ₹43.125/kg

    # STEP 2: Issue production materials
    run = create_planned_run(db, product.id, Decimal("1.00"), admin.id)
    db.commit()

    raw_issues = [
        {"item_id": flour.id, "issued_qty": Decimal("40000.000")},
        {"item_id": oil.id, "issued_qty": Decimal("10500.000")},  # 10.5 L
        {"item_id": spice.id, "issued_qty": Decimal("1200.000")}   # 1.2 kg
    ]
    start_and_issue_run(db, run.id, raw_issues, admin.id)
    db.commit()

    flour_bal = db.query(StockBalance).filter(StockBalance.item_id == flour.id).first()
    oil_bal = db.query(StockBalance).filter(StockBalance.item_id == oil.id).first()
    spice_bal = db.query(StockBalance).filter(StockBalance.item_id == spice.id).first()

    assert flour_bal.qty == Decimal("120000.000")  # 120 kg
    assert oil_bal.qty == Decimal("19500.000")    # 19.5 L
    assert spice_bal.qty == Decimal("3800.000")    # 3.8 kg

    # STEP 3: Complete: 188 good, 6 pouches damaged, 9 cartons
    pack_consumptions = [
        {"item_id": pouches.id, "used_qty": Decimal("188.000"), "damaged_qty": Decimal("6.000")},
        {"item_id": cartons.id, "used_qty": Decimal("9.000"), "damaged_qty": Decimal("0.000")}
    ]
    overheads = [
        {"type": "LABOUR", "amount_paise": 120000},     # ₹1,200
        {"type": "GAS_POWER", "amount_paise": 60000}    # ₹600
    ]
    complete_production_run(db, run.id, 188, pack_consumptions, overheads, admin.id)
    db.commit()

    pouches_bal = db.query(StockBalance).filter(StockBalance.item_id == pouches.id).first()
    cartons_bal = db.query(StockBalance).filter(StockBalance.item_id == cartons.id).first()
    fg_bal = db.query(StockBalance).filter(StockBalance.item_id == fg_item.id).first()

    assert pouches_bal.qty == Decimal("306.000")   # 500 - 194 = 306
    assert cartons_bal.qty == Decimal("21.000")    # 30 - 9 = 21
    assert fg_bal.qty == Decimal("238.000")        # 50 + 188 = 238

    # Check variances and flags
    oil_rc = db.query(RunConsumption).filter(RunConsumption.run_id == run.id, RunConsumption.item_id == oil.id).first()
    assert oil_rc.variance_pct == Decimal("5.0000")
    assert oil_rc.flagged is True  # +5.00% flagged

    pouch_rc = db.query(RunConsumption).filter(RunConsumption.run_id == run.id, RunConsumption.item_id == pouches.id).first()
    assert pouch_rc.actual_consumed_qty == Decimal("194.000")
    assert pouch_rc.variance_pct == Decimal("-3.0000")
    assert pouch_rc.flagged is False  # -3.00% NOT flagged (rule is strictly greater than 3.00%)

    carton_rc = db.query(RunConsumption).filter(RunConsumption.run_id == run.id, RunConsumption.item_id == cartons.id).first()
    assert carton_rc.variance_pct == Decimal("-10.0000")
    assert carton_rc.flagged is True  # -10% flagged

    # Yield variance: (188 - 200)/200 * 100 = -6.00%
    yield_var = ((Decimal(run.actual_good_output) - Decimal(run.expected_output)) / Decimal(run.expected_output)) * Decimal("100")
    assert yield_var == Decimal("-6.0000")

    # Costing check:
    # Flour: 40 kg * 43.125 = 1725.00
    # Oil: 10.5 L * 140 = 1470.00
    # Spice: 1.2 kg * 200 = 240.00
    # Pouches: 194 * 2.50 = 485.00
    # Cartons: 9 * 15 = 135.00
    # Total materials = 4055.00
    # Overheads = 1800.00
    # Total = 5855.00
    # Cost per packet = 5855 / 188 = 31.143617...
    expected_cost_per_packet = (Decimal("585500") / Decimal("188"))  # in paise
    assert abs(run.cost_per_packet_paise - expected_cost_per_packet) < Decimal("0.0001")
    cost_rupees = run.cost_per_packet_paise / Decimal("100")
    assert f"{cost_rupees:.2f}" == "31.14"

    # STEP 4-5: Salesman A orders 150 for Retailer A; Admin approves, invoices, dispatches
    order_a = create_order(
        db,
        client_uuid="bench-order-retailer-a-150",
        customer_id=retailer_a.id,
        salesman_id=salesman_a.id,
        lines_data=[{"product_id": product.id, "qty_ordered": 150, "price_paise": 5000}]
    )
    db.commit()

    approve_order(db, order_a.id, user_id=admin.id)
    db.commit()

    inv_a = generate_invoice(db, order_a.id, user_id=admin.id)
    db.commit()

    assert inv_a.total_taxable_paise == 750000      # ₹7,500.00
    assert inv_a.total_cgst_paise == 18750         # ₹187.50
    assert inv_a.total_sgst_paise == 18750         # ₹187.50
    assert inv_a.total_igst_paise == 0             # Intra-state
    assert inv_a.total_amount_paise == 787500      # ₹7,875.00

    dsp_a = dispatch_invoice(db, inv_a.id, vehicle_no="TN-45-1234", user_id=admin.id)
    db.commit()

    # FEFO check: opening batch had 50 packets, run batch had 188.
    # Dispatch took 50 from opening batch + 100 from run batch.
    dlines = db.query(DispatchLine).filter(DispatchLine.dispatch_id == dsp_a.id).all()
    assert len(dlines) == 2
    assert dlines[0].fg_batch_id == b_fg.id
    assert dlines[0].qty == 50
    assert dlines[1].fg_batch_id == run.fg_batch_id
    assert dlines[1].qty == 100

    db.refresh(fg_bal)
    assert fg_bal.qty == Decimal("88.000")  # 238 - 150 = 88 packets remaining

    # STEP 6: Salesman B orders 120 for Distributor B (Inter-state)
    order_b = create_order(
        db,
        client_uuid="bench-order-distributor-b-120",
        customer_id=distributor_b.id,
        salesman_id=salesman_b.id,
        lines_data=[{"product_id": product.id, "qty_ordered": 120, "price_paise": 5000}]
    )
    db.commit()

    stock_check = check_order_stock(db, order_b.id)
    assert stock_check["lines"][0]["available"] == 88
    assert stock_check["lines"][0]["shortage"] == 32
    assert stock_check["all_fulfillable"] is False

    hold_order(db, order_b.id, note="Awaiting production - shortage 32")
    db.commit()

    # STEP 7: Payment ₹4,000 from Retailer A
    pay = record_payment(db, customer_id=retailer_a.id, amount_paise=400000, mode="UPI", user_id=admin.id)
    db.commit()

    cust_out = get_customer_outstanding(db, retailer_a.id)
    assert cust_out["net_outstanding_paise"] == 387500  # ₹7,875 - ₹4,000 = ₹3,875.00
    assert cust_out["ageing"]["0_30"] == 387500

    # STEP 8-9: Reconciliation
    recon = reconcile_balances(db)
    assert recon["zero_drift"] is True
    assert recon["status"] == "HEALTHY"
    assert recon["total_drift_count"] == 0
