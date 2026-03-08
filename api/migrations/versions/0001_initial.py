"""Initial schema

Revision ID: 0001
Revises:
Create Date: 2024-01-01 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '0001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.execute('CREATE EXTENSION IF NOT EXISTS "pgcrypto"')

    op.create_table(
        'tenants',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('name', sa.String(120), nullable=False, unique=True),
        sa.Column('slug', sa.String(60), nullable=False, unique=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        'users',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False),
        sa.Column('email', sa.String(254), nullable=False, unique=True),
        sa.Column('hashed_password', sa.String(255), nullable=False),
        sa.Column('role', sa.String(20), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.func.now()),
        sa.Column('last_login', sa.TIMESTAMP(timezone=True), nullable=True),
    )
    op.create_index('idx_users_tenant', 'users', ['tenant_id'])

    op.create_table(
        'channels',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(120), nullable=False),
        sa.Column('slug', sa.String(80), nullable=False),
        sa.Column('channel_type', sa.String(10), nullable=False),
        sa.Column('stream_key', sa.String(64), nullable=False, unique=True),
        sa.Column('state', sa.String(30), nullable=False, server_default='OFFLINE'),
        sa.Column('auto_return_to_vod', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('live_timeout_seconds', sa.Integer(), nullable=False, server_default='10'),
        sa.Column('return_strategy', sa.String(20), nullable=False, server_default='as_clock'),
        sa.Column('logo_path', sa.Text(), nullable=True),
        sa.Column('logo_position', sa.String(20), nullable=True, server_default='top-right'),
        sa.Column('timezone', sa.String(60), nullable=False, server_default='UTC'),
        sa.Column('playout_pid', sa.Integer(), nullable=True),
        sa.Column('last_live_seen', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint('tenant_id', 'slug', name='uq_channel_tenant_slug'),
    )

    op.create_table(
        'assets',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False),
        sa.Column('filename', sa.String(255), nullable=False),
        sa.Column('original_name', sa.String(255), nullable=False),
        sa.Column('file_path', sa.Text(), nullable=False),
        sa.Column('file_size', sa.BigInteger(), nullable=True),
        sa.Column('duration_secs', sa.Numeric(10, 3), nullable=True),
        sa.Column('width', sa.Integer(), nullable=True),
        sa.Column('height', sa.Integer(), nullable=True),
        sa.Column('video_codec', sa.String(30), nullable=True),
        sa.Column('audio_codec', sa.String(30), nullable=True),
        sa.Column('audio_channels', sa.Integer(), nullable=True),
        sa.Column('thumbnail_path', sa.Text(), nullable=True),
        sa.Column('status', sa.String(20), nullable=False, server_default='processing'),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('idx_assets_tenant', 'assets', ['tenant_id'])

    op.create_table(
        'schedule_blocks',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('channel_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('channels.id', ondelete='CASCADE'), nullable=False),
        sa.Column('asset_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('assets.id', ondelete='SET NULL'), nullable=True),
        sa.Column('block_type', sa.String(20), nullable=False, server_default='asset'),
        sa.Column('start_time', sa.Time(), nullable=False),
        sa.Column('duration_secs', sa.Numeric(10, 3), nullable=True),
        sa.Column('day_mask', sa.SmallInteger(), nullable=False, server_default='127'),
        sa.Column('priority', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('idx_schedule_channel', 'schedule_blocks', ['channel_id'])

    op.create_table(
        'refresh_tokens',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('token_hash', sa.Text(), nullable=False, unique=True),
        sa.Column('expires_at', sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        'playout_cursors',
        sa.Column('channel_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('channels.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('current_block_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('schedule_blocks.id', ondelete='SET NULL'), nullable=True),
        sa.Column('position_secs', sa.Numeric(10, 3), nullable=False, server_default='0'),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.func.now()),
    )


def downgrade():
    op.drop_table('playout_cursors')
    op.drop_table('refresh_tokens')
    op.drop_table('schedule_blocks')
    op.drop_table('assets')
    op.drop_table('channels')
    op.drop_table('users')
    op.drop_table('tenants')
