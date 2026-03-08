"""Add playlists and playlist_items tables

Revision ID: 0002
Revises: 0001
Create Date: 2026-02-28 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '0002'
down_revision = '0001'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'playlists',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('shuffle', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('idx_playlists_tenant', 'playlists', ['tenant_id'])

    op.create_table(
        'playlist_items',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('playlist_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('playlists.id', ondelete='CASCADE'), nullable=False),
        sa.Column('asset_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('assets.id', ondelete='CASCADE'), nullable=False),
        sa.Column('position', sa.Integer(), server_default='0', nullable=False),
    )
    op.create_index('idx_playlist_items_playlist', 'playlist_items', ['playlist_id'])

    op.add_column('schedule_blocks',
        sa.Column('playlist_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('playlists.id', ondelete='SET NULL'), nullable=True)
    )


def downgrade():
    op.drop_column('schedule_blocks', 'playlist_id')
    op.drop_table('playlist_items')
    op.drop_table('playlists')
