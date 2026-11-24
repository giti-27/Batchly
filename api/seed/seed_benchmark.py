import sys
import os
import argparse
import datetime
from decimal import Decimal
from passlib.hash import bcrypt

# Add root directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from api.app.db import SessionLocal, Base, engine
from api.app.models.entities import (
    User, AppSettings, Item, Product, Customer, Supplier, BOM, BOMLine,
    Batch, StockBalance, BatchBalance, PriceList, PriceListItem, utcnow
)
from api.app.services.ledger_service import post_movement, init_db_triggers, reconcile_balances
from api.app.services.purchase_service import post_purchase
from api.app.services.production_service import (
    create_planned_run, start_and_issue_run, complete_production_run
)
from api.app.services.sales_service import (
    create_order, approve_order, hold_order, generate_invoice,
    dispatch_invoice, record_payment, get_customer_outstanding
)
from api.app.models.entities import Purchase, PurchaseLine, OrderLine

def seed_benchmark(reset: bool = False, execute_steps: bool = False):
    """
    Seeds the benchmark dataset according to PRD Section 11.
    If reset=True, recreates tables.
    If execute_steps=True, executes benchmark steps 1 to 9.
    """
    if reset:
        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)
        db = SessionLocal()
        init_db_triggers(db)
    else:
        db = SessionLocal()
        init_db_triggers(db)
        if db.query(Item).filter(Item.name == "Flour").first():
            print("Benchmark seed already exists. Use --reset to reseed.")
            db.close()
            return

    print("Seeding BATCHLY benchmark master records...")

    # 1. App Settings
    settings = AppSettings(
        company_name="Batchly Foods Private Limited",
        company_gstin="33AABCB1234F1Z5",
        company_state_code="33",
        company_address="Plot 42, SIDCO Industrial Estate, Thuvakudi, Tiruchirappalli, Tamil Nadu 620015",
        variance_tolerance_pct=Decimal("3.00"),
        fg_safety_packets=20,
        invoice_round_off=False
    )
    db.add(settings)

    # 2. Users (passwords hashed with bcrypt)
    password_hash = bcrypt.hash("demo123")
    users = [
        User(username="admin", password_hash=password_hash, role="ADMIN"),
        User(username="salesman_a", password_hash=password_hash, role="SALESMAN"),
        User(username="salesman_b", password_hash=password_hash, role="SALESMAN"),
        User(username="production", password_hash=password_hash, role="PRODUCTION"),
        User(username="auditor", password_hash=password_hash, role="AUDITOR"),
        User(username="owner", password_hash=password_hash, role="OWNER"),
    ]
    db.add_all(users)
    db.flush()

    salesman_a = db.query(User).filter(User.username == "salesman_a").first()
    salesman_b = db.query(User).filter(User.username == "salesman_b").first()
    admin_user = db.query(User).filter(User.username == "admin").first()

    # 3. Items
    # Flour: 100 kg @ ₹42 (4.2 paise/g = 4.200000)
    flour = Item(
        name="Flour", type="RAW", base_uom="g", display_uom="kg", hsn="1101",
        shelf_life_days=180, reorder_level=Decimal("20000.000"), moving_avg_cost_paise=Decimal("4.200000")
    )
    # Oil: 30 L @ ₹140 (140 paise/ml? Rs 140/L = 14000 paise/1000 ml = 14.0 paise/ml)
    oil = Item(
        name="Oil", type="RAW", base_uom="ml", display_uom="L", hsn="1512",
        shelf_life_days=180, reorder_level=Decimal("10000.000"), moving_avg_cost_paise=Decimal("14.000000")
    )
    # Spice: 5 kg @ ₹200 (Rs 200/kg = 20000 paise/1000 g = 20.0 paise/g)
    spice = Item(
        name="Spice Mix", type="RAW", base_uom="g", display_uom="kg", hsn="0910",
        shelf_life_days=180, reorder_level=Decimal("2000.000"), moving_avg_cost_paise=Decimal("20.000000")
    )
    # Pouches: 500 pcs @ ₹2.50 = 250 paise/pc
    pouches = Item(
        name="Pouches", type="PACK", base_uom="pcs", display_uom="pcs", hsn="3923",
        shelf_life_days=365, reorder_level=Decimal("100.000"), moving_avg_cost_paise=Decimal("250.000000")
    )
    # Cartons: 30 pcs @ ₹15 = 1500 paise/pc
    cartons = Item(
        name="Cartons", type="PACK", base_uom="pcs", display_uom="pcs", hsn="4819",
        shelf_life_days=365, reorder_level=Decimal("10.000"), moving_avg_cost_paise=Decimal("1500.000000")
    )
    # Murukku 200 g FG (std cost ₹19.85 = 1985 paise/packet)
    fg_item = Item(
        name="Murukku 200g", type="FG", base_uom="packet", display_uom="packet", hsn="2106",
        gst_rate_pct=Decimal("5.00"), shelf_life_days=90, reorder_level=Decimal("50.000"),
        moving_avg_cost_paise=Decimal("1985.000000")
    )
    db.add_all([flour, oil, spice, pouches, cartons, fg_item])
    db.flush()

    # 4. Product
    product = Product(
        item_id=fg_item.id,
        pack_size_label="Murukku 200 g",
        pack_size_g=Decimal("200.00"),
        family_id="MURUKKU_CLASSIC",
        price_paise=5000  # ₹50 list price
    )
    db.add(product)
    db.flush()

    # 5. Price List
    price_list = PriceList(name="Standard 2026")
    db.add(price_list)
    db.flush()
    pl_item = PriceListItem(
        price_list_id=price_list.id,
        product_id=product.id,
        price_paise=5000,
        valid_from=datetime.date(2026, 4, 1)
    )
    db.add(pl_item)

    # 6. Customers & Suppliers
    # Retailer A (TN, 33, GSTIN 33AAAAR1111A1Z1, salesman A)
    retailer_a = Customer(
        name="Retailer A",
        type="RETAILER",
        gstin="33AAAAR1111A1Z1",
        state_code="33",
        address="12 Big Bazaar St, Madurai, Tamil Nadu 625001",
        assigned_salesman_id=salesman_a.id,
        credit_days=30
    )
    # Distributor B (Karnataka, 29, GSTIN 29AAAAD2222B1Z2, salesman B)
    distributor_b = Customer(
        name="Distributor B",
        type="DISTRIBUTOR",
        gstin="29AAAAD2222B1Z2",
        state_code="29",
        address="44 Commercial St, Bengaluru, Karnataka 560001",
        assigned_salesman_id=salesman_b.id,
        credit_days=30
    )
    # Supplier
    supplier = Supplier(
        name="Trichy Agro Supplies",
        gstin="33AAACT9999Z1Z8",
        state_code="33",
        phone="9876543210"
    )
    db.add_all([retailer_a, distributor_b, supplier])
    db.flush()

    # 7. BOM (Murukku 200g, batch output 40,000 g -> expected yield 200 packets)
    bom = BOM(
        product_family_id="MURUKKU_CLASSIC",
        version=1,
        batch_output_g=Decimal("40000.000"),
        expected_yield_packets=200,
        output_item_id=fg_item.id,
        effective_from=datetime.date(2026, 4, 1)
    )
    db.add(bom)
    db.flush()

    # BOM Lines:
    # Flour 40 kg = 40,000 g
    # Oil 10 L = 10,000 ml
    # Spice 1.2 kg = 1,200 g
    # Pouches 200 pcs (PER_PACKET 1)
    # Cartons 10 pcs (PER_CARTON 1) -> 200 packets / 20 = 10 cartons
    bom_lines = [
        BOMLine(bom_id=bom.id, item_id=flour.id, qty_per_batch=Decimal("40000.000"), line_type="RAW", basis="PER_BATCH"),
        BOMLine(bom_id=bom.id, item_id=oil.id, qty_per_batch=Decimal("10000.000"), line_type="RAW", basis="PER_BATCH"),
        BOMLine(bom_id=bom.id, item_id=spice.id, qty_per_batch=Decimal("1200.000"), line_type="RAW", basis="PER_BATCH"),
        BOMLine(bom_id=bom.id, item_id=pouches.id, qty_per_batch=Decimal("1.000"), line_type="PACK", basis="PER_PACKET"),
        BOMLine(bom_id=bom.id, item_id=cartons.id, qty_per_batch=Decimal("1.000"), line_type="PACK", basis="PER_CARTON"),
    ]
    db.add_all(bom_lines)
    db.flush()

    # 8. Opening Batches & Opening Stock Ledger Entries
    today = datetime.date.today()
    exp_early = today + datetime.timedelta(days=30)
    exp_standard = today + datetime.timedelta(days=90)

    # Opening Flour: 100 kg = 100,000 g @ 4.2 paise/g
    b_flour = Batch(
        batch_no="OPEN-FLOUR-001", item_id=flour.id, source_type="OPENING",
        mfg_date=today, expiry_date=exp_standard, status="ACTIVE", unit_cost_paise=Decimal("4.200000")
    )
    # Opening Oil: 30 L = 30,000 ml @ 14.0 paise/ml
    b_oil = Batch(
        batch_no="OPEN-OIL-001", item_id=oil.id, source_type="OPENING",
        mfg_date=today, expiry_date=exp_standard, status="ACTIVE", unit_cost_paise=Decimal("14.000000")
    )
    # Opening Spice: 5 kg = 5,000 g @ 20.0 paise/g
    b_spice = Batch(
        batch_no="OPEN-SPICE-001", item_id=spice.id, source_type="OPENING",
        mfg_date=today, expiry_date=exp_standard, status="ACTIVE", unit_cost_paise=Decimal("20.000000")
    )
    # Opening Pouches: 500 pcs @ 250 paise/pc
    b_pouches = Batch(
        batch_no="OPEN-POUCHES-001", item_id=pouches.id, source_type="OPENING",
        mfg_date=today, expiry_date=exp_standard, status="ACTIVE", unit_cost_paise=Decimal("250.000000")
    )
    # Opening Cartons: 30 pcs @ 1500 paise/pc
    b_cartons = Batch(
        batch_no="OPEN-CARTONS-001", item_id=cartons.id, source_type="OPENING",
        mfg_date=today, expiry_date=exp_standard, status="ACTIVE", unit_cost_paise=Decimal("1500.000000")
    )
    # Opening Finished Goods: 50 packets @ ₹19.85 = 1985 paise/packet (earliest expiry for FEFO)
    b_fg = Batch(
        batch_no="OPEN-FG-001", item_id=fg_item.id, source_type="OPENING",
        mfg_date=today - datetime.timedelta(days=10), expiry_date=exp_early,
        status="ACTIVE", unit_cost_paise=Decimal("1985.000000")
    )
    db.add_all([b_flour, b_oil, b_spice, b_pouches, b_cartons, b_fg])
    db.flush()

    # Post Opening movements
    post_movement(db, flour.id, b_flour.id, Decimal("100000.000"), "OPENING", "OPENING", None, admin_user.id, Decimal("4.200000"))
    post_movement(db, oil.id, b_oil.id, Decimal("30000.000"), "OPENING", "OPENING", None, admin_user.id, Decimal("14.000000"))
    post_movement(db, spice.id, b_spice.id, Decimal("5000.000"), "OPENING", "OPENING", None, admin_user.id, Decimal("20.000000"))
    post_movement(db, pouches.id, b_pouches.id, Decimal("500.000"), "OPENING", "OPENING", None, admin_user.id, Decimal("250.000000"))
    post_movement(db, cartons.id, b_cartons.id, Decimal("30.000"), "OPENING", "OPENING", None, admin_user.id, Decimal("1500.000000"))
    post_movement(db, fg_item.id, b_fg.id, Decimal("50.000"), "OPENING", "OPENING", None, admin_user.id, Decimal("1985.000000"))

    db.commit()
    print("Opening stock seeded successfully. Reconciliation drift check:")
    recon = reconcile_balances(db)
    print(f"Reconciliation status: {recon['status']}, zero_drift={recon['zero_drift']}")

    if execute_steps:
        print("\nExecuting Benchmark Steps 1 to 9...")
        execute_benchmark_steps(db)

    db.close()

