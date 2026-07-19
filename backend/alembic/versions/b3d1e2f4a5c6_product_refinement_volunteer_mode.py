"""product refinement: volunteer assignment mode + deactivate citizen accounts

Adds the ``volunteer_assignment_mode`` enum and ``volunteers.assignment_mode``
column, and deactivates any legacy ``citizen`` user accounts (the CITIZEN role
is no longer assignable; anonymous reporting replaces citizen accounts).

Revision ID: b3d1e2f4a5c6
Revises: 5726439a57c5
Create Date: 2026-07-01 00:00:00.000000+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b3d1e2f4a5c6'
down_revision: Union[str, None] = '5726439a57c5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()

    # Create the enum type explicitly on Postgres so the column add can
    # reference it. (On SQLite, Enum is stored as VARCHAR and needs no type.)
    assignment_mode = sa.Enum(
        'independent', 'ngo_affiliated', name='volunteer_assignment_mode'
    )
    assignment_mode.create(bind, checkfirst=True)

    op.add_column(
        'volunteers',
        sa.Column(
            'assignment_mode',
            assignment_mode,
            nullable=False,
            server_default='independent',
        ),
    )
    # Drop the server default now that existing rows are backfilled; the ORM
    # supplies the default for new rows.
    op.alter_column(
        'volunteers', 'assignment_mode',
        existing_type=assignment_mode,
        server_default=None,
        existing_nullable=False,
    )

    # Deactivate any legacy citizen accounts. The CITIZEN enum value is kept
    # (dropping a Postgres enum value is destructive), but such accounts can no
    # longer be created and are disabled here. Their reports remain intact via
    # reports.reporter_id ON DELETE SET NULL.
    op.execute("UPDATE users SET is_active = false WHERE role = 'citizen'")


def downgrade() -> None:
    op.drop_column('volunteers', 'assignment_mode')
    sa.Enum(name='volunteer_assignment_mode').drop(op.get_bind(), checkfirst=True)
    # Note: the is_active change to citizen users is intentionally not reverted
    # (we cannot distinguish deliberately-disabled accounts on downgrade).
