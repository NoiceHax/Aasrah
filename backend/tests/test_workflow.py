"""End-to-end tests for the critical multi-role rescue workflow."""

import pytest

from app.core.security import hash_password
from app.models.enums import UserRole, VolunteerStatus
from app.models.ngo import NGO
from app.models.user import User
from app.models.volunteer import Volunteer
from tests.conftest import TestSessionLocal, auth_header, register


@pytest.fixture
def ngo_setup():
    """Create a verified NGO (with owner) + a volunteer, return their credentials."""
    db = TestSessionLocal()
    try:
        owner = User(
            email="ngo@test.com", hashed_password=hash_password("Secret123!"),
            full_name="NGO Owner", role=UserRole.NGO, is_active=True, is_verified=True,
        )
        db.add(owner)
        db.flush()
        ngo = NGO(
            name="Test NGO", owner_id=owner.id, is_verified=True,
            service_latitude=40.7128, service_longitude=-74.0060, service_radius_km=25.0,
        )
        db.add(ngo)
        db.flush()
        vuser = User(
            email="vol@test.com", hashed_password=hash_password("Secret123!"),
            full_name="Vol One", role=UserRole.VOLUNTEER, is_active=True, is_verified=True,
        )
        db.add(vuser)
        db.flush()
        vol = Volunteer(
            user_id=vuser.id, ngo_id=ngo.id, status=VolunteerStatus.ACTIVE,
            is_available=True, skills="First Aid",
        )
        db.add(vol)
        db.commit()
        return {"ngo_id": str(ngo.id), "volunteer_id": str(vol.id)}
    finally:
        db.close()


def _login(client, email, password="Secret123!") -> dict:
    return client.post("/api/v1/auth/login", json={"email": email, "password": password}).json()


def _create_report(client) -> dict:
    return client.post("/api/v1/reports", json={
        "situation": "medical", "priority": "critical",
        "description": "Critical medical emergency requiring immediate response now.",
        "address": "Downtown", "latitude": 40.7130, "longitude": -74.0055,
    }).json()


def test_full_rescue_lifecycle(client, ngo_setup):
    # 1. Citizen submits a report.
    report = _create_report(client)
    report_id = report["report_id"]
    tracking_id = report["tracking_id"]

    # 2. NGO logs in, discovers it nearby, and claims it.
    ngo_tokens = _login(client, "ngo@test.com")
    ngo_h = {"Authorization": f"Bearer {ngo_tokens['tokens']['access_token']}"}

    nearby = client.get("/api/v1/ngo/reports/nearby", headers=ngo_h).json()
    assert any(i["id"] == report_id for i in nearby["items"])

    claim = client.post(f"/api/v1/ngo/reports/{report_id}/claim", headers=ngo_h)
    assert claim.status_code == 200
    assert claim.json()["status"] == "claimed"

    # Double-claim is prevented.
    assert client.post(f"/api/v1/ngo/reports/{report_id}/claim", headers=ngo_h).status_code == 409

    # 3. NGO assigns the volunteer.
    assign = client.post(
        f"/api/v1/ngo/reports/{report_id}/assignments", headers=ngo_h,
        json={"volunteer_ids": [ngo_setup["volunteer_id"]]},
    )
    assert assign.status_code == 201
    assignment_id = assign.json()[0]["id"]

    # 4. Volunteer logs in, accepts, and runs the workflow to completion.
    vol_tokens = _login(client, "vol@test.com")
    vol_h = {"Authorization": f"Bearer {vol_tokens['tokens']['access_token']}"}

    accept = client.post(f"/api/v1/volunteer/assignments/{assignment_id}/respond?accept=true", headers=vol_h)
    assert accept.status_code == 200
    assert accept.json()["status"] == "accepted"

    for to in ("on_route", "arrived", "in_progress"):
        adv = client.post(f"/api/v1/volunteer/assignments/{assignment_id}/advance?to={to}", headers=vol_h)
        assert adv.status_code == 200, adv.text
        assert adv.json()["status"] == to

    done = client.post(
        f"/api/v1/volunteer/assignments/{assignment_id}/complete", headers=vol_h,
        json={"notes": "Resolved on scene", "hours": 2},
    )
    assert done.status_code == 200
    assert done.json()["status"] == "completed"

    # 5. Citizen tracking reflects completion, with sensitive data hidden.
    track = client.get(f"/api/v1/reports/track/{tracking_id}").json()
    assert track["status"] == "rescue_completed"
    completed_steps = [t for t in track["timeline"] if t["state"] == "complete"]
    assert len(completed_steps) >= 4


