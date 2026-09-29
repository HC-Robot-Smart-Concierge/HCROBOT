"""refactor_support_requests_and_jobs

Revision ID: bd6b3a75b7a6
Revises: f1e8d5782db9
Create Date: 2026-09-29 00:12:50.593040

"""
from typing import Sequence, Union
from datetime import datetime

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'bd6b3a75b7a6'
down_revision: Union[str, Sequence[str], None] = 'f1e8d5782db9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema: Create robots, jobs, service_types, support_requests and migrate legacy requests."""
    # 1. Create robots table
    op.create_table(
        'robots',
        sa.Column('id', sa.String(length=50), nullable=False),
        sa.Column('code', sa.String(length=30), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('model_type', sa.String(length=50), nullable=False, server_default='Differential Drive Concierge'),
        sa.Column('status', sa.String(length=50), nullable=False, server_default='IDLE'),
        sa.Column('battery_level', sa.Integer(), nullable=False, server_default='100'),
        sa.Column('current_location', sa.String(length=100), nullable=False, server_default='Main Lobby'),
        sa.Column('is_online', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('ip_address', sa.String(length=50), nullable=True),
        sa.Column('last_heartbeat', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_robots_code'), 'robots', ['code'], unique=True)

    # Pre-seed primary concierge robot
    now_ts = datetime.utcnow()
    robots_table = sa.table(
        'robots',
        sa.column('id', sa.String),
        sa.column('code', sa.String),
        sa.column('name', sa.String),
        sa.column('model_type', sa.String),
        sa.column('status', sa.String),
        sa.column('battery_level', sa.Integer),
        sa.column('current_location', sa.String),
        sa.column('is_online', sa.Boolean),
        sa.column('ip_address', sa.String),
        sa.column('last_heartbeat', sa.DateTime),
        sa.column('created_at', sa.DateTime),
        sa.column('updated_at', sa.DateTime),
    )
    op.bulk_insert(
        robots_table,
        [
            {
                'id': 'RC-001',
                'code': 'ROBOT-01',
                'name': 'HCRobot Concierge 01',
                'model_type': 'Differential Drive Concierge',
                'status': 'IDLE',
                'battery_level': 100,
                'current_location': 'Main Lobby Docking Station',
                'is_online': True,
                'ip_address': '100.90.12.34',
                'last_heartbeat': now_ts,
                'created_at': now_ts,
                'updated_at': now_ts,
            }
        ]
    )

    # 2. Create jobs table
    op.create_table(
        'jobs',
        sa.Column('id', sa.String(length=50), nullable=False),
        sa.Column('job_code', sa.String(length=30), nullable=False),
        sa.Column('title', sa.String(length=200), nullable=False),
        sa.Column('workflow_id', sa.String(length=50), nullable=True),
        sa.Column('chat_session_id', sa.String(length=64), nullable=True),
        sa.Column('robot_id', sa.String(length=50), nullable=True),
        sa.Column('trigger_type', sa.String(length=50), nullable=False, server_default='MANUAL'),
        sa.Column('status', sa.String(length=50), nullable=False, server_default='PENDING'),
        sa.Column('current_step_index', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('total_steps', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('started_at', sa.DateTime(), nullable=True),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['chat_session_id'], ['chat_sessions.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['robot_id'], ['robots.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['workflow_id'], ['robot_workflows.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_jobs_chat_session_id'), 'jobs', ['chat_session_id'], unique=False)
    op.create_index(op.f('ix_jobs_job_code'), 'jobs', ['job_code'], unique=True)
    op.create_index(op.f('ix_jobs_robot_id'), 'jobs', ['robot_id'], unique=False)
    op.create_index(op.f('ix_jobs_workflow_id'), 'jobs', ['workflow_id'], unique=False)

    # 3. Create job_steps table
    op.create_table(
        'job_steps',
        sa.Column('id', sa.String(length=50), nullable=False),
        sa.Column('job_id', sa.String(length=50), nullable=False),
        sa.Column('step_index', sa.Integer(), nullable=False),
        sa.Column('step_type', sa.String(length=50), nullable=False),
        sa.Column('params', sa.JSON(), nullable=False, server_default='{}'),
        sa.Column('status', sa.String(length=50), nullable=False, server_default='PENDING'),
        sa.Column('started_at', sa.DateTime(), nullable=True),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.Column('result_payload', sa.JSON(), nullable=True),
        sa.ForeignKeyConstraint(['job_id'], ['jobs.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_job_steps_job_id'), 'job_steps', ['job_id'], unique=False)

    # 4. Create job_events table
    op.create_table(
        'job_events',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('job_id', sa.String(length=50), nullable=False),
        sa.Column('event_type', sa.String(length=100), nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('severity', sa.String(length=20), nullable=False, server_default='INFO'),
        sa.Column('metadata_payload', sa.JSON(), nullable=False, server_default='{}'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['job_id'], ['jobs.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_job_events_event_type'), 'job_events', ['event_type'], unique=False)
    op.create_index(op.f('ix_job_events_job_id'), 'job_events', ['job_id'], unique=False)

    # 5. Create service_types table
    op.create_table(
        'service_types',
        sa.Column('id', sa.String(length=50), nullable=False),
        sa.Column('code', sa.String(length=30), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('department_id', sa.String(length=50), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('default_priority', sa.String(length=20), nullable=False, server_default='NORMAL'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['department_id'], ['departments.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_service_types_code'), 'service_types', ['code'], unique=True)
    op.create_index(op.f('ix_service_types_department_id'), 'service_types', ['department_id'], unique=False)

    # Pre-seed standard service types
    service_types_table = sa.table(
        'service_types',
        sa.column('id', sa.String),
        sa.column('code', sa.String),
        sa.column('name', sa.String),
        sa.column('department_id', sa.String),
        sa.column('description', sa.Text),
        sa.column('default_priority', sa.String),
        sa.column('is_active', sa.Boolean),
        sa.column('created_at', sa.DateTime),
        sa.column('updated_at', sa.DateTime),
    )
    service_types_seed = [
        ('ST-TOWEL', 'TOWEL', 'Giao thêm khăn tắm & đồ vệ sinh', 'DEP-HOUSEKEEPING', 'Khăn tắm, dầu gội, bàn chải, nước uống', 'NORMAL', True, now_ts, now_ts),
        ('ST-ROOM-CLEAN', 'ROOM_CLEAN', 'Dọn phòng & vệ sinh sàn', 'DEP-HOUSEKEEPING', 'Dọn dẹp phòng nghỉ hoặc xử lý vết tràn đổ', 'HIGH', True, now_ts, now_ts),
        ('ST-LUGGAGE', 'LUGGAGE', 'Hỗ trợ vận chuyển hành lý', 'DEP-BELL', 'Khuân vác hành lý check-in / check-out', 'NORMAL', True, now_ts, now_ts),
        ('ST-TAXI', 'TAXI', 'Đặt xe taxi đưa đón', 'DEP-BELL', 'Gọi xe taxi hoặc đưa đón sân bay', 'NORMAL', True, now_ts, now_ts),
        ('ST-AC-REPAIR', 'HVAC_REPAIR', 'Bảo trì điều hòa không khí', 'DEP-MAINTENANCE', 'Điều hòa nhiệt độ không lạnh hoặc phát tiếng ồn', 'HIGH', True, now_ts, now_ts),
        ('ST-PLUMBING', 'PLUMBING', 'Sự cố điện nước / vệ sinh', 'DEP-MAINTENANCE', 'Nước chảy yếu, nghẹt bồn rửa, thay bóng đèn', 'HIGH', True, now_ts, now_ts),
        ('ST-RECEPTION-INQUIRY', 'RECEPTION_INQUIRY', 'Hỗ trợ thủ tục lễ tân', 'DEP-RECEPTION', 'Hỏi đáp thông tin phòng, gia hạn, check-out trễ', 'NORMAL', True, now_ts, now_ts),
    ]
    op.bulk_insert(
        service_types_table,
        [
            {
                'id': row[0],
                'code': row[1],
                'name': row[2],
                'department_id': row[3],
                'description': row[4],
                'default_priority': row[5],
                'is_active': row[6],
                'created_at': row[7],
                'updated_at': row[8],
            }
            for row in service_types_seed
        ]
    )

    # 6. Create support_requests table
    op.create_table(
        'support_requests',
        sa.Column('id', sa.String(length=50), nullable=False),
        sa.Column('ticket_code', sa.String(length=30), nullable=False),
        sa.Column('title', sa.String(length=200), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('service_type_id', sa.String(length=50), nullable=True),
        sa.Column('department_id', sa.String(length=50), nullable=True),
        sa.Column('account_id', sa.String(length=50), nullable=True),
        sa.Column('room_number', sa.String(length=50), nullable=False),
        sa.Column('guest_name', sa.String(length=100), nullable=False, server_default='Hotel Guest'),
        sa.Column('source', sa.String(length=50), nullable=False, server_default='From HCRobot'),
        sa.Column('priority', sa.String(length=20), nullable=False, server_default='NORMAL'),
        sa.Column('status', sa.String(length=50), nullable=False, server_default='Pending'),
        sa.Column('assigned_staff_name', sa.String(length=100), nullable=True),
        sa.Column('assigned_robot_id', sa.String(length=50), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['account_id'], ['accounts.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['department_id'], ['departments.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['service_type_id'], ['service_types.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_support_requests_account_id'), 'support_requests', ['account_id'], unique=False)
    op.create_index(op.f('ix_support_requests_department_id'), 'support_requests', ['department_id'], unique=False)
    op.create_index(op.f('ix_support_requests_room_number'), 'support_requests', ['room_number'], unique=False)
    op.create_index(op.f('ix_support_requests_service_type_id'), 'support_requests', ['service_type_id'], unique=False)
    op.create_index(op.f('ix_support_requests_ticket_code'), 'support_requests', ['ticket_code'], unique=True)

    # 7. Migrate data from legacy request tables into support_requests
    # From housekeeping_requests
    op.execute("""
        INSERT INTO support_requests (
            id, ticket_code, title, description, service_type_id, department_id,
            account_id, room_number, guest_name, source, priority, status,
            assigned_staff_name, created_at, updated_at
        )
        SELECT
            h.id, h.ticket_code, h.title, h.description, 'ST-ROOM-CLEAN', 'DEP-HOUSEKEEPING',
            h.assigned_staff_id, h.room_number, COALESCE(h.guest_name, 'Hotel Guest'), h.source,
            'NORMAL', h.status, h.assigned_staff_name, h.created_at, h.updated_at
        FROM housekeeping_requests h;
    """)

    # From bell_requests
    op.execute("""
        INSERT INTO support_requests (
            id, ticket_code, title, description, service_type_id, department_id,
            account_id, room_number, guest_name, source, priority, status,
            assigned_staff_name, assigned_robot_id, created_at, updated_at
        )
        SELECT
            b.id, b.ticket_code, b.title, b.description, 'ST-LUGGAGE', 'DEP-BELL',
            b.assigned_staff_id, b.location, COALESCE(b.guest_name, 'Hotel Guest'), COALESCE(b.reporter, 'From HCRobot'),
            'NORMAL', b.status, b.assigned_to, b.assigned_robot_id, b.created_at, b.updated_at
        FROM bell_requests b;
    """)

    # From maintenance_requests
    op.execute("""
        INSERT INTO support_requests (
            id, ticket_code, title, description, service_type_id, department_id,
            account_id, room_number, guest_name, source, priority, status,
            assigned_staff_name, created_at, updated_at
        )
        SELECT
            m.id, m.ticket_code, m.title, m.description, 'ST-PLUMBING', 'DEP-MAINTENANCE',
            m.assigned_staff_id, m.location, 'Hotel Guest', m.source,
            'HIGH', m.status, m.assigned_to, m.created_at, m.updated_at
        FROM maintenance_requests m;
    """)

    # From reception_requests
    op.execute("""
        INSERT INTO support_requests (
            id, ticket_code, title, description, service_type_id, department_id,
            account_id, room_number, guest_name, source, priority, status,
            assigned_staff_name, created_at, updated_at
        )
        SELECT
            r.id, r.ticket_code, r.title, r.description, 'ST-RECEPTION-INQUIRY', 'DEP-RECEPTION',
            NULL, r.location, COALESCE(r.guest_name, 'Hotel Guest'), 'From HCRobot',
            'NORMAL', r.status, r.assigned_to, r.created_at, r.updated_at
        FROM reception_requests r;
    """)

    # 8. Safely drop legacy request tables
    op.drop_index(op.f('ix_reception_requests_ticket_code'), table_name='reception_requests')
    op.drop_table('reception_requests')
    op.drop_index(op.f('ix_housekeeping_requests_ticket_code'), table_name='housekeeping_requests')
    op.drop_table('housekeeping_requests')
    op.drop_index(op.f('ix_maintenance_requests_ticket_code'), table_name='maintenance_requests')
    op.drop_table('maintenance_requests')
    op.drop_index(op.f('ix_bell_requests_ticket_code'), table_name='bell_requests')
    op.drop_table('bell_requests')


def downgrade() -> None:
    """Downgrade schema: Restore legacy request tables."""
    # Recreate bell_requests
    op.create_table(
        'bell_requests',
        sa.Column('id', sa.VARCHAR(length=50), nullable=False),
        sa.Column('ticket_code', sa.VARCHAR(length=20), nullable=False),
        sa.Column('title', sa.VARCHAR(length=200), nullable=False),
        sa.Column('location', sa.VARCHAR(length=100), nullable=False),
        sa.Column('guest_name', sa.VARCHAR(length=100), nullable=True),
        sa.Column('reporter', sa.VARCHAR(length=100), nullable=True),
        sa.Column('description', sa.VARCHAR(length=500), nullable=True),
        sa.Column('request_type', sa.VARCHAR(length=50), nullable=False),
        sa.Column('status', sa.VARCHAR(length=50), nullable=False),
        sa.Column('assigned_to', sa.VARCHAR(length=100), nullable=True),
        sa.Column('assigned_robot_id', sa.VARCHAR(length=50), nullable=True),
        sa.Column('assigned_staff_id', sa.VARCHAR(length=50), nullable=True),
        sa.Column('created_at', postgresql.TIMESTAMP(), nullable=False),
        sa.Column('updated_at', postgresql.TIMESTAMP(), nullable=False),
        sa.ForeignKeyConstraint(['assigned_staff_id'], ['accounts.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_bell_requests_ticket_code'), 'bell_requests', ['ticket_code'], unique=True)

    # Recreate maintenance_requests
    op.create_table(
        'maintenance_requests',
        sa.Column('id', sa.VARCHAR(length=50), nullable=False),
        sa.Column('ticket_code', sa.VARCHAR(length=20), nullable=False),
        sa.Column('title', sa.VARCHAR(length=200), nullable=False),
        sa.Column('category', sa.VARCHAR(length=50), nullable=False),
        sa.Column('reported_time_label', sa.VARCHAR(length=50), nullable=False),
        sa.Column('location', sa.VARCHAR(length=100), nullable=False),
        sa.Column('description', sa.VARCHAR(length=500), nullable=True),
        sa.Column('source', sa.VARCHAR(length=50), nullable=False),
        sa.Column('status', sa.VARCHAR(length=50), nullable=False),
        sa.Column('assigned_to', sa.VARCHAR(length=100), nullable=True),
        sa.Column('assigned_staff_id', sa.VARCHAR(length=50), nullable=True),
        sa.Column('created_at', postgresql.TIMESTAMP(), nullable=False),
        sa.Column('updated_at', postgresql.TIMESTAMP(), nullable=False),
        sa.ForeignKeyConstraint(['assigned_staff_id'], ['accounts.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_maintenance_requests_ticket_code'), 'maintenance_requests', ['ticket_code'], unique=True)

    # Recreate housekeeping_requests
    op.create_table(
        'housekeeping_requests',
        sa.Column('id', sa.VARCHAR(length=50), nullable=False),
        sa.Column('ticket_code', sa.VARCHAR(length=20), nullable=False),
        sa.Column('source', sa.VARCHAR(length=50), nullable=False),
        sa.Column('time_label', sa.VARCHAR(length=20), nullable=False),
        sa.Column('title', sa.VARCHAR(length=200), nullable=False),
        sa.Column('room_number', sa.VARCHAR(length=50), nullable=False),
        sa.Column('description', sa.VARCHAR(length=500), nullable=True),
        sa.Column('guest_name', sa.VARCHAR(length=100), nullable=True),
        sa.Column('status', sa.VARCHAR(length=50), nullable=False),
        sa.Column('assigned_staff_name', sa.VARCHAR(length=100), nullable=True),
        sa.Column('assigned_staff_id', sa.VARCHAR(length=50), nullable=True),
        sa.Column('created_at', postgresql.TIMESTAMP(), nullable=False),
        sa.Column('updated_at', postgresql.TIMESTAMP(), nullable=False),
        sa.ForeignKeyConstraint(['assigned_staff_id'], ['accounts.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_housekeeping_requests_ticket_code'), 'housekeeping_requests', ['ticket_code'], unique=True)

    # Recreate reception_requests
    op.create_table(
        'reception_requests',
        sa.Column('id', sa.VARCHAR(length=50), nullable=False),
        sa.Column('ticket_code', sa.VARCHAR(length=30), nullable=False),
        sa.Column('title', sa.VARCHAR(length=200), nullable=False),
        sa.Column('created_label', sa.VARCHAR(length=50), nullable=False),
        sa.Column('location', sa.VARCHAR(length=150), nullable=False),
        sa.Column('location_details', postgresql.JSON(astext_type=sa.Text()), nullable=False),
        sa.Column('guest_name', sa.VARCHAR(length=120), nullable=False),
        sa.Column('guest_tier', sa.VARCHAR(length=30), nullable=False),
        sa.Column('guest_stay_details', sa.VARCHAR(length=250), nullable=False),
        sa.Column('status', sa.VARCHAR(length=50), nullable=False),
        sa.Column('description', sa.VARCHAR(length=2000), nullable=False),
        sa.Column('attached_media', postgresql.JSON(astext_type=sa.Text()), nullable=False),
        sa.Column('transcript', postgresql.JSON(astext_type=sa.Text()), nullable=False),
        sa.Column('assistance_status', sa.VARCHAR(length=50), nullable=False),
        sa.Column('assigned_to', sa.VARCHAR(length=120), nullable=True),
        sa.Column('assigned_role', sa.VARCHAR(length=120), nullable=True),
        sa.Column('notes', postgresql.JSON(astext_type=sa.Text()), nullable=False),
        sa.Column('activity_log', postgresql.JSON(astext_type=sa.Text()), nullable=False),
        sa.Column('escalated', sa.BOOLEAN(), nullable=False),
        sa.Column('created_at', postgresql.TIMESTAMP(), nullable=False),
        sa.Column('updated_at', postgresql.TIMESTAMP(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_reception_requests_ticket_code'), 'reception_requests', ['ticket_code'], unique=True)

    # Drop support_requests
    op.drop_index(op.f('ix_support_requests_ticket_code'), table_name='support_requests')
    op.drop_index(op.f('ix_support_requests_service_type_id'), table_name='support_requests')
    op.drop_index(op.f('ix_support_requests_room_number'), table_name='support_requests')
    op.drop_index(op.f('ix_support_requests_department_id'), table_name='support_requests')
    op.drop_index(op.f('ix_support_requests_account_id'), table_name='support_requests')
    op.drop_table('support_requests')

    # Drop service_types
    op.drop_index(op.f('ix_service_types_department_id'), table_name='service_types')
    op.drop_index(op.f('ix_service_types_code'), table_name='service_types')
    op.drop_table('service_types')

    # Drop job_events, job_steps, jobs, robots
    op.drop_index(op.f('ix_job_events_job_id'), table_name='job_events')
    op.drop_index(op.f('ix_job_events_event_type'), table_name='job_events')
    op.drop_table('job_events')

    op.drop_index(op.f('ix_job_steps_job_id'), table_name='job_steps')
    op.drop_table('job_steps')

    op.drop_index(op.f('ix_jobs_workflow_id'), table_name='jobs')
    op.drop_index(op.f('ix_jobs_robot_id'), table_name='jobs')
    op.drop_index(op.f('ix_jobs_job_code'), table_name='jobs')
    op.drop_index(op.f('ix_jobs_chat_session_id'), table_name='jobs')
    op.drop_table('jobs')

    op.drop_index(op.f('ix_robots_code'), table_name='robots')
    op.drop_table('robots')
