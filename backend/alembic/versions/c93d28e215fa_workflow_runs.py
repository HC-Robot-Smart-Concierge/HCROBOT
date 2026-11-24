"""Add persistent physical workflow runs and unique robot/slot reservations."""
from alembic import op
import sqlalchemy as sa

revision = 'c93d28e215fa'
down_revision = 'b82c17d104ef'
branch_labels = None
depends_on = None


def upgrade():
    if sa.inspect(op.get_bind()).has_table('workflow_runs'):
        return
    op.create_table('workflow_runs',
        sa.Column('id', sa.String(50), primary_key=True),
        sa.Column('workflow_id', sa.String(50), nullable=False, index=True),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('robot_id', sa.String(50), nullable=False),
        sa.Column('active_robot_id', sa.String(50), nullable=True, unique=True),
        sa.Column('schedule_slot', sa.String(160), nullable=True, unique=True),
        sa.Column('status', sa.String(20), nullable=False, index=True),
        sa.Column('payload', sa.JSON(), nullable=False),
        sa.Column('events', sa.JSON(), nullable=False),
        sa.Column('current_step_index', sa.Integer(), nullable=False),
        sa.Column('completed_steps', sa.Integer(), nullable=False),
        sa.Column('round_index', sa.Integer(), nullable=False),
        sa.Column('total_steps', sa.Integer(), nullable=False),
        sa.Column('error', sa.Text(), nullable=True),
        sa.Column('owner', sa.String(50), nullable=True),
        sa.Column('heartbeat_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('started_at', sa.DateTime(), nullable=True),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
    )


def downgrade():
    op.drop_table('workflow_runs')
