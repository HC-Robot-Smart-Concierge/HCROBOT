"""Add the published guest map and uploaded images."""

from alembic import context, op
import sqlalchemy as sa


revision = "b021bd0d49cc"
down_revision = "a71f06e923c4"
branch_labels = None
depends_on = None


def upgrade():
    inspector = None if context.is_offline_mode() else sa.inspect(op.get_bind())
    if inspector is None or not inspector.has_table("wayfinding_publications"):
        op.create_table(
            "wayfinding_publications",
            sa.Column("id", sa.Integer, primary_key=True),
            sa.Column("revision", sa.Integer, nullable=False),
            sa.Column("config", sa.JSON, nullable=False),
        )
    if inspector is None or not inspector.has_table("wayfinding_images"):
        op.create_table(
            "wayfinding_images",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("content_type", sa.String(32), nullable=False),
            sa.Column("content", sa.LargeBinary, nullable=False),
        )


def downgrade():
    op.drop_table("wayfinding_images")
    op.drop_table("wayfinding_publications")
