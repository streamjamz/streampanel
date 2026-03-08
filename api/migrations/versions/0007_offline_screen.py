"""Add offline screen settings

Revision ID: 0007_offline_screen
Revises: 0006_api_keys
"""
from alembic import op
import sqlalchemy as sa

revision = '0007_offline_screen'
down_revision = '0006_api_keys'
branch_labels = None
depends_on = None

def upgrade():
    op.add_column('channels', sa.Column('offline_message', sa.Text(), nullable=True))
    op.add_column('channels', sa.Column('offline_logo_path', sa.Text(), nullable=True))
    op.add_column('channels', sa.Column('offline_bg_color', sa.String(7), nullable=True))
    op.execute("UPDATE channels SET offline_message = 'We''ll be back soon. Stay tuned!' WHERE offline_message IS NULL")
    op.execute("UPDATE channels SET offline_bg_color = '#0f0f0f' WHERE offline_bg_color IS NULL")

def downgrade():
    op.drop_column('channels', 'offline_bg_color')
    op.drop_column('channels', 'offline_logo_path')
    op.drop_column('channels', 'offline_message')