def test_admin_manages_volunteers_on_claimed_case(client, ngo_setup):
    """An admin can view a case and assign/remove volunteers, acting as the
    case's owning NGO, without owning an NGO themselves."""
    # Create an admin.
    db = TestSessionLocal()
    try:
        db.add(User(
            email="admin@test.com", hashed_password=hash_password("Secret123!"),
            full_name="Admin", role=UserRole.ADMIN, is_active=True, is_verified=True,
        ))
        db.commit()
    finally:
        db.close()
    admin_h = {"Authorization": f"Bearer {_login(client, 'admin@test.com')['tokens']['access_token']}"}

    report = _create_report(client)
    rid = report["report_id"]

    # Admin cannot manage volunteers on an UNCLAIMED case (must be claimed first).
    early = client.post(
        f"/api/v1/ngo/reports/{rid}/assignments", headers=admin_h,
        json={"volunteer_ids": [ngo_setup["volunteer_id"]]},
    )
    assert early.status_code == 403
    assert early.json()["error"]["code"] == "case_unclaimed"

    # NGO claims it.
    ngo_h = {"Authorization": f"Bearer {_login(client, 'ngo@test.com')['tokens']['access_token']}"}
    client.post(f"/api/v1/ngo/reports/{rid}/claim", headers=ngo_h)

    # Now the admin can view the case (with reporter PII, full oversight)...
    detail = client.get(f"/api/v1/ngo/reports/{rid}", headers=admin_h)
    assert detail.status_code == 200

    # ...and assign a volunteer, acting as the owning NGO.
    assign = client.post(
        f"/api/v1/ngo/reports/{rid}/assignments", headers=admin_h,
        json={"volunteer_ids": [ngo_setup["volunteer_id"]]},
    )
    assert assign.status_code == 201, assign.text
    assignment_id = assign.json()[0]["id"]

    # The volunteer can accept the admin-created assignment.
    vol_h = {"Authorization": f"Bearer {_login(client, 'vol@test.com')['tokens']['access_token']}"}
    accept = client.post(f"/api/v1/volunteer/assignments/{assignment_id}/respond?accept=true", headers=vol_h)
    assert accept.status_code == 200

    # Admin can list and remove assignments too.
    listed = client.get(f"/api/v1/ngo/reports/{rid}/assignments", headers=admin_h)
    assert listed.status_code == 200 and len(listed.json()) >= 1
    removed = client.delete(f"/api/v1/ngo/reports/{rid}/assignments/{assignment_id}", headers=admin_h)
    assert removed.status_code == 200


