"""Cross-tenant access control regressions.

Each test here corresponds to a confirmed data-leak fix:
  * discovery/search must fail CLOSED when an NGO has no service area;
  * one NGO must not be able to reach another NGO's claimed case via the
    duplicate-detection / merge endpoints;
  * a self-registered (PENDING) volunteer must not be able to read an
    arbitrary report by UUID.
"""

from __future__ import annotations

import pytest

from app.core.security import hash_password
from app.models.enums import UserRole, VolunteerStatus
from app.models.ngo import NGO
from app.models.user import User
from app.models.volunteer import Volunteer
from tests.conftest import TestSessionLocal, register


def _login(client, email: str, password: str = "Secret123!") -> dict:
    return client.post("/api/v1/auth/login", json={"email": email, "password": password}).json()


def _h(client, email: str) -> dict:
    return {"Authorization": f"Bearer {_login(client, email)['tokens']['access_token']}"}


def _make_ngo(email: str, name: str, *, lat, lon, radius: float = 25.0, verified: bool = True):
    db = TestSessionLocal()
    try:
        owner = User(
            email=email, hashed_password=hash_password("Secret123!"),
            full_name=name, role=UserRole.NGO, is_active=True, is_verified=True,
        )
        db.add(owner)
        db.flush()
        ngo = NGO(
            name=name, owner_id=owner.id, is_verified=verified,
            service_latitude=lat, service_longitude=lon, service_radius_km=radius,
        )
        db.add(ngo)
        db.commit()
        return ngo.id
    finally:
        db.close()


def _create_report(client, *, lat=40.7130, lon=-74.0055) -> dict:
    return client.post("/api/v1/reports", json={
        "situation": "medical", "priority": "critical",
        "description": "Critical medical emergency requiring immediate response now.",
        "address": "Downtown", "latitude": lat, "longitude": lon,
    }).json()


# --- 1. Fail closed with no service area -------------------------------------

@pytest.fixture
def arealess_ngo():
    """A verified NGO whose service coordinates have been nulled out."""
    db = TestSessionLocal()
    try:
        owner = User(
            email="noarea@test.com", hashed_password=hash_password("Secret123!"),
            full_name="No Area", role=UserRole.NGO, is_active=True, is_verified=True,
        )
        db.add(owner)
        db.flush()
        db.add(NGO(
            name="No Area NGO", owner_id=owner.id, is_verified=True,
            service_latitude=None, service_longitude=None, service_radius_km=25.0,
        ))
        db.commit()
    finally:
        db.close()


def test_null_service_area_returns_nothing_not_everything(client, arealess_ngo):
    _create_report(client)
    _create_report(client, lat=-33.86, lon=151.21)

    h = _h(client, "noarea@test.com")

    nearby = client.get("/api/v1/ngo/reports/nearby", headers=h)
    assert nearby.status_code == 200, nearby.text
    assert nearby.json()["items"] == []
    assert nearby.json()["total"] == 0

    search = client.get("/api/v1/ngo/search", headers=h, params={"q": "medical emergency"})
    assert search.status_code == 200, search.text
    assert search.json()["results"] == []
    assert search.json()["count"] == 0


def test_ngo_with_area_still_sees_reports_in_range(client):
    """Sanity check that failing closed didn't break the normal path."""
    _make_ngo("inarea@test.com", "In Area NGO", lat=40.7128, lon=-74.0060)
    report = _create_report(client)
    nearby = client.get("/api/v1/ngo/reports/nearby", headers=_h(client, "inarea@test.com"))
    assert nearby.status_code == 200
    assert any(i["id"] == report["report_id"] for i in nearby.json()["items"])


# --- 2. Cross-NGO discovery / duplicate / merge -------------------------------

def test_discovery_and_search_hide_another_ngos_claimed_case(client):
    """Two NGOs in the same metro: A's claimed case must vanish from B's views."""
    _make_ngo("a@test.com", "NGO A", lat=40.7128, lon=-74.0060)
    _make_ngo("b@test.com", "NGO B", lat=40.7128, lon=-74.0060)

    report = _create_report(client)
    rid = report["report_id"]

    a_h = _h(client, "a@test.com")
    assert client.post(f"/api/v1/ngo/reports/{rid}/claim", headers=a_h).status_code == 200

    b_h = _h(client, "b@test.com")
    nearby = client.get("/api/v1/ngo/reports/nearby", headers=b_h).json()
    assert all(i["id"] != rid for i in nearby["items"])

    search = client.get("/api/v1/ngo/search", headers=b_h, params={"q": "medical"}).json()
    assert all(r["id"] != rid for r in search["results"])


def test_ngo_b_cannot_read_duplicates_of_ngo_a_case(client):
    _make_ngo("a@test.com", "NGO A", lat=40.7128, lon=-74.0060)
    _make_ngo("b@test.com", "NGO B", lat=40.7128, lon=-74.0060)

    rid = _create_report(client)["report_id"]
    client.post(f"/api/v1/ngo/reports/{rid}/claim", headers=_h(client, "a@test.com"))

    resp = client.get(f"/api/v1/ngo/reports/{rid}/duplicates", headers=_h(client, "b@test.com"))
    assert resp.status_code == 403, resp.text
    assert resp.json()["error"]["code"] == "not_your_case"


