"""Add filler source settings to channels

Revision ID: 0011
Revises: 0010
Create Date: 2026-03-13
"""
from alembic import op
import sqlalchemy as sa

revision = '0011'
down_revision = '0010'
branch_labels = None
depends_on = None

def upgrade():
    # Add filler source fields to channels
    op.add_column('channels', sa.Column('filler_enabled', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('channels', sa.Column('filler_source_type', sa.String(20), nullable=True))  # 'playlist', 'rtmp', 'hls'
    op.add_column('channels', sa.Column('filler_source_id', sa.UUID(), nullable=True))  # references playlists.id if type=playlist
    op.add_column('channels', sa.Column('filler_source_url', sa.Text(), nullable=True))  # RTMP/HLS URL if type=rtmp/hls
    
    # Add foreign key for playlist filler
    op.create_foreign_key(
        'fk_channels_filler_playlist',
        'channels', 'playlists',
        ['filler_source_id'], ['id'],
        ondelete='SET NULL'
    )

def downgrade():
    op.drop_constraint('fk_channels_filler_playlist', 'channels', type_='foreignkey')
    op.drop_column('channels', 'filler_source_url')
    op.drop_column('channels', 'filler_source_id')
    op.drop_column('channels', 'filler_source_type')
    op.drop_column('channels', 'filler_enabled')
