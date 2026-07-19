"""Background processing of a report: AI summary + image analysis + priority.

Runs off the request path via the job runner. Always persists *something*
(heuristic results when no AI key), and never overwrites a value an NGO has
manually set (priority_auto=False).
"""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.logging import get_logger
from app.db.session import SessionLocal
from app.models.report import Report
from app.services.ai import provider
from app.services.intelligence import compute_priority, count_recent_nearby
from app.services.storage import get_storage

logger = get_logger(__name__)


def process_report(report_id: str | uuid.UUID) -> None:
    """Generate summary + analysis + priority for a report. Idempotent-ish:
    safe to run again after a new image is uploaded."""
    db = SessionLocal()
    try:
        report = db.scalars(
            select(Report).where(Report.id == report_id).options(selectinload(Report.images))
        ).first()
        if not report:
            return

        # 1. Summary (always refreshed).
        report.ai_summary = provider.summarize_report(
            situation=report.situation.value,
            description=report.description,
            address=report.address,
            children_present=report.children_present,
            people_count=report.people_count,
        )

        # 2. Image analysis on the first image (vision), else text heuristic.
        analysis = None
        if report.images:
            storage = get_storage()
            img = report.images[0]
            try:
                raw = storage.open(img.storage_key)
                analysis = provider.analyze_image(
                    raw, img.content_type or "image/jpeg",
                    situation=report.situation.value,
                    description=report.description,
                    children_present=report.children_present,
                )
            except Exception:  # noqa: BLE001
                logger.warning("Image analysis failed for report %s", report_id)
        if analysis is None:
            from app.services.ai import heuristic
            analysis = heuristic.analyze_text(
                report.situation.value, report.description, report.children_present
            )
        report.ai_analysis = analysis.model_dump()

        # 3. Priority score: only auto-set if not manually overridden.
        if report.priority_auto:
            nearby = count_recent_nearby(db, report)
            score, band = compute_priority(report, nearby_recent=nearby)
            report.priority_score = score
            report.priority = band

        db.commit()
        logger.info("Processed report %s (ai=%s)", report_id, analysis.source)
    except Exception:  # noqa: BLE001
        db.rollback()
        logger.exception("Failed to process report %s", report_id)
        raise
    finally:
        db.close()
