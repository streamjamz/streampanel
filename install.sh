#!/bin/bash
# StreamPanel v2.1 - Full Installation Script
# Supports: Debian 12 / Ubuntu 22.04+
# Usage: sudo bash install.sh

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; exit 1; }
info() { echo -e "${CYAN}[→]${NC} $1"; }

echo ""
echo "╔══════════════════════════════════════╗"
echo "║     StreamPanel v2.1 Installer       ║"
echo "╚══════════════════════════════════════╝"
echo ""

# ── Root check ────────────────────────────────────────────────
[[ $EUID -ne 0 ]] && err "Run as root: sudo bash install.sh"

# ── Collect config ────────────────────────────────────────────
read -p "Domain or IP (e.g. vod.example.com or 192.168.1.10): " DOMAIN
read -p "Admin username: " ADMIN_USER
read -s -p "Admin password: " ADMIN_PASS; echo ""
read -p "DB name [streampanel]: " DB_NAME;     DB_NAME=${DB_NAME:-streampanel}
read -p "DB user [paneluser]: "   DB_USER;     DB_USER=${DB_USER:-paneluser}
read -s -p "DB password: "        DB_PASS;     echo ""
read -p "Server public IP (for WebRTC): " PUBLIC_IP
read -p "Use HTTPS with Let's Encrypt? [y/N]: " USE_SSL

SECRET_KEY=$(openssl rand -hex 32)

info "Starting installation..."

# ── System packages ───────────────────────────────────────────
apt-get update -qq
apt-get install -y -qq \
    curl wget git build-essential \
    python3.11 python3.11-venv python3-pip \
    postgresql postgresql-contrib \
    redis-server \
    nginx \
    ffmpeg \
    nodejs npm \
    certbot python3-certbot-nginx \
    sudo logrotate

log "System packages installed"

# ── Node.js 20 ────────────────────────────────────────────────
NODE_VER=$(node --version 2>/dev/null | cut -d. -f1 | tr -d 'v' || echo "0")
if [[ $NODE_VER -lt 20 ]]; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
fi
log "Node.js $(node --version) ready"

# ── SRS Media Server ──────────────────────────────────────────
if ! command -v srs &>/dev/null; then
    info "Installing SRS..."
    apt-get install -y git make gcc g++ libssl-dev
    cd /tmp && git clone --depth 1 --branch v7.0.137 https://github.com/ossrs/srs.git srs-src
    cd /tmp/srs-src/trunk && ./configure && make -j$(nproc)
    cp /tmp/srs-src/trunk/objs/srs /usr/local/bin/srs
    rm -rf /tmp/srs-src
fi
log "SRS installed"

# ── Users & directories ───────────────────────────────────────
id -u panel &>/dev/null || useradd -r -s /bin/false -d /var/lib/panel panel
mkdir -p /var/lib/panel/{api,frontend,media}
mkdir -p /var/log/panel
mkdir -p /var/log/srs
mkdir -p /var/run/srs
mkdir -p /var/lib/srs/hls
mkdir -p /var/www/panel
mkdir -p /etc/panel
chown -R panel:panel /var/lib/panel /var/log/panel /var/lib/srs /var/run/srs
chown -R www-data:www-data /var/www/panel
log "Directories created"

# ── PostgreSQL ────────────────────────────────────────────────
systemctl start postgresql
systemctl enable postgresql

# Tune PostgreSQL based on available RAM
TOTAL_RAM_KB=$(grep MemTotal /proc/meminfo | awk '{print $2}')
SHARED_BUFFERS_GB=$(( TOTAL_RAM_KB / 1024 / 1024 / 4 ))
EFFECTIVE_CACHE_GB=$(( TOTAL_RAM_KB / 1024 / 1024 * 3 / 4 ))
[ "$SHARED_BUFFERS_GB" -lt 1 ] && SHARED_BUFFERS_GB=1
PGCONF=$(find /etc/postgresql -name postgresql.conf | head -1)
if [ -n "$PGCONF" ]; then
    cat >> "$PGCONF" << PGEOF

# StreamPanel performance tuning
shared_buffers = ${SHARED_BUFFERS_GB}GB
work_mem = 64MB
max_connections = 200
effective_cache_size = ${EFFECTIVE_CACHE_GB}GB
maintenance_work_mem = 2GB
checkpoint_completion_target = 0.9
wal_buffers = 64MB
PGEOF
    systemctl restart postgresql
    log "PostgreSQL tuned: shared_buffers=${SHARED_BUFFERS_GB}GB"
fi

sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" | grep -q 1 || \
    sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';"
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1 || \
    sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;"
log "PostgreSQL configured"

# ── Redis ─────────────────────────────────────────────────────
systemctl start redis-server
systemctl enable redis-server
redis-cli CONFIG SET appendonly yes
redis-cli CONFIG REWRITE
log "Redis AOF persistence enabled"
log "Redis ready"

