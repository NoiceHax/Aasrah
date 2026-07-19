"""Analytics + dashboard schemas."""

from __future__ import annotations

from pydantic import BaseModel


class KpiCards(BaseModel):
    total_rescues: int
    avg_response_minutes: float | None
    active_volunteers: int
    success_rate: float  # 0..1
    cases_this_month: int


class TimeSeriesPoint(BaseModel):
    label: str
    value: int


class HeatmapPoint(BaseModel):
    latitude: float
    longitude: float
    weight: int = 1


class AnalyticsOut(BaseModel):
    kpis: KpiCards
    daily_reports: list[TimeSeriesPoint]
    weekly_rescues: list[TimeSeriesPoint]
    volunteer_workload: list[TimeSeriesPoint]
    heatmap: list[HeatmapPoint]


class DashboardOut(BaseModel):
    pending_nearby: int
    claimed_cases: int
    active_rescues: int
    completed_rescues: int
    available_volunteers: int
    avg_response_minutes: float | None
    success_rate: float
    weekly_rescues: list[TimeSeriesPoint]
