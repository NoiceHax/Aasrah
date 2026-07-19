"""Volunteer-scoped dependency: resolve the current user's volunteer record."""

from __future__ import annotations

from fastapi import Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.exceptions import ForbiddenError, NotFoundError
from app.db.session import get_db
from app.models.enums import UserRole, VolunteerStatus
from app.models.user import User
from app.models.volunteer import Volunteer
from app.repositories.ngo import VolunteerRepository


def get_current_volunteer(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Volunteer:
    """Resolve the volunteer profile for the current user, regardless of
    approval status. Used for read/manage-own-profile endpoints so a PENDING
    applicant can still see and edit their application."""
    if user.role not in (UserRole.VOLUNTEER, UserRole.ADMIN):
        raise ForbiddenError("Volunteer access required", code="volunteer_role_required")
    vol = VolunteerRepository(db).get_by_user(user.id)
    if not vol:
        raise NotFoundError("No volunteer profile is linked to this account", code="volunteer_not_found")
    return vol


def get_active_volunteer(
    vol: Volunteer = Depends(get_current_volunteer),
) -> Volunteer:
    """Like get_current_volunteer but requires the volunteer to be APPROVED
    (ACTIVE). PENDING applicants and deactivated volunteers cannot accept or
    progress rescue assignments. Admins are exempt from the status check via
    the underlying role bypass, but a real volunteer must be ACTIVE."""
    if vol.status != VolunteerStatus.ACTIVE:
        raise ForbiddenError(
            "Your volunteer account is awaiting administrator approval",
            code="volunteer_not_approved",
        )
    return vol
