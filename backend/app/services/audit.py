"""Audit logging + notification + timeline helpers shared across NGO workflows."""

from __future__ import annotations

import uuid

from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog
from app.models.case_timeline import CaseTimelineEvent
from app.models.enums import NotificationType
from app.models.notification import Notification
from app.services.realtime import bus


def record_audit(
    db: Session,
    *,
    action: str,
    actor_id: uuid.UUID | None = None,
    entity_type: str | None = None,
    entity_id: str | None = None,
    ip_address: str | None = None,
    meta: dict | None = None,
) -> AuditLog:
    log = AuditLog(
        action=action,
        actor_id=actor_id,
        entity_type=entity_type,
        entity_id=entity_id,
        ip_address=ip_address,
        meta=meta,
    )
    db.add(log)
    return log


def add_timeline_event(
    db: Session,
    *,
    report_id: uuid.UUID,
    event_type: str,
    title: str,
    description: str | None = None,
    actor_id: uuid.UUID | None = None,
    is_public: bool = True,
) -> CaseTimelineEvent:
    event = CaseTimelineEvent(
        report_id=report_id,
        event_type=event_type,
        title=title,
        description=description,
        actor_id=actor_id,
        is_public=is_public,
    )
    db.add(event)
    return event


def notify(
    db: Session,
    *,
    user_id: uuid.UUID,
    title: str,
    body: str | None = None,
    type_: NotificationType = NotificationType.INFO,
) -> Notification:
    n = Notification(user_id=user_id, title=title, body=body, type=type_)
    db.add(n)
    # Real-time event for connected clients (no polling).
    bus.publish(
        user_id,
        "notification",
        {"title": title, "body": body, "type": type_.value},
    )
    # Web push to the user's devices (no-op if push isn't configured).
    from app.services.webpush import queue_push

    queue_push(user_id, title, body)
    return n
