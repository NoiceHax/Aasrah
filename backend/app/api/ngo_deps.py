"""NGO-scoped dependencies: resolve the current user's NGO and enforce verification."""

from __future__ import annotations

from fastapi import Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.exceptions import ForbiddenError, NotFoundError
from app.db.session import get_db
from app.models.enums import UserRole
from app.models.ngo import NGO
from app.models.user import User
from app.repositories.ngo import NgoRepository


def get_current_ngo(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> NGO:
    """The NGO owned by the current user. Requires NGO (or admin) role.

    Used by NGO-only-meaningful routes (profile, analytics, discovery) where a
    concrete owned NGO is required. Admins have no owned NGO, so these routes
    are effectively NGO-only. Case-scoped routes should use the acting-NGO
    helpers below so an admin can operate as the case's owning NGO instead.
    """
    if user.role not in (UserRole.NGO, UserRole.ADMIN):
        raise ForbiddenError("NGO access required", code="ngo_role_required")
    ngo = NgoRepository(db).get_by_owner(user.id)
    if not ngo:
        raise NotFoundError("No NGO profile is linked to this account", code="ngo_not_found")
    return ngo


def is_admin(user: User) -> bool:
    return user.role == UserRole.ADMIN


def resolve_acting_ngo_for_report(db: Session, user: User, report) -> NGO:
    """Resolve the NGO a user acts as for a specific case.

    - NGO user: their own owned NGO (must be the case's owner, enforced by
      callers/`_owned_case`).
    - Admin: the case's OWNING NGO (``report.claimed_by_ngo_id``). Admins operate
      transparently on behalf of whichever NGO owns the case; they cannot act on
      an unclaimed case (no owner to act as); it must be claimed first.

    Raises the same errors the ownership model already uses, so callers keep
    behaving consistently.
    """
    if user.role not in (UserRole.NGO, UserRole.ADMIN):
        raise ForbiddenError("NGO access required", code="ngo_role_required")

    if user.role == UserRole.ADMIN:
        if report.claimed_by_ngo_id is None:
            raise ForbiddenError(
                "This case is unclaimed: it must be claimed by an NGO before "
                "volunteers can be managed",
                code="case_unclaimed",
            )
        ngo = db.get(NGO, report.claimed_by_ngo_id)
        if not ngo:
            raise NotFoundError("Owning NGO not found", code="ngo_not_found")
        return ngo

    ngo = NgoRepository(db).get_by_owner(user.id)
    if not ngo:
        raise NotFoundError("No NGO profile is linked to this account", code="ngo_not_found")
    return ngo


def get_verified_ngo(ngo: NGO = Depends(get_current_ngo)) -> NGO:
    """Like get_current_ngo, but also requires the NGO to be verified.

    Used to gate actions like claiming reports; only verified NGOs may claim.
    """
    if not ngo.is_verified:
        raise ForbiddenError(
            "Your organization must be verified to perform this action",
            code="ngo_not_verified",
        )
    return ngo
