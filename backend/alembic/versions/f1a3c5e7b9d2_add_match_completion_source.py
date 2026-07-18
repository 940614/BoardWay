"""track whether a match was completed by its host

Revision ID: f1a3c5e7b9d2
Revises: d8e2f4a6b9c1
Create Date: 2026-07-18 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f1a3c5e7b9d2"
down_revision: Union[str, None] = "d8e2f4a6b9c1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "matches",
        sa.Column("completed_by_host", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    # 이 기능 이전의 완료 매칭은 모두 방장이 직접 완료한 것으로 간주한다.
    op.execute("UPDATE matches SET completed_by_host = true WHERE completed = true")


def downgrade() -> None:
    op.drop_column("matches", "completed_by_host")
