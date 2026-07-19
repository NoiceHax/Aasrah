"""Health check endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app import __version__
from app.core.config import settings
from app.db.session import get_db

router = APIRouter(tags=["health"])


@router.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "service": settings.PROJECT_NAME,
        "version": __version__,
        "environment": settings.ENVIRONMENT,
    }


@router.get("/health/db")
def health_db(db: Session = Depends(get_db)) -> dict:
    """Readiness probe that verifies database connectivity."""
    db.execute(text("SELECT 1"))
    return {"status": "ok", "database": "reachable"}
