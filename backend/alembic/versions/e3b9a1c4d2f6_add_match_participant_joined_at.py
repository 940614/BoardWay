"""add match participant joined_at

Revision ID: e3b9a1c4d2f6
Revises: d2f1e8a9c304
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e3b9a1c4d2f6"
down_revision: Union[str, Sequence[str], None] = "d2f1e8a9c304"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "match_participants",
        sa.Column(
            "joined_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.alter_column("match_participants", "joined_at", server_default=None)


def downgrade() -> None:
    op.drop_column("match_participants", "joined_at")
