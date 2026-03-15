"""add_max_contributors_to_channels

Revision ID: 6e4b60adfb93
Revises: 7de13ff49164
Create Date: 2026-03-14 13:15:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '6e4b60adfb93'
down_revision = '7de13ff49164'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('channels', sa.Column('max_contributors', sa.Integer, nullable=False, server_default='3'))


def downgrade():
    op.drop_column('channels', 'max_contributors')
