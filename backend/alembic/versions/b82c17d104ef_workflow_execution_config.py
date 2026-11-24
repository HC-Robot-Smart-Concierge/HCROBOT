"""Persist workflow schedule and repetition settings, independently of steps."""
from alembic import op
import sqlalchemy as sa

revision = "b82c17d104ef"
down_revision = "a71f06e923c4"
branch_labels = None
depends_on = None


def upgrade():
    if not any(c["name"] == "execution_config" for c in sa.inspect(op.get_bind()).get_columns("robot_workflows")):
        op.add_column("robot_workflows", sa.Column("execution_config", sa.JSON(), nullable=False, server_default="{}"))


def downgrade():
    op.drop_column("robot_workflows", "execution_config")
