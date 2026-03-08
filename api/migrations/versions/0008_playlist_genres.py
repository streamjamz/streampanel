from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '0008'
down_revision = '0007_offline_screen'
branch_labels = None
depends_on = None

def upgrade():
    op.add_column('playlists', sa.Column('genres', postgresql.ARRAY(sa.String()), nullable=True, server_default='{}'))

def downgrade():
    op.drop_column('playlists', 'genres')
