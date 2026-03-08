"""Add tenant plan and feature fields

Revision ID: 0003_tenant_plans
Revises: 0002_playlists
Create Date: 2026-03-01
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '0003_tenant_plans'
down_revision = '0002'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('tenants', sa.Column('plan', sa.String(30), nullable=False, server_default='enterprise'))
    op.add_column('tenants', sa.Column('max_channels', sa.Integer(), nullable=False, server_default='999'))
    op.add_column('tenants', sa.Column('max_storage_gb', sa.Integer(), nullable=False, server_default='99999'))
    op.add_column('tenants', sa.Column('feature_flags', postgresql.JSON(astext_type=sa.Text()), nullable=True))
    op.add_column('tenants', sa.Column('notes', sa.String(500), nullable=True))


def downgrade() -> None:
    op.drop_column('tenants', 'plan')
    op.drop_column('tenants', 'max_channels')
    op.drop_column('tenants', 'max_storage_gb')
    op.drop_column('tenants', 'feature_flags')
    op.drop_column('tenants', 'notes')