def test_ngo_b_cannot_merge_ngo_a_case(client):
    """Merging is destructive to triage: it must be owner-only in both directions."""
    _make_ngo("a@test.com", "NGO A", lat=40.7128, lon=-74.0060)
    _make_ngo("b@test.com", "NGO B", lat=40.7128, lon=-74.0060)

    primary = _create_report(client)["report_id"]
    other = _create_report(client)["report_id"]

    a_h = _h(client, "a@test.com")
    client.post(f"/api/v1/ngo/reports/{primary}/claim", headers=a_h)

    b_h = _h(client, "b@test.com")
    # B cannot use A's case as the merge primary.
    resp = client.post(
        f"/api/v1/ngo/reports/{primary}/merge", headers=b_h, json={"duplicate_id": other}
    )
    assert resp.status_code == 403, resp.text
    assert resp.json()["error"]["code"] == "not_your_case"

    # Nor can B bury A's live case as a "duplicate" of a case B owns.
    b_case = _create_report(client)["report_id"]
    client.post(f"/api/v1/ngo/reports/{b_case}/claim", headers=b_h)
    resp = client.post(
        f"/api/v1/ngo/reports/{b_case}/merge", headers=b_h, json={"duplicate_id": primary}
    )
    assert resp.status_code == 403, resp.text
    assert resp.json()["error"]["code"] == "not_your_case"


def test_ngo_b_cannot_read_match_candidates_for_ngo_a_case(client):
    _make_ngo("a@test.com", "NGO A", lat=40.7128, lon=-74.0060)
    _make_ngo("b@test.com", "NGO B", lat=40.7128, lon=-74.0060)
    rid = _create_report(client)["report_id"]
    client.post(f"/api/v1/ngo/reports/{rid}/claim", headers=_h(client, "a@test.com"))

    resp = client.get(f"/api/v1/ngo/reports/{rid}/match", headers=_h(client, "b@test.com"))
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "not_your_case"


# --- 3. Unverified NGO must not enumerate nearby reports ----------------------

def test_unverified_ngo_cannot_enumerate_nearby(client):
    _make_ngo("unv@test.com", "Unverified NGO", lat=40.7128, lon=-74.0060, verified=False)
    _create_report(client)
    resp = client.get("/api/v1/ngo/reports/nearby", headers=_h(client, "unv@test.com"))
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "ngo_not_verified"


# --- 4. PENDING volunteer must not read arbitrary reports ---------------------

def test_pending_volunteer_cannot_read_arbitrary_report(client):
    """Self-registration yields a PENDING VOLUNTEER; the role alone must not
    unlock a report's description, address and exact coordinates."""
    # Self-registration creates the VOLUNTEER user + a PENDING profile.
    register(client, "pending-vol@test.com", full_name="Pending Vol")

    rid = _create_report(client)["report_id"]

    resp = client.get(f"/api/v1/reports/{rid}", headers=_h(client, "pending-vol@test.com"))
    assert resp.status_code == 403, resp.text
    assert resp.json()["error"]["code"] == "not_assigned_to_case"


def test_assigned_volunteer_can_read_their_report(client):
    """The scoping must not break the legitimate volunteer read path."""
    ngo_id = _make_ngo("ngo-x@test.com", "NGO X", lat=40.7128, lon=-74.0060)
    db = TestSessionLocal()
    try:
        vuser = User(
            email="vol-x@test.com", hashed_password=hash_password("Secret123!"),
            full_name="Vol X", role=UserRole.VOLUNTEER, is_active=True, is_verified=True,
        )
        db.add(vuser)
        db.flush()
        vol = Volunteer(
            user_id=vuser.id, ngo_id=ngo_id, status=VolunteerStatus.ACTIVE,
            is_available=True, skills="First Aid",
        )
        db.add(vol)
        db.commit()
        vol_id = str(vol.id)
    finally:
        db.close()

    rid = _create_report(client)["report_id"]
    ngo_h = _h(client, "ngo-x@test.com")
    client.post(f"/api/v1/ngo/reports/{rid}/claim", headers=ngo_h)
    assigned = client.post(
        f"/api/v1/ngo/reports/{rid}/assignments", headers=ngo_h,
        json={"volunteer_ids": [vol_id]},
    )
    assert assigned.status_code == 201, assigned.text

    resp = client.get(f"/api/v1/reports/{rid}", headers=_h(client, "vol-x@test.com"))
    assert resp.status_code == 200, resp.text
    assert resp.json()["id"] == rid


def test_ngo_cannot_read_another_ngos_report_by_id(client):
    _make_ngo("a@test.com", "NGO A", lat=40.7128, lon=-74.0060)
    _make_ngo("b@test.com", "NGO B", lat=40.7128, lon=-74.0060)
    rid = _create_report(client)["report_id"]
    client.post(f"/api/v1/ngo/reports/{rid}/claim", headers=_h(client, "a@test.com"))

    resp = client.get(f"/api/v1/reports/{rid}", headers=_h(client, "b@test.com"))
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "not_your_case"
