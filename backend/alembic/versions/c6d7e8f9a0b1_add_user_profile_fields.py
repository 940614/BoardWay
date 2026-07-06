"""add user profile fields

Revision ID: c6d7e8f9a0b1
Revises: a5d6e7f8c9b0
Create Date: 2026-07-06 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c6d7e8f9a0b1"
down_revision: Union[str, None] = "a5d6e7f8c9b0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_columns = {column["name"] for column in inspector.get_columns("users")}
    json_default = sa.text("'[]'::json") if bind.dialect.name == "postgresql" else sa.text("'[]'")

    if "bio" not in existing_columns:
        op.add_column("users", sa.Column("bio", sa.String(), nullable=False, server_default=""))

    if "preferred_genres" not in existing_columns:
        op.add_column(
            "users",
            sa.Column("preferred_genres", sa.JSON(), nullable=False, server_default=json_default),
        )

    if "preferred_locations" not in existing_columns:
        op.add_column(
            "users",
            sa.Column("preferred_locations", sa.JSON(), nullable=False, server_default=json_default),
        )


def downgrade() -> None:
    op.drop_column("users", "preferred_locations")
    op.drop_column("users", "preferred_genres")
    op.drop_column("users", "bio")
