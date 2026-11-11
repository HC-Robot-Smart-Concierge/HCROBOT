"""Persist the orientation of functional map zones.

Revision ID: a71f06e923c4
Revises: f5c21a98db21
"""
from alembic import op
import sqlalchemy as sa

revision = "a71f06e923c4"
down_revision = "f5c21a98db21"
branch_labels = None
depends_on = None


def upgrade():
    # Startup may already have applied this backwards-compatible column patch.
    if not any(column["name"] == "yaw" for column in sa.inspect(op.get_bind()).get_columns("zones")):
        op.add_column("zones", sa.Column("yaw", sa.Float(), nullable=False, server_default="0"))


def downgrade():
    op.drop_column("zones", "yaw")
