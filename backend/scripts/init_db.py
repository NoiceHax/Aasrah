"""Initialize the database by running Alembic migrations to head.

Usage: python -m scripts.init_db
"""

from __future__ import annotations

from alembic import command
from alembic.config import Config

from app.core.logging import configure_logging, get_logger

configure_logging()
logger = get_logger(__name__)


def main() -> None:
    cfg = Config("alembic.ini")
    logger.info("Running migrations to head...")
    command.upgrade(cfg, "head")
    logger.info("Database is up to date.")


if __name__ == "__main__":
    main()
