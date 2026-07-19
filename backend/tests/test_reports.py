"""Citizen report submission + public tracking tests."""


def _create_report(client, **overrides) -> dict:
    payload = {
        "situation": "medical",
        "priority": "high",
        "description": "Person collapsed near the market and needs urgent help.",
        "address": "Central Market",
        "latitude": 40.7128,
        "longitude": -74.0060,
        "reporter_name": "Jane",
        "reporter_phone": "+1-555-0100",
    }
    payload.update(overrides)
    return client.post("/api/v1/reports", json=payload)


def test_anonymous_report_creates_tracking_id(client):
    resp = _create_report(client)
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["tracking_id"].startswith("AR-")
    assert body["status"] == "pending"
    assert body["report_id"]


def test_report_description_validation(client):
    resp = _create_report(client, description="too short")
    assert resp.status_code == 422


def test_track_report_public_hides_reporter_phone(client):
    created = _create_report(client).json()
    tid = created["tracking_id"]
    resp = client.get(f"/api/v1/reports/track/{tid}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["tracking_id"] == tid
    assert data["status"] == "pending"
    assert "reporter_phone" not in data  # sensitive field never exposed
    assert len(data["timeline"]) >= 1
    assert data["timeline"][0]["state"] == "active"


def test_track_unknown_tracking_id_404(client):
    assert client.get("/api/v1/reports/track/AR-NOPE99").status_code == 404
