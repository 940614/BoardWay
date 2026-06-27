"""add suggestion replies

Revision ID: b7d4c9f2a801
Revises: 9c3e7a1b5d20
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b7d4c9f2a801"
down_revision: Union[str, Sequence[str], None] = "9c3e7a1b5d20"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("suggestions", sa.Column("admin_reply", sa.String(), nullable=True))
    op.add_column("suggestions", sa.Column("answered_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("suggestions", "answered_at")
    op.drop_column("suggestions", "admin_reply")
