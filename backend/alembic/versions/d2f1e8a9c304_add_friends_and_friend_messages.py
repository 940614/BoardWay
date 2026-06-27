"""add friends and friend messages

Revision ID: d2f1e8a9c304
Revises: b7d4c9f2a801
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d2f1e8a9c304"
down_revision: Union[str, Sequence[str], None] = "b7d4c9f2a801"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "friendships",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("requester_id", sa.Integer(), nullable=False),
        sa.Column("addressee_id", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("responded_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["addressee_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["requester_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_friendships_id"), "friendships", ["id"], unique=False)
    op.create_index(op.f("ix_friendships_requester_id"), "friendships", ["requester_id"], unique=False)
    op.create_index(op.f("ix_friendships_addressee_id"), "friendships", ["addressee_id"], unique=False)

    op.create_table(
        "friend_messages",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("sender_id", sa.Integer(), nullable=False),
        sa.Column("recipient_id", sa.Integer(), nullable=False),
        sa.Column("content", sa.String(), nullable=False),
        sa.Column("read", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["recipient_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["sender_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_friend_messages_id"), "friend_messages", ["id"], unique=False)
    op.create_index(op.f("ix_friend_messages_sender_id"), "friend_messages", ["sender_id"], unique=False)
    op.create_index(op.f("ix_friend_messages_recipient_id"), "friend_messages", ["recipient_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_friend_messages_recipient_id"), table_name="friend_messages")
    op.drop_index(op.f("ix_friend_messages_sender_id"), table_name="friend_messages")
    op.drop_index(op.f("ix_friend_messages_id"), table_name="friend_messages")
    op.drop_table("friend_messages")
    op.drop_index(op.f("ix_friendships_addressee_id"), table_name="friendships")
    op.drop_index(op.f("ix_friendships_requester_id"), table_name="friendships")
    op.drop_index(op.f("ix_friendships_id"), table_name="friendships")
    op.drop_table("friendships")
