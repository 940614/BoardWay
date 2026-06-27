"""add match completion and suggestions

Revision ID: 9c3e7a1b5d20
Revises: 14ff5fe486d6
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "9c3e7a1b5d20"
down_revision: Union[str, Sequence[str], None] = "14ff5fe486d6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "matches",
        sa.Column("completed", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column("matches", sa.Column("completed_at", sa.DateTime(), nullable=True))
    op.create_table(
        "suggestions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("category", sa.String(), nullable=False),
        sa.Column("content", sa.String(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_suggestions_id"), "suggestions", ["id"], unique=False)
    op.create_index(op.f("ix_suggestions_user_id"), "suggestions", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_suggestions_user_id"), table_name="suggestions")
    op.drop_index(op.f("ix_suggestions_id"), table_name="suggestions")
    op.drop_table("suggestions")
    op.drop_column("matches", "completed_at")
    op.drop_column("matches", "completed")
