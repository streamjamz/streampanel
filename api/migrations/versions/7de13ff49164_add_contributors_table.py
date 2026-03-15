"""add_contributors_table

Revision ID: 7de13ff49164
Revises: 0010_channel_description
Create Date: 2026-03-13 21:45:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers, used by Alembic.
revision = '7de13ff49164'
down_revision = '0010'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'contributors',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('channel_id', UUID(as_uuid=True), sa.ForeignKey('channels.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('stream_key', sa.String(64), unique=True, nullable=False),
        sa.Column('role', sa.String(50), nullable=False, server_default='DJ'),  # DJ, Guest, Co-host
        sa.Column('is_active', sa.Boolean, nullable=False, server_default='true'),
        sa.Column('recurring_schedule', sa.Text, nullable=True),  # JSON string: {"day": "friday", "start": "20:00", "end": "22:00"}
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index('ix_contributors_channel_id', 'contributors', ['channel_id'])


def downgrade():
    op.drop_index('ix_contributors_channel_id')
    op.drop_table('contributors')
