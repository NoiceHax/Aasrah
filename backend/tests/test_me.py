"""Data-subject rights: /me/export (access) and DELETE /me (erasure)."""

from __future__ import annotations

import uuid

import pytest
from sqlalchemy import select

from app.core.config import settings
from app.main import app
from app.models.audit_log import AuditLog
from app.models.push_subscription import PushSubscription
from app.models.report import Report
from app.models.session import Session as AuthSession
from tests.conftest import auth_header, register

PREFIX = settings.API_V1_PREFIX


@pytest.fixture(autouse=True, scope="module")
def _mount_me_router():
    """Mount the /me router if the aggregate router hasn't already.

    Keeps these tests green whether or not `me.router` has been added to
    api/v1/router.py yet; once it is, this is a no-op.
    """
    if not any(getattr(r, "path", "") == f"{PREFIX}/me/export" for r in app.routes):
        from app.api.v1 import me

        app.include_router(me.router, prefix=PREFIX)
    yield


def _make_report(client, headers: dict) -> str:
    resp = client.post(f"{PREFIX}/reports", json={
        "situation": "shelter",
        "description": "Adult sleeping rough outside the bus terminal, no blanket.",
        "address": "Bus terminal",
        "reporter_name": "Test User",
        "reporter_phone": "+911234567890",
    }, headers=headers)
    assert resp.status_code == 201, resp.text
    return resp.json()["report_id"]


def test_export_requires_auth(client):
    assert client.get(f"{PREFIX}/me/export").status_code == 401


def test_export_returns_own_data(client):
    tokens = register(client, "export@example.com")
    headers = auth_header(tokens)
    _make_report(client, headers)

    resp = client.get(f"{PREFIX}/me/export", headers=headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["account"]["email"] == "export@example.com"
    assert len(body["reports"]) == 1
    assert "exported_at" in body
    # Push key material must never appear in an export file.
    assert body["push_subscriptions"] == []


def test_export_excludes_other_users_reports(client):
    mine = auth_header(register(client, "mine@example.com"))
    theirs = auth_header(register(client, "theirs@example.com"))
    _make_report(client, theirs)

    body = client.get(f"{PREFIX}/me/export", headers=mine).json()
    assert body["reports"] == []


def test_delete_requires_correct_password(client):
    headers = auth_header(register(client, "wrongpw@example.com"))
    resp = client.request("DELETE", f"{PREFIX}/me", headers=headers,
                          json={"password": "NotMyPassword1!"})
    assert resp.status_code == 401
    # Account survives an incorrect confirmation.
    assert client.get(f"{PREFIX}/me/export", headers=headers).status_code == 200


def test_delete_erases_account_and_preserves_audit_trail(client, db):
    tokens = register(client, "erase@example.com")
    headers = auth_header(tokens)
    report_id = uuid.UUID(_make_report(client, headers))
    user_id = uuid.UUID(tokens["user"]["id"])

    client.post(f"{PREFIX}/push/subscribe", headers=headers, json={
        "endpoint": "https://push.example.com/abc",
        "keys": {"p256dh": "key", "auth": "auth"},
    })

    resp = client.request("DELETE", f"{PREFIX}/me", headers=headers,
                          json={"password": "Secret123!"})
    assert resp.status_code == 200, resp.text

    # Token is dead and the account is gone.
    assert client.get(f"{PREFIX}/me/export", headers=headers).status_code == 401

    # The report survives, de-identified.
    report = db.scalars(select(Report).where(Report.id == report_id)).first()
    assert report is not None
    assert report.reporter_id is None
    assert report.reporter_name is None
    assert report.reporter_phone is None

    # Sessions and push subscriptions are gone.
    assert db.scalars(select(AuthSession).where(AuthSession.user_id == user_id)).all() == []
    assert db.scalars(
        select(PushSubscription).where(PushSubscription.user_id == user_id)
    ).all() == []

    # Audit rows survive; none of them still points at the erased user.
    logs = db.scalars(select(AuditLog)).all()
    assert any(log.action == "user.erased" and log.entity_id == str(user_id) for log in logs)
    assert all(log.actor_id is None or log.actor_id != user_id for log in logs)
