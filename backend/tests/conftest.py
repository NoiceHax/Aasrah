"""Test fixtures: an isolated SQLite database + FastAPI TestClient.

Tests never touch the real Neon database. A fresh in-memory SQLite schema is
created from the ORM metadata per test session, and the app's get_db dependency
is overridden to use it.
"""

from __future__ import annotations

import os

import tempfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Ensure settings can construct before app import (a DB URL must be present).
os.environ.setdefault("AASRAH_DATABASE_URL", "postgresql+psycopg://u:p@localhost/test")
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-pytest-only-not-real")
os.environ.setdefault("DEBUG", "true")
# Effectively disable rate limiting in tests (many logins share one client IP).
os.environ.setdefault("RATE_LIMIT_DEFAULT", "100000/minute")
os.environ.setdefault("RATE_LIMIT_AUTH", "100000/minute")
# No background worker pool / scheduler under tests; jobs run inline.
os.environ.setdefault("RUN_BACKGROUND_WORKERS", "false")

import logging  # noqa: E402

from app.db.base import Base  # noqa: E402
import app.models  # noqa: E402,F401  (register all mappers)
from app.db.session import get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.services.jobs import runner as _job_runner  # noqa: E402

# Quiet SQLAlchemy's statement logging during tests.
logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)

# Jobs must not run inline in tests; they'd open the real (non-test) DB session.
_job_runner.inline_when_stopped = False

# File-based SQLite so each connection/session is independent and sees other
# sessions' committed writes (a shared in-memory StaticPool connection would
# leak transaction snapshots across the per-request sessions and the fixtures).
_DB_PATH = Path(tempfile.gettempdir()) / "aasrah_test.sqlite"
_DB_PATH.unlink(missing_ok=True)
_engine = create_engine(
    f"sqlite:///{_DB_PATH.as_posix()}",
    connect_args={"check_same_thread": False},
)
TestSessionLocal = sessionmaker(bind=_engine, autoflush=False, autocommit=False, expire_on_commit=False)


@pytest.fixture(scope="session", autouse=True)
def _create_schema():
    Base.metadata.create_all(_engine)
    yield
    Base.metadata.drop_all(_engine)


@pytest.fixture(autouse=True)
def _clean_tables():
    """Truncate all tables between tests for isolation."""
    yield
    with _engine.begin() as conn:
        for table in reversed(Base.metadata.sorted_tables):
            conn.execute(table.delete())


@pytest.fixture
def db():
    session = TestSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client():
    def _override_get_db():
        session = TestSessionLocal()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = _override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


# --- Convenience helpers ---

def register(client: TestClient, email: str, password: str = "Secret123!", full_name: str = "Test User") -> dict:
    """Public self-registration always creates a VOLUNTEER (pending approval).
    The role is no longer client-selectable."""
    resp = client.post("/api/v1/auth/register", json={
        "email": email, "password": password, "full_name": full_name,
    })
    assert resp.status_code == 201, resp.text
    return resp.json()


def auth_header(tokens: dict) -> dict:
    return {"Authorization": f"Bearer {tokens['tokens']['access_token']}"}
