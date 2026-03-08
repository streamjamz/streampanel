# StreamPanel Installation Guide

## Requirements

- Debian 12 or Ubuntu 22.04+
- 4GB+ RAM (8GB recommended)
- 50GB+ disk (SSD recommended)
- Public IP or domain name
- Root access

## Installation

### 1. Clone and Run Installer

```bash
git clone https://github.com/streamjamz/streampanel.git
cd streampanel
sudo bash install.sh
```

The installer will prompt for:
- Domain or IP address
- Admin username and password
- Database name and credentials
- Public IP (for WebRTC)
- SSL (Let's Encrypt, optional)

### 2. What Gets Installed

- Python 3.11, Node.js 20, FFmpeg 5+
- PostgreSQL 15, Redis 7
- SRS 7.0 (RTMP/HLS/WebRTC)
- Nginx (reverse proxy + static files)
- All StreamPanel services

### 3. Services

| Service | Purpose |
|---------|---------|
| `panel-api` | FastAPI backend |
| `panel-switch-controller` | Channel state machine |
| `panel-playout@{id}` | Per-channel FFmpeg playout |
| `srs` | RTMP/HLS/WebRTC media server |
| `nginx` | Reverse proxy + static files |

### 4. First Login

```
URL:  https://your-domain.com
User: (as entered during install)
Pass: (as entered during install)
```

## Manual Installation

If you prefer to install manually:

### System Packages

```bash
apt-get update
apt-get install -y python3.11 python3.11-venv postgresql redis-server nginx ffmpeg nodejs npm
```

### Node.js 20

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
```

### SRS 6.0

```bash
wget https://github.com/ossrs/srs/releases/download/v6.0.90/srs_6.0.90.amd64.tar.gz -O /tmp/srs.tar.gz
tar -xzf /tmp/srs.tar.gz -C /tmp
cp /tmp/srs-6.0.90/objs/srs /usr/local/bin/srs
```

### Database

```bash
sudo -u postgres psql -c "CREATE USER paneluser WITH PASSWORD 'yourpassword';"
sudo -u postgres psql -c "CREATE DATABASE streampanel OWNER paneluser;"
```

### Python Environment

```bash
python3.11 -m venv /var/lib/panel/venv
/var/lib/panel/venv/bin/pip install -r api/requirements.txt
```

### Environment File

Create `/etc/panel/panel.env`:

```env
DATABASE_URL=postgresql+asyncpg://paneluser:yourpassword@localhost/streampanel
REDIS_URL=redis://localhost:6379/0
SECRET_KEY=your-random-secret-key-here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
REFRESH_TOKEN_EXPIRE_DAYS=30
SRS_API_URL=http://127.0.0.1:1985
SRS_RTMP_HOST=127.0.0.1
SRS_RTMP_PORT=1935
PANEL_BASE_URL=https://your-domain.com
MEDIA_ROOT=/var/lib/panel/media
```

Generate a secret key:
```bash
openssl rand -hex 32
```

### Run Migrations

```bash
cd /var/lib/panel/api
set -a && source /etc/panel/panel.env && set +a
/var/lib/panel/venv/bin/alembic upgrade head
```

### Build Frontend

```bash
cd /var/lib/panel/frontend
npm install
npm run build
cp -r dist/* /var/www/panel/
```

## Ports

| Port | Protocol | Purpose |
|------|----------|---------|
| 80/443 | TCP | HTTP/HTTPS (Nginx) |
| 1935 | TCP | RTMP ingest (OBS) |
| 8080 | TCP | HLS output |
| 8000 | UDP | WebRTC |
| 1985 | TCP | SRS API (localhost only) |

## OBS Settings

| Setting | Value |
|---------|-------|
| Service | Custom |
| Server | `rtmp://your-domain.com:1935/live` |
| Stream Key | (from channel settings in panel) |

## Firewall

```bash
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 1935/tcp
ufw allow 8080/tcp
ufw allow 8000/udp
```
