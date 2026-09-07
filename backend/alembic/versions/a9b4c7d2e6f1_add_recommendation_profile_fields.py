"""add recommendation profile fields

Revision ID: a9b4c7d2e6f1
Revises: f1a3c5e7b9d2
Create Date: 2026-09-07 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a9b4c7d2e6f1"
down_revision: Union[str, None] = "f1a3c5e7b9d2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_columns = {column["name"] for column in inspector.get_columns("users")}
    json_default = sa.text("'[]'::json") if bind.dialect.name == "postgresql" else sa.text("'[]'")

    for column_name in (
        "preferred_days",
        "preferred_time_slots",
        "preferred_player_counts",
        "preferred_difficulties",
    ):
        if column_name not in existing_columns:
            op.add_column(
                "users",
                sa.Column(column_name, sa.JSON(), nullable=False, server_default=json_default),
            )


def downgrade() -> None:
    for column_name in (
        "preferred_difficulties",
        "preferred_player_counts",
        "preferred_time_slots",
        "preferred_days",
    ):
        op.drop_column("users", column_name)
