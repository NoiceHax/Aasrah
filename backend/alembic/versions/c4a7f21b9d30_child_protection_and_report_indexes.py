"""child protection support + missing report indexes

Adds:
  * three indexes on ``reports`` that today's hottest queries seq-scan
    (claimed_by_ngo_id; (claimed_by_ngo_id, status); (latitude, longitude));
  * the ``child_protection`` value on the native ``situation_type`` enum;
  * ``reports.subject_is_minor`` — the REPORTER-DECLARED answer, deliberately
    distinct from the AI-derived ``children_present`` column.

Revision ID: c4a7f21b9d30
Revises: b3d1e2f4a5c6
Create Date: 2026-07-20 00:00:00.000000+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c4a7f21b9d30'
down_revision: Union[str, None] = 'b3d1e2f4a5c6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()

    # --- 1. New enum value -------------------------------------------------
    # ``situation_type`` is a native Postgres enum, so a new member has to be
    # added with ALTER TYPE ... ADD VALUE. On PG < 12 that statement cannot run
    # inside a transaction block, so run it on an autocommit connection. It is
    # also made conditional so re-running this migration is safe.
    if bind.dialect.name == 'postgresql':
        with op.get_context().autocommit_block():
            op.execute(
                """
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1
                        FROM pg_enum e
                        JOIN pg_type t ON t.oid = e.enumtypid
                        WHERE t.typname = 'situation_type'
                          AND e.enumlabel = 'child_protection'
                    ) THEN
                        ALTER TYPE situation_type ADD VALUE 'child_protection';
                    END IF;
                END
                $$;
                """
            )
    # On SQLite the enum is stored as VARCHAR, so nothing to do.

    # --- 2. Reporter-declared minor flag -----------------------------------
    op.add_column(
        'reports',
        sa.Column(
            'subject_is_minor',
            sa.Boolean(),
            nullable=True,
            comment=(
                'Reporter-declared: subject is a minor. Distinct from the '
                'AI-derived children_present flag; never overwritten by AI.'
            ),
        ),
    )

    # --- 3. Missing indexes ------------------------------------------------
    op.create_index('ix_reports_claimed_by_ngo_id', 'reports', ['claimed_by_ngo_id'])
    op.create_index('ix_reports_ngo_status', 'reports', ['claimed_by_ngo_id', 'status'])
    op.create_index('ix_reports_lat_lon', 'reports', ['latitude', 'longitude'])


def downgrade() -> None:
    op.drop_index('ix_reports_lat_lon', table_name='reports')
    op.drop_index('ix_reports_ngo_status', table_name='reports')
    op.drop_index('ix_reports_claimed_by_ngo_id', table_name='reports')
    op.drop_column('reports', 'subject_is_minor')
    # The 'child_protection' enum value is intentionally NOT removed: Postgres
    # cannot drop an enum label, and rows may already reference it.
