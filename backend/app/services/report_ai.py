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
from app.models.enums import ReportPriority
from app.models.report import Report
from app.services.ai import heuristic, provider
from app.services.intelligence import compute_priority, count_recent_nearby
from app.services.storage import get_storage

logger = get_logger(__name__)

# Lowest -> highest. Used to measure how far the AI moved the band.
_BANDS: tuple[ReportPriority, ...] = (
    ReportPriority.STABLE,
    ReportPriority.MEDIUM,
    ReportPriority.HIGH,
    ReportPriority.CRITICAL,
)

# Score window each band occupies, mirroring the thresholds in
# intelligence.compute_priority. Used to keep the displayed score consistent
# with a band that has been clamped.
_BAND_SCORE_RANGE: dict[ReportPriority, tuple[float, float]] = {
    ReportPriority.STABLE: (0.0, 19.9),
    ReportPriority.MEDIUM: (20.0, 44.9),
    ReportPriority.HIGH: (45.0, 69.9),
    ReportPriority.CRITICAL: (70.0, 100.0),
}


def _clamp_ai_band(ai_band: ReportPriority, baseline_band: ReportPriority) -> ReportPriority:
    """Limit how far model-derived analysis may move the priority band.

    The AI's inputs include anonymous, unauthenticated free text, so its output
    is attacker-influenced (see the injection notes in services/ai/provider.py).
    Left unbounded, a crafted `description` can push a report to CRITICAL and
    jump the queue ahead of a genuine emergency, or suppress a real one to
    STABLE. So the model is treated as a *nudge* on the deterministic heuristic
    baseline, never as the decision:

      * it may move the band at most one step, up or down; and
      * it can never reach CRITICAL on its own -- only the heuristic baseline
        (or a human, via priority_auto=False) may declare a critical case.

    NGO staff can still override manually, and nothing here lowers a band the
    baseline itself assigned.
    """
    ai_idx = _BANDS.index(ai_band)
    base_idx = _BANDS.index(baseline_band)
    critical_idx = _BANDS.index(ReportPriority.CRITICAL)

    clamped = max(base_idx - 1, min(ai_idx, base_idx + 1))
    if clamped == critical_idx and base_idx != critical_idx:
        clamped = critical_idx - 1
    return _BANDS[clamped]


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
        # Deterministic baseline from the report's structured fields + keyword
        # rules. Also the fallback when there is no usable AI analysis.
        baseline = heuristic.analyze_text(
            report.situation.value, report.description, report.children_present
        )
        if analysis is None:
            analysis = baseline
        report.ai_analysis = analysis.model_dump()

        # 3. Priority score: only auto-set if not manually overridden.
        if report.priority_auto:
            nearby = count_recent_nearby(db, report)
            score, band = compute_priority(report, nearby_recent=nearby)

            if analysis.source != "heuristic":
                # Score the same report against the heuristic baseline, then
                # clamp: model output derived from attacker-controlled text may
                # only nudge the band, never dictate it. compute_priority reads
                # report.ai_analysis, so swap it for the baseline and restore.
                report.ai_analysis = baseline.model_dump()
                _, baseline_band = compute_priority(report, nearby_recent=nearby)
                report.ai_analysis = analysis.model_dump()

                clamped = _clamp_ai_band(band, baseline_band)
                if clamped is not band:
                    logger.info(
                        "Clamped AI priority for report %s: %s -> %s (baseline %s)",
                        report_id, band.value, clamped.value, baseline_band.value,
                    )
                    band = clamped
                    # Keep the displayed score inside the band it now sits in;
                    # a HIGH case showing 82/100 would just reintroduce the
                    # inflation the clamp removed, one column to the left.
                    low, high = _BAND_SCORE_RANGE[band]
                    score = round(min(max(score, low), high), 1)

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
