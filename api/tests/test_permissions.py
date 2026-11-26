import pytest
from fastapi.testclient import TestClient

from api.app.main import app
from api.app.services.auth_service import create_access_token
from api.app.models.entities import User
from api.app.db import SessionLocal


@pytest.fixture(scope="module")
def client():
    """Run the app lifespan so database tables exist, then seed auth users."""
    with TestClient(app) as test_client:
        db = SessionLocal()
        try:
            test_users = [
                ("admin", "ADMIN"),
                ("salesman_a", "SALESMAN"),
                ("production", "PRODUCTION"),
                ("auditor", "AUDITOR"),
                ("owner", "OWNER"),
            ]
            for username, role in test_users:
                user = db.query(User).filter(User.username == username).first()
                if user is None:
                    db.add(
                        User(
                            username=username,
                            password_hash="test-password-hash",
                            role=role,
                            is_active=True,
                        )
                    )
            db.commit()
        finally:
            db.close()

        yield test_client


@pytest.fixture(scope="module")
def tokens():
    return {
        "admin": create_access_token({"sub": "admin", "role": "ADMIN"}),
        "salesman": create_access_token({"sub": "salesman_a", "role": "SALESMAN"}),
        "production": create_access_token({"sub": "production", "role": "PRODUCTION"}),
        "auditor": create_access_token({"sub": "auditor", "role": "AUDITOR"}),
        "owner": create_access_token({"sub": "owner", "role": "OWNER"}),
    }


def test_auditor_write_forbidden(client, tokens):
    """PRD Section 2: Auditor has strictly NO write access (403)."""
    headers = {"Authorization": f"Bearer {tokens['auditor']}"}

    res = client.post(
        "/purchases",
        json={"supplier_id": 1, "purchase_no": "TEST-01", "lines": []},
        headers=headers,
    )
    assert res.status_code == 403

    res = client.post("/orders/1/approve", json={}, headers=headers)
    assert res.status_code == 403

    res = client.post("/invoices/1/dispatch", json={}, headers=headers)
    assert res.status_code == 403


def test_salesman_restricted_routes(client, tokens):
    """PRD Section 2: Salesman cannot access admin or production write routes."""
    headers = {"Authorization": f"Bearer {tokens['salesman']}"}

    res = client.post(
        "/runs/1/complete",
        json={
            "actual_good_output": 100,
            "pack_consumptions": [],
            "overheads": [],
        },
        headers=headers,
    )
    assert res.status_code == 403

    res = client.post("/orders/1/approve", json={}, headers=headers)
    assert res.status_code == 403


def test_auditor_and_owner_read_allowed(client, tokens):
    """Auditor and Owner can read reports."""
    auditor_headers = {"Authorization": f"Bearer {tokens['auditor']}"}
    res = client.get("/reports/stock-summary", headers=auditor_headers)
    assert res.status_code == 200

    owner_headers = {"Authorization": f"Bearer {tokens['owner']}"}
    res = client.get("/reports/sales-register", headers=owner_headers)
    assert res.status_code == 200
