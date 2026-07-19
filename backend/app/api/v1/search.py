"""Global search across reports, NGOs, volunteers, and users (role-scoped)."""

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.enums import UserRole
from app.models.ngo import NGO
from app.models.report import Report
from app.models.user import User
from app.models.volunteer import Volunteer

router = APIRouter(prefix="/search", tags=["search"])


class SearchHit(BaseModel):
    kind: str  # report | ngo | volunteer | user
    id: str
    label: str
    sublabel: str | None = None
    href: str | None = None


class SearchResults(BaseModel):
    hits: list[SearchHit]


@router.get("", response_model=SearchResults)
def global_search(
    q: str = Query(..., min_length=2, max_length=120),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SearchResults:
    term = f"%{q.strip()}%"
    hits: list[SearchHit] = []
    is_admin = user.role == UserRole.ADMIN
    is_staff = user.role in (UserRole.ADMIN, UserRole.NGO)

    # Reports (by tracking id / address): staff only.
    if is_staff:
        for r in db.scalars(
            select(Report)
            .where(or_(Report.tracking_id.ilike(term), Report.address.ilike(term)))
            .limit(8)
        ).all():
            hits.append(
                SearchHit(
                    kind="report", id=str(r.id), label=f"#{r.tracking_id}",
                    sublabel=r.address or r.situation.value,
                    href=f"/portal/cases/{r.id}",
                )
            )

    # NGOs: everyone can find verified orgs; admins see all.
    ngo_stmt = select(NGO).where(NGO.name.ilike(term)).limit(6)
    if not is_admin:
        ngo_stmt = ngo_stmt.where(NGO.is_verified.is_(True))
    for n in db.scalars(ngo_stmt).all():
        hits.append(
            SearchHit(kind="ngo", id=str(n.id), label=n.name, sublabel=n.focus_area)
        )

    # Volunteers + users: admin only.
    if is_admin:
        for v in db.scalars(
            select(Volunteer).join(User, Volunteer.user_id == User.id)
            .where(or_(User.full_name.ilike(term), User.email.ilike(term)))
            .limit(6)
        ).all():
            hits.append(
                SearchHit(
                    kind="volunteer", id=str(v.id),
                    label=v.user.full_name or v.user.email,
                    sublabel=v.role_title, href="/admin/volunteers",
                )
            )
        for u in db.scalars(
            select(User).where(or_(User.full_name.ilike(term), User.email.ilike(term))).limit(6)
        ).all():
            hits.append(
                SearchHit(
                    kind="user", id=str(u.id), label=u.full_name or u.email,
                    sublabel=u.role.value, href="/admin/users",
                )
            )

    return SearchResults(hits=hits)
