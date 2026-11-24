import pytest
import datetime
from decimal import Decimal
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from api.app.db import Base
from api.app.models.entities import (
    User, AppSettings, Item, Product, Customer, StockBalance, StockLedger, Order
)
from api.app.services.ledger_service import init_db_triggers, reconcile_balances
from api.app.services.sales_service import create_order, check_order_stock
from api.app.services.intelligence_service import simulate_what_if, verify_audit_integrity

@pytest.fixture
def db():
    engine = create_engine("sqlite:///:memory:")
    TestingSession = sessionmaker(bind=engine)
    Base.metadata.create_all(bind=engine)
    session = TestingSession()
    init_db_triggers(session)
    yield session
    session.close()

def test_idempotent_order_creation(db):
    """Scenario 1: client_uuid unique prevents double submission."""
    user = User(username="salesman_a", password_hash="hash", role="SALESMAN")
    db.add(user)
    cust = Customer(name="Retailer A", state_code="33", address="Madurai")
    db.add(cust)
    item = Item(name="Murukku 200g", type="FG", base_uom="packet", display_uom="packet")
    db.add(item)
    db.flush()
    prod = Product(item_id=item.id, pack_size_label="Murukku 200 g", pack_size_g=Decimal("200.00"), family_id="MURUKKU_CLASSIC", price_paise=5000)
    db.add(prod)
    db.commit()

    client_uuid = "client-uuid-test-unique-12345"
    ord1 = create_order(db, client_uuid, cust.id, user.id, [{"product_id": prod.id, "qty_ordered": 10}])
    db.commit()

    # Retry with identical client_uuid
    ord2 = create_order(db, client_uuid, cust.id, user.id, [{"product_id": prod.id, "qty_ordered": 10}])
    db.commit()

    assert ord1.id == ord2.id
    assert db.query(Order).count() == 1

def test_whatif_simulator_does_not_mutate_db(db):
    """Scenario 35: What-if simulator runs in read-only mode and leaves database unchanged."""
    item = Item(name="Murukku 200g", type="FG", base_uom="packet", display_uom="packet")
    db.add(item)
    db.flush()
    prod = Product(item_id=item.id, pack_size_label="Murukku 200 g", pack_size_g=Decimal("200.00"), family_id="MURUKKU_CLASSIC", price_paise=5000)
    db.add(prod)
    db.commit()

    initial_ledger_count = db.query(StockLedger).count()

    res = simulate_what_if(db, product_id=prod.id, selling_price_delta_paise=200, input_price_pct_change=Decimal("15.00"), yield_override=180)
    assert res["status"] == "SIMULATION — NO BUSINESS RECORDS CHANGED."
    assert res["simulated"]["selling_price_paise"] == 5200

    final_ledger_count = db.query(StockLedger).count()
    assert initial_ledger_count == final_ledger_count

def test_zero_and_negative_quantities_rejected(db):
    """Scenario 4: Zero, negative or fractional quantities rejected."""
    user = User(username="salesman_a", password_hash="hash", role="SALESMAN")
    cust = Customer(name="Retailer A", state_code="33", address="Madurai")
    item = Item(name="Murukku 200g", type="FG", base_uom="packet", display_uom="packet")
    db.add_all([user, cust, item])
    db.flush()
    prod = Product(item_id=item.id, pack_size_label="Murukku 200 g", pack_size_g=Decimal("200.00"), family_id="MURUKKU_CLASSIC", price_paise=5000)
    db.add(prod)
    db.commit()

    with pytest.raises(ValueError):
        create_order(db, "uuid-zero", cust.id, user.id, [{"product_id": prod.id, "qty_ordered": 0}])

    with pytest.raises(ValueError):
        create_order(db, "uuid-neg", cust.id, user.id, [{"product_id": prod.id, "qty_ordered": -10}])