def execute_benchmark_steps(db):
    """Executes the full 9 benchmark steps against the database."""
    admin_user = db.query(User).filter(User.username == "admin").first()
    salesman_a = db.query(User).filter(User.username == "salesman_a").first()
    salesman_b = db.query(User).filter(User.username == "salesman_b").first()
    supplier = db.query(Supplier).first()
    flour = db.query(Item).filter(Item.name == "Flour").first()
    oil = db.query(Item).filter(Item.name == "Oil").first()
    spice = db.query(Item).filter(Item.name == "Spice Mix").first()
    pouches = db.query(Item).filter(Item.name == "Pouches").first()
    cartons = db.query(Item).filter(Item.name == "Cartons").first()
    product = db.query(Product).first()
    retailer_a = db.query(Customer).filter(Customer.name == "Retailer A").first()
    distributor_b = db.query(Customer).filter(Customer.name == "Distributor B").first()

    # Step 1: Purchase 60 kg flour @ ₹45 (4500 paise/kg = 4.5 paise/g)
    print("Step 1: Purchase 60 kg flour @ ₹45/kg")
    purch = Purchase(
        purchase_no="PUR-2026-001",
        supplier_id=supplier.id,
        date=datetime.date.today(),
        status="DRAFT"
    )
    db.add(purch)
    db.flush()
    pline = PurchaseLine(
        purchase_id=purch.id,
        item_id=flour.id,
        qty=Decimal("60000.000"),  # 60 kg in grams
        rate_paise_per_base=Decimal("4.500000"),  # ₹45/kg = 4.5 paise/g
        supplier_lot_no="LOT-FLOUR-60"
    )
    db.add(pline)
    db.flush()
    post_purchase(db, purch.id, admin_user.id)
    db.commit()

    db.refresh(flour)
    print(f"  Flour moving average: {flour.moving_avg_cost_paise} paise/g (₹{flour.moving_avg_cost_paise * Decimal('10'):.3f}/kg)")

    # Step 2: Run: issue flour 40 kg, oil 10.5 L, spice 1.2 kg
    print("Step 2: Create planned run and issue raw materials")
    run = create_planned_run(db, product.id, Decimal("1.00"), admin_user.id)
    db.commit()

    raw_issues = [
        {"item_id": flour.id, "issued_qty": Decimal("40000.000")},
        {"item_id": oil.id, "issued_qty": Decimal("10500.000")},  # 10.5 L
        {"item_id": spice.id, "issued_qty": Decimal("1200.000")}   # 1.2 kg
    ]
    start_and_issue_run(db, run.id, raw_issues, admin_user.id)
    db.commit()

    # Step 3: Complete run: 188 good, 6 pouches damaged, 9 cartons
    print("Step 3: Complete production run")
    pack_consumptions = [
        {"item_id": pouches.id, "used_qty": Decimal("188.000"), "damaged_qty": Decimal("6.000")},
        {"item_id": cartons.id, "used_qty": Decimal("9.000"), "damaged_qty": Decimal("0.000")}
    ]
    overheads = [
        {"type": "LABOUR", "amount_paise": 120000},     # ₹1,200
        {"type": "GAS_POWER", "amount_paise": 60000}    # ₹600
    ]
    complete_production_run(db, run.id, 188, pack_consumptions, overheads, admin_user.id)
    db.commit()

    db.refresh(run)
    print(f"  Run good output: {run.actual_good_output}, Cost per packet: ₹{run.cost_per_packet_paise / Decimal('100'):.4f}")

    # Step 4-5: Salesman A orders 150 for Retailer A; Admin approves, invoices, dispatches
    print("Step 4-5: Salesman A order 150 packets for Retailer A, approve, invoice, dispatch")
    order_a = create_order(
        db,
        client_uuid="bench-order-retailer-a-150",
        customer_id=retailer_a.id,
        salesman_id=salesman_a.id,
        lines_data=[{"product_id": product.id, "qty_ordered": 150, "price_paise": 5000}]
    )
    db.commit()

    approve_order(db, order_a.id, user_id=admin_user.id)
    db.commit()

    inv_a = generate_invoice(db, order_a.id, user_id=admin_user.id)
    db.commit()
    print(f"  Invoice: {inv_a.invoice_no}, Total: ₹{inv_a.total_amount_paise / 100:.2f} (CGST: ₹{inv_a.total_cgst_paise / 100:.2f}, SGST: ₹{inv_a.total_sgst_paise / 100:.2f})")

    dsp_a = dispatch_invoice(db, inv_a.id, vehicle_no="TN-45-AB-1234", user_id=admin_user.id)
    db.commit()
    print(f"  Dispatch: {dsp_a.dispatch_no} completed")

    # Step 6: Salesman B orders 120 for Distributor B; Admin holds the order
    print("Step 6: Salesman B order 120 packets for Distributor B, admin holds")
    order_b = create_order(
        db,
        client_uuid="bench-order-distributor-b-120",
        customer_id=distributor_b.id,
        salesman_id=salesman_b.id,
        lines_data=[{"product_id": product.id, "qty_ordered": 120, "price_paise": 5000}]
    )
    db.commit()
    hold_order(db, order_b.id, note="Awaiting production - shortage 32 packets")
    db.commit()

    # Step 7: Payment ₹4,000 from Retailer A
    print("Step 7: Record payment ₹4,000 from Retailer A")
    pay = record_payment(
        db,
        customer_id=retailer_a.id,
        amount_paise=400000,
        mode="UPI",
        ref="UPI/BENCH/4000",
        user_id=admin_user.id
    )
    db.commit()
    out = get_customer_outstanding(db, retailer_a.id)
    print(f"  Retailer A outstanding: ₹{out['net_outstanding_paise'] / 100:.2f}")

    # Step 8 & 9: Reports & Final Reconciliation
    print("Step 8 & 9: Benchmark completed. Verifying final balances and reconciliation...")
    recon = reconcile_balances(db)
    print(f"  Zero drift: {recon['zero_drift']}, status: {recon['status']}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed BATCHLY benchmark dataset")
    parser.add_argument("--reset", action="store_true", help="Reset and recreate database")
    parser.add_argument("--run", action="store_true", help="Execute benchmark steps 1 to 9")
    args = parser.parse_args()
    seed_benchmark(reset=args.reset, execute_steps=args.run)
