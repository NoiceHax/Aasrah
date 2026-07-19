"""Web Push (VAPID) delivery to a user's subscribed devices.

No-ops gracefully when VAPID keys aren't configured. Runs via the job runner.
"""

from __future__ import annotations

import json
import uuid

from sqlalchemy import select

from app.core.config import settings
from app.core.logging import get_logger
from app.db.session import SessionLocal
from app.models.push_subscription import PushSubscription

logger = get_logger("aasrah.push")


def push_to_user(user_id: str | uuid.UUID, title: str, body: str | None = None) -> None:
    """Deliver a push notification to all of a user's subscriptions."""
    if not settings.push_enabled:
        return
    try:
        from pywebpush import WebPushException, webpush
    except ImportError:
        logger.warning("pywebpush not installed; skipping push")
        return

    db = SessionLocal()
    try:
        subs = db.scalars(
            select(PushSubscription).where(PushSubscription.user_id == str(user_id))
        ).all()
        payload = json.dumps({"title": title, "body": body or ""})
        for sub in subs:
            try:
                webpush(
                    subscription_info={
                        "endpoint": sub.endpoint,
                        "keys": {"p256dh": sub.p256dh, "auth": sub.auth},
                    },
                    data=payload,
                    vapid_private_key=settings.VAPID_PRIVATE_KEY,
                    vapid_claims={"sub": settings.VAPID_SUBJECT},
                )
            except WebPushException as exc:
                # 404/410 = subscription expired; remove it.
                if exc.response is not None and exc.response.status_code in (404, 410):
                    db.delete(sub)
                else:
                    logger.warning("Push failed for user %s: %s", user_id, exc)
        db.commit()
    finally:
        db.close()


def queue_push(user_id: str | uuid.UUID, title: str, body: str | None = None) -> None:
    from app.services.jobs import runner

    if settings.push_enabled:
        runner.enqueue("push.send", push_to_user, str(user_id), title, body)