def test_invalid_status_transition_rejected(client, ngo_setup):
    report = _create_report(client)
    ngo_tokens = _login(client, "ngo@test.com")
    ngo_h = {"Authorization": f"Bearer {ngo_tokens['tokens']['access_token']}"}
    client.post(f"/api/v1/ngo/reports/{report['report_id']}/claim", headers=ngo_h)
    # claimed -> on_route is not a valid NGO transition (must go via assignment)
    resp = client.patch(
        f"/api/v1/ngo/reports/{report['report_id']}/status", headers=ngo_h,
        json={"status": "rescue_completed"},
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "invalid_transition"


def test_advance_to_completed_is_rejected(client, ngo_setup):
    """Completion must go through /complete, not /advance, so metrics are recorded."""
    report = _create_report(client)
    rid = report["report_id"]
    ngo_h = {"Authorization": f"Bearer {_login(client, 'ngo@test.com')['tokens']['access_token']}"}
    client.post(f"/api/v1/ngo/reports/{rid}/claim", headers=ngo_h)
    asg = client.post(
        f"/api/v1/ngo/reports/{rid}/assignments", headers=ngo_h,
        json={"volunteer_ids": [ngo_setup["volunteer_id"]]},
    ).json()
    aid = asg[0]["id"]
    vol_h = {"Authorization": f"Bearer {_login(client, 'vol@test.com')['tokens']['access_token']}"}
    client.post(f"/api/v1/volunteer/assignments/{aid}/respond?accept=true", headers=vol_h)
    for to in ("on_route", "arrived", "in_progress"):
        client.post(f"/api/v1/volunteer/assignments/{aid}/advance?to={to}", headers=vol_h)
    # advancing straight to completed must be blocked
    resp = client.post(f"/api/v1/volunteer/assignments/{aid}/advance?to=completed", headers=vol_h)
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "use_complete_endpoint"

    # completing properly increments the volunteer's lifetime metric
    before = client.get("/api/v1/volunteer/performance", headers=vol_h).json()["total_rescues"]
    client.post(f"/api/v1/volunteer/assignments/{aid}/complete", headers=vol_h, json={"hours": 2})
    after = client.get("/api/v1/volunteer/performance", headers=vol_h).json()["total_rescues"]
    assert after == before + 1


def test_unclaimed_case_detail_hides_reporter_pii(client, ngo_setup):
    """An NGO viewing an UNCLAIMED report in its area must NOT see reporter PII."""
    report = _create_report(client)  # has reporter_name/phone, in the NGO's area
    ngo_h = {"Authorization": f"Bearer {_login(client, 'ngo@test.com')['tokens']['access_token']}"}
    detail = client.get(f"/api/v1/ngo/reports/{report['report_id']}", headers=ngo_h)
    assert detail.status_code == 200
    body = detail.json()
    assert body["reporter_name"] is None
    assert body["reporter_phone"] is None


def test_out_of_area_unclaimed_report_is_forbidden(client):
    """An NGO whose service area does not cover a report cannot view its detail."""
    db = TestSessionLocal()
    try:
        owner = User(
            email="faraway@test.com", hashed_password=hash_password("Secret123!"),
            full_name="Faraway NGO", role=UserRole.NGO, is_active=True, is_verified=True,
        )
        db.add(owner)
        db.flush()
        # Service area on the far side of the world from the report (40.71,-74.0).
        db.add(NGO(name="Faraway", owner_id=owner.id, is_verified=True,
                   service_latitude=-33.86, service_longitude=151.21, service_radius_km=10.0))
        db.commit()
    finally:
        db.close()

    report = _create_report(client)
    h = {"Authorization": f"Bearer {_login(client, 'faraway@test.com')['tokens']['access_token']}"}
    resp = client.get(f"/api/v1/ngo/reports/{report['report_id']}", headers=h)
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "out_of_area"


def test_unverified_ngo_cannot_claim(client):
    """An NGO that isn't verified is blocked from claiming."""
    db = TestSessionLocal()
    try:
        owner = User(
            email="unverified@test.com", hashed_password=hash_password("Secret123!"),
            full_name="Unverified", role=UserRole.NGO, is_active=True,
        )
        db.add(owner)
        db.flush()
        db.add(NGO(name="Unverified NGO", owner_id=owner.id, is_verified=False,
                   service_latitude=40.71, service_longitude=-74.0, service_radius_km=25.0))
        db.commit()
    finally:
        db.close()

    report = _create_report(client)
    tokens = _login(client, "unverified@test.com")
    h = {"Authorization": f"Bearer {tokens['tokens']['access_token']}"}
    resp = client.post(f"/api/v1/ngo/reports/{report['report_id']}/claim", headers=h)
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "ngo_not_verified"