# ── Clone repo ────────────────────────────────────────────────
info "Cloning StreamPanel..."
git clone https://github.com/streamjamz/streampanel.git /tmp/streampanel
cp -r /tmp/streampanel/api/* /var/lib/panel/api/
cp -r /tmp/streampanel/frontend /var/lib/panel/frontend
rm -rf /tmp/streampanel
chown -R panel:panel /var/lib/panel
log "Code deployed"

# ── Python venv ───────────────────────────────────────────────
python3.11 -m venv /var/lib/panel/venv
/var/lib/panel/venv/bin/pip install -q --upgrade pip
/var/lib/panel/venv/bin/pip install -q -r /var/lib/panel/api/requirements.txt
log "Python environment ready"

# ── Environment file ──────────────────────────────────────────
cat > /etc/panel/panel.env << EOF
DATABASE_URL=postgresql+asyncpg://$DB_USER:$DB_PASS@localhost/$DB_NAME
REDIS_URL=redis://localhost:6379/0
SECRET_KEY=$SECRET_KEY
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
REFRESH_TOKEN_EXPIRE_DAYS=30
SRS_API_URL=http://127.0.0.1:1985
SRS_RTMP_HOST=127.0.0.1
SRS_RTMP_PORT=1935
PANEL_BASE_URL=https://$DOMAIN
MEDIA_ROOT=/var/lib/panel/media
EOF
chmod 600 /etc/panel/panel.env
chown panel:panel /etc/panel/panel.env
log "Environment configured"

# ── Database migrations ───────────────────────────────────────
info "Running migrations..."
cd /var/lib/panel/api
set -a && source /etc/panel/panel.env && set +a
/var/lib/panel/venv/bin/alembic upgrade head
log "Migrations complete"

# ── Create admin user ─────────────────────────────────────────
info "Creating admin user..."
/var/lib/panel/venv/bin/python3 - << PYEOF
import asyncio, sys
sys.path.insert(0, '/var/lib/panel/api')
import os; os.chdir('/var/lib/panel/api')
from dotenv import load_dotenv
load_dotenv('/etc/panel/panel.env')
from app.database import AsyncSessionLocal
from app.models.user import User
from app.models.tenant import Tenant
from app.core.security import get_password_hash
import uuid

async def create_admin():
    async with AsyncSessionLocal() as db:
        tenant = Tenant(id=uuid.uuid4(), name="Default", slug="default", plan="enterprise")
        db.add(tenant)
        await db.flush()
        user = User(
            id=uuid.uuid4(),
            tenant_id=tenant.id,
            username="$ADMIN_USER",
            email="admin@$DOMAIN",
            hashed_password=get_password_hash("$ADMIN_PASS"),
            role="super_admin",
            is_active=True
        )
        db.add(user)
        await db.commit()
        print("Admin created")

asyncio.run(create_admin())
PYEOF
log "Admin user created"

# ── Frontend build ────────────────────────────────────────────
info "Building frontend..."
cd /var/lib/panel/frontend
npm install --silent
npm run build --silent
cp -r dist/* /var/www/panel/
log "Frontend built"

# ── SRS config ────────────────────────────────────────────────
mkdir -p /etc/srs
cat > /etc/srs/srs.conf << EOF
listen              1935;
max_connections     1000;
daemon              off;
srs_log_tank        file;
srs_log_file        /var/log/srs/srs.log;
srs_log_level       warn;
pid                 /var/run/srs/srs.pid;

http_api {
    enabled         on;
    listen          127.0.0.1:1985;
    crossdomain     off;
}

http_server {
    enabled         on;
    listen          0.0.0.0:8080;
    dir             /var/lib/srs/hls;
    crossdomain     on;
}

rtc_server {
    enabled         on;
    listen          udp://0.0.0.0:8000;
    candidate       $PUBLIC_IP;
}

vhost __defaultVhost__ {
    hls {
        enabled         on;
        hls_path        /var/lib/srs/hls;
        hls_fragment    2;
        hls_window      10;
        hls_cleanup     on;
        hls_wait_keyframe on;
        hls_m3u8_file   [app]/[stream].m3u8;
        hls_ts_file     [app]/[stream]-[seq].ts;
        hls_acodec      aac;
        hls_vcodec      h264;
    }

    rtc {
        enabled         on;
        rtmp_to_rtc     on;
        rtc_to_rtmp     off;
        nack            on;
        twcc            on;
    }

    http_hooks {
        enabled         on;
        on_publish      http://127.0.0.1:8000/api/hooks/srs/publish?secret=disabled;
        on_unpublish    http://127.0.0.1:8000/api/hooks/srs/unpublish?secret=disabled;
    }
}
EOF
log "SRS configured"

# ── Systemd services ──────────────────────────────────────────
cat > /etc/systemd/system/srs.service << EOF
[Unit]
Description=SRS Media Server
After=network.target

[Service]
Type=simple
ExecStart=/usr/local/bin/srs -c /etc/srs/srs.conf
Restart=always
RestartSec=5
StandardOutput=append:/var/log/srs/srs.log
StandardError=append:/var/log/srs/srs.log

[Install]
WantedBy=multi-user.target
EOF

cat > /etc/systemd/system/panel-api.service << EOF
[Unit]
Description=Panel FastAPI Backend
After=network.target postgresql.service redis.service

[Service]
Type=simple
User=panel
Group=panel
EnvironmentFile=/etc/panel/panel.env
WorkingDirectory=/var/lib/panel/api
ExecStart=/var/lib/panel/venv/bin/uvicorn app.main:app \
    --host 127.0.0.1 \
    --port 8000 \
    --workers $(( $(nproc) * 2 + 1 )) \
    --log-level warning
Restart=always
RestartSec=5
StandardOutput=append:/var/log/panel/api.log
StandardError=append:/var/log/panel/api-error.log

[Install]
WantedBy=multi-user.target
EOF

cat > /etc/systemd/system/panel-switch-controller.service << EOF
[Unit]
Description=Panel Switch Controller (Channel FSM)
After=network.target panel-api.service

[Service]
Type=simple
User=panel
Group=panel
EnvironmentFile=/etc/panel/panel.env
WorkingDirectory=/var/lib/panel/api
ExecStart=/var/lib/panel/venv/bin/python -m app.workers.switch_controller
Restart=always
RestartSec=5
StandardOutput=append:/var/log/panel/switch-controller.log
StandardError=append:/var/log/panel/switch-controller-error.log

[Install]
WantedBy=multi-user.target
EOF

cat > /etc/systemd/system/panel-playout@.service << EOF
[Unit]
Description=Panel Playout Worker for channel %i
After=srs.service panel-api.service

[Service]
Type=simple
User=panel
Group=panel
EnvironmentFile=/etc/panel/panel.env
WorkingDirectory=/var/lib/panel/api
ExecStart=/var/lib/panel/venv/bin/python -m app.workers.playout_worker %i
Restart=on-failure
RestartSec=5
StartLimitIntervalSec=60
StartLimitBurst=5
StandardOutput=append:/var/log/panel/playout-%i.log
StandardError=append:/var/log/panel/playout-%i-error.log

[Install]
WantedBy=multi-user.target
EOF

# sudo access for panel user to manage playout services
cat > /etc/sudoers.d/panel << EOF
panel ALL=(ALL) NOPASSWD: /bin/systemctl start panel-playout@*
panel ALL=(ALL) NOPASSWD: /bin/systemctl stop panel-playout@*
panel ALL=(ALL) NOPASSWD: /bin/systemctl restart panel-playout@*
panel ALL=(ALL) NOPASSWD: /bin/systemctl status panel-playout@*
EOF

systemctl daemon-reload
systemctl enable srs panel-api panel-switch-controller
systemctl start srs panel-api panel-switch-controller
log "Services configured and started"

# ── Nginx ─────────────────────────────────────────────────────
cat > /etc/nginx/sites-available/streampanel << EOF
server {
    listen 80;
    server_name $DOMAIN;

    client_max_body_size 10G;
    proxy_read_timeout 3600;
    proxy_connect_timeout 3600;
    proxy_send_timeout 3600;

    location /api/ {
        proxy_pass http://127.0.0.1:8000/api/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /hls/ {
        proxy_pass http://127.0.0.1:8080/live/;
        proxy_set_header Host \$host;
        add_header Cache-Control no-cache;
        add_header Access-Control-Allow-Origin *;
    }

    location /rtc/ {
        proxy_pass http://127.0.0.1:1985/rtc/;
        proxy_set_header Host \$host;
    }

    location / {
        root /var/www/panel;
        index index.html;
        try_files \$uri \$uri/ /index.html;
    }
}
EOF

ln -sf /etc/nginx/sites-available/streampanel /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl restart nginx
log "Nginx configured"

# ── SSL ───────────────────────────────────────────────────────
if [[ "$USE_SSL" =~ ^[Yy]$ ]]; then
    certbot --nginx -d $DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN
    log "SSL certificate issued"
fi

# ── Logrotate ─────────────────────────────────────────────────
cat > /etc/logrotate.d/streampanel << EOF
/var/log/panel/*.log {
    daily
    rotate 7
    compress
    missingok
    notifempty
    sharedscripts
}
EOF

# ── Done ──────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║        StreamPanel Installation Complete      ║"
echo "╠══════════════════════════════════════════════╣"
echo "║                                              ║"
echo "║  URL:      http://$DOMAIN"
echo "║  User:     $ADMIN_USER"
echo "║  Password: (as entered)"
echo "║                                              ║"
echo "║  Logs:     /var/log/panel/"
echo "║  Config:   /etc/panel/panel.env"
echo "║  Media:    /var/lib/panel/media/"
echo "║                                              ║"
echo "╚══════════════════════════════════════════════╝"
echo ""
