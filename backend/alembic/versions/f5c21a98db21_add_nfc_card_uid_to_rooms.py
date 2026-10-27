"""add_nfc_card_uid_to_rooms

Revision ID: f5c21a98db21
Revises: e4a19b87df10
Create Date: 2026-10-25 00:28:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f5c21a98db21'
down_revision: Union[str, Sequence[str], None] = 'e4a19b87df10'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('rooms', sa.Column('nfc_card_uid', sa.String(length=50), nullable=True))
    op.create_index(op.f('ix_rooms_nfc_card_uid'), 'rooms', ['nfc_card_uid'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_rooms_nfc_card_uid'), table_name='rooms')
    op.drop_column('rooms', 'nfc_card_uid')
