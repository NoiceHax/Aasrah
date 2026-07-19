"""Notification center: works for any authenticated user (NGO, volunteer, citizen)."""

import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.exceptions import NotFoundError
from app.db.session import get_db
from app.models.enums import NotificationType
from app.models.notification import Notification
from app.models.user import User
from app.schemas.auth import MessageResponse
from app.schemas.notification import NotificationList, NotificationOut

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=NotificationList)
def list_notifications(
    unread_only: bool = Query(default=False),
    type: NotificationType | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> NotificationList:
    stmt = (
        select(Notification)
        .where(Notification.user_id == user.id)
        .order_by(Notification.created_at.desc())
        .limit(limit)
    )
    if unread_only:
        stmt = stmt.where(Notification.is_read.is_(False))
    if type:
        stmt = stmt.where(Notification.type == type)
    items = [NotificationOut.model_validate(n) for n in db.scalars(stmt).all()]

    unread = db.scalar(
        select(func.count())
        .select_from(Notification)
        .where(Notification.user_id == user.id, Notification.is_read.is_(False))
    ) or 0
    return NotificationList(items=items, unread_count=unread)


@router.post("/{notification_id}/read", response_model=MessageResponse)
def mark_read(
    notification_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MessageResponse:
    n = db.get(Notification, notification_id)
    if not n or n.user_id != user.id:
        raise NotFoundError("Notification not found")
    n.is_read = True
    db.commit()
    return MessageResponse(message="Marked as read")


@router.post("/read-all", response_model=MessageResponse)
def mark_all_read(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MessageResponse:
    db.execute(
        update(Notification)
        .where(Notification.user_id == user.id, Notification.is_read.is_(False))
        .values(is_read=True)
    )
    db.commit()
    return MessageResponse(message="All notifications marked as read")
