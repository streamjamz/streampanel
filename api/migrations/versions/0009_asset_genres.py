"""asset genres

Revision ID: 0009
Revises: 0008
Create Date: 2026-03-08
"""
from alembic import op
import sqlalchemy as sa

revision = '0009'
down_revision = '0008'
branch_labels = None
depends_on = None

def upgrade():
    op.add_column('assets', sa.Column('genres', sa.ARRAY(sa.String()), nullable=True, server_default='{}'))

def downgrade():
    op.drop_column('assets', 'genres')
