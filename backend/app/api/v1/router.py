"""Aggregate v1 router."""

from fastapi import APIRouter

from app.api.v1 import (
    admin,
    admin_ops,
    auth,
    files,
    health,
    maps,
    me,
    push,
    reports,
    search,
    stats,
    volunteer,
    ws,
)
from app.api.v1.ngo import analytics as ngo_analytics
from app.api.v1.ngo import case_extras as ngo_case_extras
from app.api.v1.ngo import discovery as ngo_discovery
from app.api.v1.ngo import intelligence as ngo_intelligence
from app.api.v1.ngo import notifications as ngo_notifications
from app.api.v1.ngo import profile as ngo_profile
from app.api.v1.ngo import reports as ngo_reports
from app.api.v1.ngo import volunteers as ngo_volunteers

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(me.router)
api_router.include_router(reports.router)
api_router.include_router(stats.router)
api_router.include_router(maps.router)
api_router.include_router(search.router)
api_router.include_router(push.router)
api_router.include_router(ws.router)
api_router.include_router(files.router)
api_router.include_router(ngo_profile.router)
api_router.include_router(ngo_reports.router)
api_router.include_router(ngo_case_extras.router)
api_router.include_router(ngo_volunteers.router)
api_router.include_router(ngo_analytics.router)
api_router.include_router(ngo_notifications.router)
api_router.include_router(ngo_intelligence.router)
api_router.include_router(ngo_discovery.router)
api_router.include_router(volunteer.router)
api_router.include_router(admin.router)
api_router.include_router(admin_ops.router)
