"""ensure admin account

Revision ID: a5d6e7f8c9b0
Revises: f4a7c8e1b2d3
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a5d6e7f8c9b0"
down_revision: Union[str, Sequence[str], None] = "f4a7c8e1b2d3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


ADMIN_EMAIL = "admin@boardway.io"
ADMIN_NICKNAME = "boardway_admin"
# Password: admin123
ADMIN_PASSWORD_HASH = "$2b$12$.qY/ekjkxvs3mCXAtheXfePMOzMrzhcEyQA4EH.8QUmBGhZhAgyL6"


def upgrade() -> None:
    conn = op.get_bind()
    conn.execute(
        sa.text(
            """
            INSERT INTO users (email, password, nickname, "mannerScore", points, is_admin)
            VALUES (:email, :password, :nickname, 5, 0, true)
            ON CONFLICT (email) DO UPDATE SET
                is_admin = true
            """
        ),
        {
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD_HASH,
            "nickname": ADMIN_NICKNAME,
        },
    )


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(
        sa.text("UPDATE users SET is_admin = false WHERE email = :email"),
        {"email": ADMIN_EMAIL},
    )
