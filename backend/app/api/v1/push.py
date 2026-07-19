"""Web Push subscription management."""

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import settings
from app.db.session import get_db
from app.models.push_subscription import PushSubscription
from app.models.user import User
from app.schemas.auth import MessageResponse

router = APIRouter(prefix="/push", tags=["push"])


class PushKeys(BaseModel):
    p256dh: str
    auth: str


class SubscribeRequest(BaseModel):
    endpoint: str
    keys: PushKeys


@router.get("/vapid-public-key")
def vapid_public_key() -> dict:
    """Public VAPID key the browser needs to subscribe (null if push disabled)."""
    return {"public_key": settings.VAPID_PUBLIC_KEY, "enabled": settings.push_enabled}


@router.post("/subscribe", response_model=MessageResponse)
def subscribe(
    body: SubscribeRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MessageResponse:
    existing = db.scalars(
        select(PushSubscription).where(
            PushSubscription.user_id == user.id,
            PushSubscription.endpoint == body.endpoint,
        )
    ).first()
    if existing:
        existing.p256dh = body.keys.p256dh
        existing.auth = body.keys.auth
    else:
        db.add(PushSubscription(
            user_id=user.id, endpoint=body.endpoint,
            p256dh=body.keys.p256dh, auth=body.keys.auth,
        ))
    db.commit()
    return MessageResponse(message="Subscribed to push notifications")


@router.post("/unsubscribe", response_model=MessageResponse)
def unsubscribe(
    body: SubscribeRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MessageResponse:
    sub = db.scalars(
        select(PushSubscription).where(
            PushSubscription.user_id == user.id,
            PushSubscription.endpoint == body.endpoint,
        )
    ).first()
    if sub:
        db.delete(sub)
        db.commit()
    return MessageResponse(message="Unsubscribed")
