"""add user reports

Revision ID: d8e2f4a6b9c1
Revises: c6d7e8f9a0b1
Create Date: 2026-07-11 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d8e2f4a6b9c1"
down_revision: Union[str, None] = "c6d7e8f9a0b1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "user_reports",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("reporter_id", sa.Integer(), nullable=False),
        sa.Column("reported_user_id", sa.Integer(), nullable=False),
        sa.Column("match_id", sa.Integer(), nullable=True),
        sa.Column("category", sa.String(), nullable=False),
        sa.Column("content", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=False, server_default="received"),
        sa.Column("admin_note", sa.String(), nullable=True),
        sa.Column("handled_by_user_id", sa.Integer(), nullable=True),
        sa.Column("handled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["handled_by_user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["match_id"], ["matches.id"]),
        sa.ForeignKeyConstraint(["reported_user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["reporter_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_user_reports_id"), "user_reports", ["id"], unique=False)
    op.create_index(op.f("ix_user_reports_reporter_id"), "user_reports", ["reporter_id"], unique=False)
    op.create_index(op.f("ix_user_reports_reported_user_id"), "user_reports", ["reported_user_id"], unique=False)
    op.create_index(op.f("ix_user_reports_match_id"), "user_reports", ["match_id"], unique=False)
    op.create_index(op.f("ix_user_reports_status"), "user_reports", ["status"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_user_reports_status"), table_name="user_reports")
    op.drop_index(op.f("ix_user_reports_match_id"), table_name="user_reports")
    op.drop_index(op.f("ix_user_reports_reported_user_id"), table_name="user_reports")
    op.drop_index(op.f("ix_user_reports_reporter_id"), table_name="user_reports")
    op.drop_index(op.f("ix_user_reports_id"), table_name="user_reports")
    op.drop_table("user_reports")
