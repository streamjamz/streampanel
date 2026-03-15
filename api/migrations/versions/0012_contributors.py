"""Add contributors table and channel contributor limit

Revision ID: 0012
Revises: 0011
Create Date: 2026-03-13
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
import secrets

revision = '0012'
down_revision = '0011'
branch_labels = None
depends_on = None

def upgrade():
    # Add contributor limit to channels (default 3, super-admin can change)
    op.add_column('channels', sa.Column('contributor_limit', sa.Integer(), nullable=False, server_default='3'))
    
    # Create contributors table
    op.create_table(
        'contributors',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('channel_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(120), nullable=False),
        sa.Column('stream_key', sa.String(64), nullable=False, unique=True),
        sa.Column('role', sa.String(30), nullable=False, server_default='DJ'),  # DJ, Guest, Co-host
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('recurring_enabled', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('recurring_day', sa.Integer(), nullable=True),  # 0=Monday, 6=Sunday
        sa.Column('recurring_start_time', sa.Time(), nullable=True),  # e.g. 20:00
        sa.Column('recurring_duration_minutes', sa.Integer(), nullable=True),  # e.g. 120
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['channel_id'], ['channels.id'], ondelete='CASCADE'),
    )
    
    # Create index on channel_id for fast lookups
    op.create_index('ix_contributors_channel_id', 'contributors', ['channel_id'])

def downgrade():
    op.drop_index('ix_contributors_channel_id', table_name='contributors')
    op.drop_table('contributors')
    op.drop_column('channels', 'contributor_limit')
