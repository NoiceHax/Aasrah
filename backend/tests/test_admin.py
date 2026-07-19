"""Admin console tests: RBAC, NGO verification, user management."""

from app.core.security import hash_password
from app.models.enums import UserRole
from app.models.ngo import NGO
from app.models.user import User
from tests.conftest import TestSessionLocal, register


def _make_admin(client) -> dict:
    db = TestSessionLocal()
    try:
        admin = User(
            email="admin@test.com", hashed_password=hash_password("Secret123!"),
            full_name="Admin", role=UserRole.ADMIN, is_active=True, is_verified=True,
        )
        db.add(admin)
        db.commit()
    finally:
        db.close()
    tokens = client.post("/api/v1/auth/login", json={"email": "admin@test.com", "password": "Secret123!"}).json()
    return {"Authorization": f"Bearer {tokens['tokens']['access_token']}"}


def _make_pending_ngo() -> str:
    db = TestSessionLocal()
    try:
        owner = User(
            email="pendingngo@test.com", hashed_password=hash_password("Secret123!"),
            full_name="Pending", role=UserRole.NGO, is_active=True,
        )
        db.add(owner)
        db.flush()
        ngo = NGO(name="Pending NGO", owner_id=owner.id, is_verified=False)
        db.add(ngo)
        db.commit()
        return str(ngo.id)
    finally:
        db.close()


def test_non_admin_cannot_access_admin(client):
    volunteer = register(client, "volunteer@test.com")
    h = {"Authorization": f"Bearer {volunteer['tokens']['access_token']}"}
    assert client.get("/api/v1/admin/dashboard", headers=h).status_code == 403


def test_admin_dashboard_returns_kpis(client):
    h = _make_admin(client)
    resp = client.get("/api/v1/admin/dashboard", headers=h)
    assert resp.status_code == 200
    assert "kpis" in resp.json()
    assert "total_reports" in resp.json()["kpis"]


def test_admin_ngo_verification_flow(client):
    h = _make_admin(client)
    ngo_id = _make_pending_ngo()

    pending = client.get("/api/v1/admin/ngos?pending_only=true", headers=h).json()
    assert any(n["id"] == ngo_id for n in pending)

    approve = client.post(f"/api/v1/admin/ngos/{ngo_id}/verify?approve=true", headers=h)
    assert approve.status_code == 200
    assert approve.json()["is_verified"] is True


def test_admin_volunteer_approval_flow(client):
    h = _make_admin(client)
    # A public registration creates a pending volunteer.
    vol = register(client, "applicant@test.com")
    vh = {"Authorization": f"Bearer {vol['tokens']['access_token']}"}

    pending = client.get("/api/v1/admin/volunteers?pending_only=true", headers=h).json()
    assert len(pending) == 1
    vol_id = pending[0]["id"]
    assert pending[0]["status"] == "pending"

    # Before approval, the volunteer cannot list/act; profile is readable though.
    assert client.get("/api/v1/volunteer/profile", headers=vh).json()["status"] == "pending"

    approve = client.post(f"/api/v1/admin/volunteers/{vol_id}/approve?approve=true", headers=h)
    assert approve.status_code == 200
    assert approve.json()["status"] == "active"

    # Now the volunteer profile reflects active status.
    assert client.get("/api/v1/volunteer/profile", headers=vh).json()["status"] == "active"


def test_admin_creates_ngo_account(client):
    h = _make_admin(client)
    resp = client.post("/api/v1/admin/ngos", headers=h, json={
        "name": "Relief Corps",
        "owner_email": "owner@relief.org",
        "temp_password": "TempPass123!",
        "focus_area": "Medical",
    })
    assert resp.status_code == 201, resp.text
    assert resp.json()["is_verified"] is True

    # The provisioned owner can log in with the temp password.
    login = client.post("/api/v1/auth/login", json={
        "email": "owner@relief.org", "password": "TempPass123!",
    })
    assert login.status_code == 200
    assert login.json()["user"]["role"] == "ngo"


def test_admin_user_suspend_and_activate(client):
    h = _make_admin(client)
    target = register(client, "victim@test.com")
    uid = target["user"]["id"]

    suspended = client.post(f"/api/v1/admin/users/{uid}/suspend?active=false", headers=h)
    assert suspended.status_code == 200
    assert suspended.json()["is_active"] is False

    activated = client.post(f"/api/v1/admin/users/{uid}/suspend?active=true", headers=h)
    assert activated.json()["is_active"] is True
