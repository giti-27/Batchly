import sys
import os
import datetime
from decimal import Decimal

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from api.app.db import SessionLocal
from api.app.models.entities import (
    Item, Product, Supplier, Customer, BOM, BOMLine, Batch,
    ProductionRun, RunConsumption, RunOverhead, User, AuditLog
)
from api.app.services.ledger_service import post_movement

def seed_demo_history():
    """
    Seeds 6 historical production runs demonstrating Anomaly Detection Rules R2-R7:
    - Persistent overconsumption of oil (3 of 5 runs)
    - Yield deterioration over time
    - Damaged packaging
    - Shift/supervisor yield variations
    """
    db = SessionLocal()
    print("Seeding demo anomaly history runs...")

    admin = db.query(User).filter(User.username == "admin").first()
    product = db.query(Product).first()
    if not product:
        print("Please run seed_benchmark first.")
        db.close()
        return

    bom = db.query(BOM).filter(BOM.product_family_id == product.family_id).first()
    oil = db.query(Item).filter(Item.name == "Oil").first()
    flour = db.query(Item).filter(Item.name == "Flour").first()
    spice = db.query(Item).filter(Item.name == "Spice Mix").first()
    pouches = db.query(Item).filter(Item.name == "Pouches").first()
    cartons = db.query(Item).filter(Item.name == "Cartons").first()

    shifts = ["Morning", "Evening", "Night", "Morning", "Evening", "Night"]
    yields = [198, 195, 190, 185, 182, 178]  # Yield deterioration (R3)
    oil_overages = [Decimal("10400.000"), Decimal("10500.000"), Decimal("10600.000"), Decimal("10200.000"), Decimal("10700.000"), Decimal("10800.000")] # Persistent oil overuse (R2)

    base_date = datetime.date.today() - datetime.timedelta(days=20)

    for i in range(6):
        run_date = base_date + datetime.timedelta(days=i * 3)
        run_no = f"RUN-HIST-{i+1:03d}"
        
        # Check if already exists
        if db.query(ProductionRun).filter(ProductionRun.run_no == run_no).first():
            continue

        actual_yield = yields[i]
        run = ProductionRun(
            run_no=run_no,
            product_id=product.id,
            bom_id=bom.id,
            batch_multiplier=Decimal("1.00"),
            expected_output=200,
            actual_good_output=actual_yield,
            status="COMPLETED",
            supervisor_id=admin.id,
            shift=shifts[i],
            cost_per_packet_paise=Decimal("3150.000000"),
            created_at=datetime.datetime.combine(run_date, datetime.time(10, 0), tzinfo=datetime.timezone.utc),
            completed_at=datetime.datetime.combine(run_date, datetime.time(16, 0), tzinfo=datetime.timezone.utc)
        )
        db.add(run)
        db.flush()

        # Add consumption records
        rc_oil = RunConsumption(
            run_id=run.id,
            item_id=oil.id,
            planned_qty=Decimal("10000.000"),
            issued_qty=oil_overages[i],
            damaged_qty=Decimal("0.000"),
            returned_qty=Decimal("0.000"),
            actual_consumed_qty=oil_overages[i],
            variance_pct=((oil_overages[i] - Decimal("10000.000")) / Decimal("10000.000")) * Decimal("100"),
            flagged=(oil_overages[i] > Decimal("10300.000"))
        )
        db.add(rc_oil)

        rc_flour = RunConsumption(
            run_id=run.id,
            item_id=flour.id,
            planned_qty=Decimal("40000.000"),
            issued_qty=Decimal("40000.000"),
            damaged_qty=Decimal("0.000"),
            returned_qty=Decimal("0.000"),
            actual_consumed_qty=Decimal("40000.000"),
            variance_pct=Decimal("0.0000"),
            flagged=False
        )
        db.add(rc_flour)

        rc_pouches = RunConsumption(
            run_id=run.id,
            item_id=pouches.id,
            planned_qty=Decimal("200.000"),
            issued_qty=Decimal(actual_yield),
            damaged_qty=Decimal(i + 2),  # rising damaged packaging (R4)
            returned_qty=Decimal("0.000"),
            actual_consumed_qty=Decimal(actual_yield + i + 2),
            variance_pct=Decimal("0.0000"),
            flagged=False
        )
        db.add(rc_pouches)

    db.commit()
    print("Demo anomaly history runs seeded successfully.")
    db.close()

if __name__ == "__main__":
    seed_demo_history()
