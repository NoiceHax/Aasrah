"""Public platform statistics for the marketing site.

These are real, live counts; no fabricated figures. On a fresh deployment
they are legitimately small (often zero), and the frontend renders honest
values that grow as the platform is used.
"""

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.enums import ReportStatus, VolunteerStatus
from app.models.ngo import NGO
from app.models.report import Report
from app.models.volunteer import Volunteer
from app.schemas.stats import PublicNgoOut, PublicStats

router = APIRouter(prefix="/stats", tags=["stats"])

_COMPLETED = {
    ReportStatus.RESCUE_COMPLETED,
    ReportStatus.SHELTER_ASSIGNED,
    ReportStatus.RESOLVED,
    ReportStatus.CLOSED,
}


@router.get("", response_model=PublicStats)
def public_stats(db: Session = Depends(get_db)) -> PublicStats:
    total_reports = db.scalar(select(func.count()).select_from(Report)) or 0
    rescues_completed = db.scalar(
        select(func.count()).select_from(Report).where(Report.status.in_(_COMPLETED))
    ) or 0
    verified_ngos = db.scalar(
        select(func.count()).select_from(NGO).where(NGO.is_verified.is_(True))
    ) or 0
    active_volunteers = db.scalar(
        select(func.count()).select_from(Volunteer).where(
            Volunteer.status == VolunteerStatus.ACTIVE
        )
    ) or 0
    return PublicStats(
        total_reports=total_reports,
        rescues_completed=rescues_completed,
        verified_ngos=verified_ngos,
        active_volunteers=active_volunteers,
    )


@router.get("/ngos", response_model=list[PublicNgoOut])
def public_ngo_directory(db: Session = Depends(get_db)) -> list[PublicNgoOut]:
    """Verified NGOs, for public contexts such as a volunteer choosing a
    preferred organisation. Only non-sensitive fields are exposed."""
    ngos = db.scalars(
        select(NGO).where(NGO.is_verified.is_(True)).order_by(NGO.name)
    ).all()
    return [
        PublicNgoOut(id=n.id, name=n.name, focus_area=n.focus_area, location=n.location, website=n.website)
        for n in ngos
    ]
