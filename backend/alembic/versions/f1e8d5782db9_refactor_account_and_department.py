"""refactor_account_and_department

Revision ID: f1e8d5782db9
Revises: 87055640bdf0
Create Date: 2026-09-28 23:38:51.839911

"""
from typing import Sequence, Union
from datetime import datetime

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'f1e8d5782db9'
down_revision: Union[str, Sequence[str], None] = '87055640bdf0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema: Create departments & accounts, migrate staff data, update foreign keys."""
    # 1. Create departments table
    op.create_table(
        'departments',
        sa.Column('id', sa.String(length=50), nullable=False),
        sa.Column('code', sa.String(length=20), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_departments_code'), 'departments', ['code'], unique=True)

    # 2. Seed standard hotel departments
    now_ts = datetime.utcnow()
    departments_data = [
        ('DEP-RECEPTION', 'RECEPTION', 'Front Desk & Reception', 'Lễ tân và tiếp đón khách hàng', True, now_ts, now_ts),
        ('DEP-HOUSEKEEPING', 'HOUSEKEEPING', 'Housekeeping', 'Dịch vụ buồng phòng và dọn dẹp', True, now_ts, now_ts),
        ('DEP-BELL', 'BELL', 'Bell Services & Concierge', 'Vận chuyển hành lý và hỗ trợ sảnh', True, now_ts, now_ts),
        ('DEP-FB', 'FB', 'Food & Beverage', 'Ẩm thực và phục vụ phòng Room Service', True, now_ts, now_ts),
        ('DEP-MAINTENANCE', 'MAINTENANCE', 'Maintenance & Engineering', 'Kỹ thuật và bảo trì trang thiết bị', True, now_ts, now_ts),
        ('DEP-EXECUTIVE', 'EXECUTIVE', 'Executive & Management', 'Ban quản trị và điều hành khách sạn', True, now_ts, now_ts),
    ]
    departments_table = sa.table(
        'departments',
        sa.column('id', sa.String),
        sa.column('code', sa.String),
        sa.column('name', sa.String),
        sa.column('description', sa.Text),
        sa.column('is_active', sa.Boolean),
        sa.column('created_at', sa.DateTime),
        sa.column('updated_at', sa.DateTime),
    )
    op.bulk_insert(
        departments_table,
        [
            {
                'id': row[0],
                'code': row[1],
                'name': row[2],
                'description': row[3],
                'is_active': row[4],
                'created_at': row[5],
                'updated_at': row[6],
            }
            for row in departments_data
        ]
    )

    # 3. Create accounts table
    op.create_table(
        'accounts',
        sa.Column('id', sa.String(length=50), nullable=False),
        sa.Column('username', sa.String(length=50), nullable=False),
        sa.Column('password_hash', sa.String(length=255), nullable=False, server_default=''),
        sa.Column('code', sa.String(length=20), nullable=False),
        sa.Column('full_name', sa.String(length=100), nullable=False),
        sa.Column('role', sa.String(length=50), nullable=False, server_default='STAFF'),
        sa.Column('department_id', sa.String(length=50), nullable=True),
        sa.Column('department', sa.String(length=50), nullable=True),
        sa.Column('default_dashboard', sa.String(length=50), nullable=False, server_default='room_service'),
        sa.Column('location', sa.String(length=100), nullable=False, server_default='Main Hotel'),
        sa.Column('status', sa.String(length=50), nullable=False, server_default='available'),
        sa.Column('current_tasks_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('avatar_url', sa.Text(), nullable=True),
        sa.Column('email', sa.String(length=100), nullable=True),
        sa.Column('phone', sa.String(length=50), nullable=True),
        sa.Column('shift', sa.String(length=50), nullable=True),
        sa.Column('is_fallback_agent', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('assigned_floors', sa.String(length=100), nullable=True),
        sa.Column('notification_channels', sa.String(length=200), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['department_id'], ['departments.id'], name='fk_accounts_department_id', ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_accounts_code'), 'accounts', ['code'], unique=True)
    op.create_index(op.f('ix_accounts_department_id'), 'accounts', ['department_id'], unique=False)
    op.create_index(op.f('ix_accounts_username'), 'accounts', ['username'], unique=True)

    # 4. Migrate data from staff table to accounts table
    op.execute("""
        INSERT INTO accounts (
            id, username, password_hash, code, full_name, role,
            department_id, department, default_dashboard, location,
            status, current_tasks_count, avatar_url, email, phone,
            shift, is_fallback_agent, assigned_floors, notification_channels,
            is_active, created_at, updated_at
        )
        SELECT
            s.id, s.username, s.password_hash, s.code, s.full_name, s.role,
            CASE
                WHEN LOWER(s.department) LIKE '%housekeeping%' THEN 'DEP-HOUSEKEEPING'
                WHEN LOWER(s.department) LIKE '%bell%' THEN 'DEP-BELL'
                WHEN LOWER(s.department) LIKE '%reception%' OR LOWER(s.department) LIKE '%front%' THEN 'DEP-RECEPTION'
                WHEN LOWER(s.department) LIKE '%maintenance%' OR LOWER(s.department) LIKE '%engineer%' THEN 'DEP-MAINTENANCE'
                WHEN LOWER(s.department) LIKE '%f&b%' OR LOWER(s.department) LIKE '%food%' OR LOWER(s.department) LIKE '%beverage%' THEN 'DEP-FB'
                ELSE 'DEP-EXECUTIVE'
            END,
            s.department, s.default_dashboard, s.location,
            s.status, s.current_tasks_count, s.avatar_url, s.email, s.phone,
            s.shift, s.is_fallback_agent, s.assigned_floors, s.notification_channels,
            s.is_active, s.created_at, s.updated_at
        FROM staff s;
    """)

    # 5. Drop foreign keys pointing to staff table before dropping staff
    op.drop_constraint('bell_requests_assigned_staff_id_fkey', 'bell_requests', type_='foreignkey')
    op.drop_constraint('housekeeping_requests_assigned_staff_id_fkey', 'housekeeping_requests', type_='foreignkey')
    op.drop_constraint('maintenance_requests_assigned_staff_id_fkey', 'maintenance_requests', type_='foreignkey')

    # 6. Drop staff table safely
    op.drop_index(op.f('ix_staff_code'), table_name='staff')
    op.drop_index(op.f('ix_staff_username'), table_name='staff')
    op.drop_table('staff')

    # Drop any leftover deprecated tables if present
    op.execute("DROP TABLE IF EXISTS restaurant_pre_orders CASCADE;")
    op.execute("DROP TABLE IF EXISTS restaurant_reservations CASCADE;")
    op.execute("DROP TABLE IF EXISTS robot_units CASCADE;")

    # 7. Re-link foreign keys to accounts table
    op.create_foreign_key('fk_bell_requests_assigned_staff_id', 'bell_requests', 'accounts', ['assigned_staff_id'], ['id'], ondelete='SET NULL')
    op.create_foreign_key('fk_housekeeping_requests_assigned_staff_id', 'housekeeping_requests', 'accounts', ['assigned_staff_id'], ['id'], ondelete='SET NULL')
    op.create_foreign_key('fk_maintenance_requests_assigned_staff_id', 'maintenance_requests', 'accounts', ['assigned_staff_id'], ['id'], ondelete='SET NULL')

    # 8. Add account_id to audit_logs
    op.add_column('audit_logs', sa.Column('account_id', sa.String(length=50), nullable=True))
    op.create_index(op.f('ix_audit_logs_account_id'), 'audit_logs', ['account_id'], unique=False)
    op.create_foreign_key('fk_audit_logs_account_id', 'audit_logs', 'accounts', ['account_id'], ['id'], ondelete='SET NULL')

    # 9. Add account_id to log_events
    op.add_column('log_events', sa.Column('account_id', sa.String(length=50), nullable=True))
    op.create_index('idx_log_account_timestamp', 'log_events', ['account_id', 'timestamp'], unique=False)
    op.create_index(op.f('ix_log_events_account_id'), 'log_events', ['account_id'], unique=False)
    op.create_foreign_key('fk_log_events_account_id', 'log_events', 'accounts', ['account_id'], ['id'], ondelete='SET NULL')

    # 10. Add assigned_account_id & created_by_account_id to management_directives
    op.add_column('management_directives', sa.Column('assigned_account_id', sa.String(length=50), nullable=True))
    op.add_column('management_directives', sa.Column('created_by_account_id', sa.String(length=50), nullable=True))
    op.create_index(op.f('ix_management_directives_assigned_account_id'), 'management_directives', ['assigned_account_id'], unique=False)
    op.create_index(op.f('ix_management_directives_created_by_account_id'), 'management_directives', ['created_by_account_id'], unique=False)
    op.create_foreign_key('fk_management_directives_assigned_account_id', 'management_directives', 'accounts', ['assigned_account_id'], ['id'], ondelete='SET NULL')
    op.create_foreign_key('fk_management_directives_created_by_account_id', 'management_directives', 'accounts', ['created_by_account_id'], ['id'], ondelete='SET NULL')

    # 11. Add account_id to notifications
    op.add_column('notifications', sa.Column('account_id', sa.String(length=50), nullable=True))
    op.create_index(op.f('ix_notifications_account_id'), 'notifications', ['account_id'], unique=False)
    op.create_foreign_key('fk_notifications_account_id', 'notifications', 'accounts', ['account_id'], ['id'], ondelete='CASCADE')


def downgrade() -> None:
    """Downgrade schema: Restore staff table and revert foreign keys."""
    # 1. Revert notifications
    op.drop_constraint('fk_notifications_account_id', 'notifications', type_='foreignkey')
    op.drop_index(op.f('ix_notifications_account_id'), table_name='notifications')
    op.drop_column('notifications', 'account_id')

    # 2. Revert management_directives
    op.drop_constraint('fk_management_directives_created_by_account_id', 'management_directives', type_='foreignkey')
    op.drop_constraint('fk_management_directives_assigned_account_id', 'management_directives', type_='foreignkey')
    op.drop_index(op.f('ix_management_directives_created_by_account_id'), table_name='management_directives')
    op.drop_index(op.f('ix_management_directives_assigned_account_id'), table_name='management_directives')
    op.drop_column('management_directives', 'created_by_account_id')
    op.drop_column('management_directives', 'assigned_account_id')

    # 3. Revert log_events
    op.drop_constraint('fk_log_events_account_id', 'log_events', type_='foreignkey')
    op.drop_index(op.f('ix_log_events_account_id'), table_name='log_events')
    op.drop_index('idx_log_account_timestamp', table_name='log_events')
    op.drop_column('log_events', 'account_id')

    # 4. Revert audit_logs
    op.drop_constraint('fk_audit_logs_account_id', 'audit_logs', type_='foreignkey')
    op.drop_index(op.f('ix_audit_logs_account_id'), table_name='audit_logs')
    op.drop_column('audit_logs', 'account_id')

    # 5. Recreate staff table
    op.create_table(
        'staff',
        sa.Column('id', sa.String(length=50), nullable=False),
        sa.Column('username', sa.String(length=50), nullable=False),
        sa.Column('password_hash', sa.String(length=255), nullable=False),
        sa.Column('code', sa.String(length=20), nullable=False),
        sa.Column('full_name', sa.String(length=100), nullable=False),
        sa.Column('role', sa.String(length=100), nullable=False),
        sa.Column('department', sa.String(length=50), nullable=False),
        sa.Column('default_dashboard', sa.String(length=50), nullable=False),
        sa.Column('location', sa.String(length=100), nullable=False),
        sa.Column('status', sa.String(length=50), nullable=False),
        sa.Column('current_tasks_count', sa.Integer(), nullable=False),
        sa.Column('avatar_url', sa.Text(), nullable=True),
        sa.Column('email', sa.String(length=100), nullable=True),
        sa.Column('phone', sa.String(length=50), nullable=True),
        sa.Column('shift', sa.String(length=50), nullable=True),
        sa.Column('is_fallback_agent', sa.Boolean(), nullable=False),
        sa.Column('assigned_floors', sa.String(length=100), nullable=True),
        sa.Column('notification_channels', sa.String(length=200), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_staff_code'), 'staff', ['code'], unique=True)
    op.create_index(op.f('ix_staff_username'), 'staff', ['username'], unique=True)

    # 6. Copy data back from accounts to staff
    op.execute("""
        INSERT INTO staff (
            id, username, password_hash, code, full_name, role,
            department, default_dashboard, location, status,
            current_tasks_count, avatar_url, email, phone, shift,
            is_fallback_agent, assigned_floors, notification_channels,
            is_active, created_at, updated_at
        )
        SELECT
            a.id, a.username, a.password_hash, a.code, a.full_name, a.role,
            COALESCE(a.department, 'Housekeeping'), a.default_dashboard, a.location, a.status,
            a.current_tasks_count, a.avatar_url, a.email, a.phone, a.shift,
            a.is_fallback_agent, a.assigned_floors, a.notification_channels,
            a.is_active, a.created_at, a.updated_at
        FROM accounts a;
    """)

    # 7. Re-point foreign keys back to staff
    op.drop_constraint('fk_maintenance_requests_assigned_staff_id', 'maintenance_requests', type_='foreignkey')
    op.create_foreign_key('maintenance_requests_assigned_staff_id_fkey', 'maintenance_requests', 'staff', ['assigned_staff_id'], ['id'])

    op.drop_constraint('fk_housekeeping_requests_assigned_staff_id', 'housekeeping_requests', type_='foreignkey')
    op.create_foreign_key('housekeeping_requests_assigned_staff_id_fkey', 'housekeeping_requests', 'staff', ['assigned_staff_id'], ['id'])

    op.drop_constraint('fk_bell_requests_assigned_staff_id', 'bell_requests', type_='foreignkey')
    op.create_foreign_key('bell_requests_assigned_staff_id_fkey', 'bell_requests', 'staff', ['assigned_staff_id'], ['id'])

    # 8. Drop accounts and departments
    op.drop_index(op.f('ix_accounts_username'), table_name='accounts')
    op.drop_index(op.f('ix_accounts_department_id'), table_name='accounts')
    op.drop_index(op.f('ix_accounts_code'), table_name='accounts')
    op.drop_table('accounts')

    op.drop_index(op.f('ix_departments_code'), table_name='departments')
    op.drop_table('departments')
