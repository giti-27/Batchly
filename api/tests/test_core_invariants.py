import pytest
from decimal import Decimal
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from api.app.db import Base
from api.app.services.money import round_paise, paise_to_rupees_decimal, paise_to_rupees_str, rupees_to_paise
from api.app.services.uom import to_base, from_base, UnitError
from api.app.models.entities import Item, User, StockLedger, StockBalance, BatchBalance
from api.app.services.ledger_service import (
    post_movement, reconcile_balances, init_db_triggers, InsufficientStockError
)

@pytest.fixture
def db_session():
    engine = create_engine("sqlite:///:memory:")
    TestingSession = sessionmaker(bind=engine)
    Base.metadata.create_all(bind=engine)
    session = TestingSession()
    init_db_triggers(session)
    yield session
    session.close()

def test_money_rounding_half_up():
    """Invariant I6: Decimal ROUND_HALF_UP to whole paise."""
    assert round_paise(Decimal("187.50")) == 188
    assert round_paise(Decimal("187.49")) == 187
    assert round_paise(Decimal("187.51")) == 188
    assert round_paise("100.5") == 101
    assert round_paise(100) == 100
    
    # Test reject float
    with pytest.raises(TypeError):
        round_paise(187.50)

def test_uom_conversions():
    """Invariant I5: UOM conversions to base and from base."""
    # kg -> g
    assert to_base(Decimal("60"), "kg") == Decimal("60000.000")
    assert from_base(Decimal("60000.000"), "kg") == Decimal("60.000")
    
    # L -> ml
    assert to_base(Decimal("10.5"), "L") == Decimal("10500.000")
    assert from_base(Decimal("10500.000"), "L") == Decimal("10.500")
    
    # Cartons -> packets (1 carton = 20 packets)
    assert to_base(Decimal("9"), "carton") == Decimal("180.000")
    assert from_base(Decimal("188.000"), "carton") == Decimal("9.400")

    # Incompatible units
    with pytest.raises(UnitError):
        to_base(Decimal("10"), "invalid_unit")

def test_ledger_append_only_and_reconciliation(db_session):
    """Invariant I1, I2, I3: Append-only ledger, cache synchronization, and drift check."""
    # Create item
    item = Item(
        name="Flour",
        type="RAW",
        base_uom="g",
        display_uom="kg",
        hsn="1101",
        gst_rate_pct=Decimal("5.00"),
        shelf_life_days=90,
        reorder_level=Decimal("10000.000"),
        moving_avg_cost_paise=Decimal("4.500000")
    )
    db_session.add(item)
    db_session.commit()
    db_session.refresh(item)

    # Post movement: +100 kg flour = +100,000 g
    entry = post_movement(
        db=db_session,
        item_id=item.id,
        batch_id=None,
        qty_delta=Decimal("100000.000"),
        movement_type="PURCHASE",
        source_type="PURCHASE",
        source_id=1,
        user_id=None,
        unit_cost_snapshot=Decimal("4.500000")
    )
    db_session.commit()

    # Verify reconciliation drift is 0
    recon = reconcile_balances(db_session)
    assert recon["status"] == "HEALTHY"
    assert recon["total_drift_count"] == 0
    assert recon["zero_drift"] is True

    # Test insufficient stock protection (Invariant I3)
    with pytest.raises(InsufficientStockError):
        post_movement(
            db=db_session,
            item_id=item.id,
            batch_id=None,
            qty_delta=Decimal("-150000.000"),
            movement_type="ISSUE",
            source_type="PRODUCTION",
            source_id=1,
            user_id=None
        )

    # Test Invariant I1 Trigger: attempting to directly update stock_ledger
    ledger_row = db_session.query(StockLedger).first()
    with pytest.raises(Exception):
        db_session.execute(
            StockLedger.__table__.update().where(StockLedger.id == ledger_row.id).values(qty_delta=Decimal("999.000"))
        )
        db_session.commit()
