"""add_pin_code_and_identity_number_to_rooms

Revision ID: e4a19b87df10
Revises: c20a2d32e19b
Create Date: 2026-10-20 14:38:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e4a19b87df10'
down_revision: Union[str, Sequence[str], None] = 'c20a2d32e19b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('rooms', sa.Column('pin_code', sa.String(length=10), nullable=True))
    op.add_column('rooms', sa.Column('identity_number', sa.String(length=50), nullable=True))


def downgrade() -> None:
    op.drop_column('rooms', 'identity_number')
    op.drop_column('rooms', 'pin_code')
