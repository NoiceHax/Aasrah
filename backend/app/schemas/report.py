"""Report schemas."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import ReportPriority, ReportStatus, SituationType


class ReportCreate(BaseModel):
    situation: SituationType
    priority: ReportPriority = ReportPriority.MEDIUM
    description: str = Field(min_length=15, max_length=5000)
    address: str | None = Field(default=None, max_length=512)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    reporter_name: str | None = Field(default=None, max_length=255)
    reporter_phone: str | None = Field(default=None, max_length=32)


class ReportImageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    url: str
    width: int | None = None
    height: int | None = None
    position: int


class TimelineEvent(BaseModel):
    """Derived rescue-timeline step (Phase 2: single 'submitted' + status)."""

    key: str
    title: str
    description: str | None = None
    state: str  # complete | active | upcoming
    timestamp: datetime | None = None


class ReportOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    tracking_id: str
    situation: SituationType
    priority: ReportPriority
    status: ReportStatus
    description: str
    address: str | None
    latitude: float | None
    longitude: float | None
    created_at: datetime
    updated_at: datetime
    images: list[ReportImageOut] = []


class ReportCreateResponse(BaseModel):
    tracking_id: str
    status: ReportStatus
    created_at: datetime
    report_id: uuid.UUID


class NgoReportListItem(BaseModel):
    """A report as seen in the NGO discovery/management table."""

    id: uuid.UUID
    tracking_id: str
    situation: SituationType
    priority: ReportPriority
    status: ReportStatus
    address: str | None
    latitude: float | None
    longitude: float | None
    children_present: bool
    people_count: int | None
    distance_km: float | None = None
    claimed_by_ngo_id: uuid.UUID | None = None
    claimed_by_name: str | None = None
    image_count: int = 0
    created_at: datetime


class PaginatedReports(BaseModel):
    items: list[NgoReportListItem]
    total: int
    page: int
    page_size: int
    pages: int


class CaseTimelineItem(BaseModel):
    id: uuid.UUID
    event_type: str
    title: str
    description: str | None
    actor_id: uuid.UUID | None
    is_public: bool
    created_at: datetime


class CaseDetailOut(BaseModel):
    """Full case view for NGO staff: includes reporter contact details."""

    id: uuid.UUID
    tracking_id: str
    situation: SituationType
    priority: ReportPriority
    status: ReportStatus
    description: str
    address: str | None
    latitude: float | None
    longitude: float | None
    children_present: bool
    people_count: int | None
    reporter_name: str | None
    reporter_phone: str | None
    distance_km: float | None = None
    claimed_by_ngo_id: uuid.UUID | None
    claimed_at: datetime | None
    closed_at: datetime | None
    created_at: datetime
    updated_at: datetime
    images: list[ReportImageOut] = []
    timeline: list[CaseTimelineItem] = []
    # AI assistance (advisory).
    ai_summary: str | None = None
    ai_analysis: dict | None = None
    priority_score: float | None = None
    priority_auto: bool = True
    duplicate_of_id: uuid.UUID | None = None


class StatusUpdateRequest(BaseModel):
    status: ReportStatus
    note: str | None = Field(default=None, max_length=1000)


class PriorityOverrideRequest(BaseModel):
    priority: ReportPriority


class AnalysisOverrideRequest(BaseModel):
    """NGO correction of AI analysis fields (any subset)."""

    age_range: str | None = None
    gender: str | None = None
    children_present: bool | None = None
    visible_injuries: bool | None = None
    needs_medical: bool | None = None
    needs_food_or_shelter: bool | None = None


class ReportTrackingOut(BaseModel):
    """Public-facing tracking view: no sensitive reporter contact details."""

    tracking_id: str
    situation: SituationType
    priority: ReportPriority
    status: ReportStatus
    description: str
    address: str | None
    latitude: float | None
    longitude: float | None
    created_at: datetime
    updated_at: datetime
    images: list[ReportImageOut] = []
    timeline: list[TimelineEvent] = []
