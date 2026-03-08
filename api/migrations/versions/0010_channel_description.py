"""channel description

Revision ID: 0010
Revises: 0009
Create Date: 2026-03-08
"""
from alembic import op
import sqlalchemy as sa

revision = '0010'
down_revision = '0009'
branch_labels = None
depends_on = None

def upgrade():
    op.add_column('channels', sa.Column('description', sa.Text(), nullable=True))

def downgrade():
    op.drop_column('channels', 'description')
