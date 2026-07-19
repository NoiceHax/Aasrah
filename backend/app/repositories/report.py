"""Report repository."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.models.report import Report
from app.repositories.base import BaseRepository


class ReportRepository(BaseRepository[Report]):
    model = Report

    def get_by_tracking_id(self, tracking_id: str, *, with_images: bool = True) -> Report | None:
        stmt = select(Report).where(Report.tracking_id == tracking_id.upper())
        if with_images:
            stmt = stmt.options(
                selectinload(Report.images), selectinload(Report.timeline_events)
            )
        return self.db.scalars(stmt).first()

    def get_with_images(self, id_) -> Report | None:
        stmt = (
            select(Report).where(Report.id == id_).options(selectinload(Report.images))
        )
        return self.db.scalars(stmt).first()

    def tracking_id_exists(self, tracking_id: str) -> bool:
        stmt = select(Report.id).where(Report.tracking_id == tracking_id.upper())
        return self.db.scalars(stmt).first() is not None
