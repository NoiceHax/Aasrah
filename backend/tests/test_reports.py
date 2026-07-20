"""Citizen report submission + public tracking tests."""

import io
import struct
import zlib


def _png_bytes() -> bytes:
    """Smallest valid 1x1 PNG, built inline so the suite needs no fixture file.

    Upload validation sniffs magic bytes and re-encodes through Pillow, so the
    payload has to be a genuinely decodable image, not just a header.
    """

    def chunk(tag: bytes, data: bytes) -> bytes:
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    ihdr = struct.pack(">IIBBBBB", 1, 1, 8, 2, 0, 0, 0)
    idat = zlib.compress(b"\x00\xff\xff\xff")
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", idat) + chunk(b"IEND", b"")


def _upload(client, report_id: str, *, token: str | None = None):
    headers = {"X-Upload-Token": token} if token else {}
    return client.post(
        f"/api/v1/reports/{report_id}/images",
        files={"files": ("photo.png", io.BytesIO(_png_bytes()), "image/png")},
        headers=headers,
    )


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


def test_track_report_withholds_subject_details(client):
    """The public view must not expose the reported person's location or media.

    This endpoint needs no authentication, so everything it returns is readable
    by anyone holding the tracking ID.
    """
    created = _create_report(client).json()
    data = client.get(f"/api/v1/reports/track/{created['tracking_id']}").json()
    for leaked in ("description", "latitude", "longitude", "address", "images"):
        assert leaked not in data, f"{leaked} must not be in the public tracking view"
    # A coarse area is fine: enough to recognise your own report, not to locate anyone.
    assert data["locality"] == "Central Market"


def test_minor_subject_forces_critical_priority(client):
    """A reporter saying the subject is a child outranks the client's priority.

    The client asked for "stable"; the server must pin the case to critical so
    it cannot be triaged (or AI-scored) down.
    """
    created = _create_report(client, subject_is_minor=True, priority="stable")
    assert created.status_code == 201, created.text
    data = client.get(f"/api/v1/reports/track/{created.json()['tracking_id']}").json()
    assert data["priority"] == "critical"


def test_track_unknown_tracking_id_404(client):
    assert client.get("/api/v1/reports/track/AR-NOPE99").status_code == 404


def test_report_create_issues_upload_token(client):
    body = _create_report(client).json()
    assert body["upload_token"]


def test_image_upload_requires_authorization(client):
    """An open upload endpoint is storage abuse plus evidence planting."""
    created = _create_report(client).json()
    resp = _upload(client, created["report_id"])
    assert resp.status_code == 401, resp.text


def test_image_upload_accepts_valid_upload_token(client):
    created = _create_report(client).json()
    resp = _upload(client, created["report_id"], token=created["upload_token"])
    assert resp.status_code == 200, resp.text
    assert len(resp.json()["images"]) == 1


def test_upload_token_is_scoped_to_its_own_report(client):
    """A token for report A must not attach images to report B."""
    first = _create_report(client).json()
    second = _create_report(client).json()
    resp = _upload(client, second["report_id"], token=first["upload_token"])
    assert resp.status_code == 401, resp.text
