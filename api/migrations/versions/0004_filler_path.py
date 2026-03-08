"""Add filler_path to channels

Revision ID: 0004_filler_path
Revises: 0003_tenant_plans
Create Date: 2026-03-01
"""
from alembic import op
import sqlalchemy as sa

revision = '0004_filler_path'
down_revision = '0003_tenant_plans'
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.add_column('channels', sa.Column('filler_path', sa.Text(), nullable=True))

def downgrade() -> None:
    op.drop_column('channels', 'filler_path')
