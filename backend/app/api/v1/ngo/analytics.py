"""NGO dashboard + analytics endpoints."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.ngo_deps import get_current_ngo
from app.db.session import get_db
from app.models.ngo import NGO
from app.schemas.analytics import AnalyticsOut, DashboardOut
from app.services.analytics import AnalyticsService

router = APIRouter(prefix="/ngo", tags=["ngo:analytics"])


@router.get("/dashboard", response_model=DashboardOut)
def dashboard(
    ngo: NGO = Depends(get_current_ngo),
    db: Session = Depends(get_db),
) -> DashboardOut:
    return AnalyticsService(db).dashboard(ngo)


@router.get("/analytics", response_model=AnalyticsOut)
def analytics(
    ngo: NGO = Depends(get_current_ngo),
    db: Session = Depends(get_db),
) -> AnalyticsOut:
    return AnalyticsService(db).analytics(ngo)
