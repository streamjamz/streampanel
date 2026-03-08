"""Add stream_targets table

Revision ID: 0005_stream_targets
Revises: 0004_filler_path
Create Date: 2026-03-01
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = '0005_stream_targets'
down_revision = '0004_filler_path'
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.create_table(
        'stream_targets',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('channel_id', UUID(as_uuid=True), sa.ForeignKey('channels.id', ondelete='CASCADE'), nullable=False),
        sa.Column('tenant_id', UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False),
        sa.Column('platform', sa.String(20), nullable=False),
        sa.Column('name', sa.String(80), nullable=False),
        sa.Column('stream_key', sa.Text, nullable=False),
        sa.Column('rtmp_url', sa.Text, nullable=True),
        sa.Column('enabled', sa.Boolean, default=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index('ix_stream_targets_channel_id', 'stream_targets', ['channel_id'])

def downgrade() -> None:
    op.drop_index('ix_stream_targets_channel_id')
    op.drop_table('stream_targets')
