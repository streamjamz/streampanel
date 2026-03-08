# StreamPanel Troubleshooting Guide

## Quick Health Check

Run these first to get a full picture:

```bash
# Service status
systemctl status panel-api panel-switch-controller srs nginx postgresql redis

# Recent logs (last 50 lines each)
tail -50 /var/log/panel/api-error.log
tail -50 /var/log/panel/switch-controller.log
tail -50 /var/log/srs/srs.log

# Active playout workers
systemctl list-units "panel-playout@*"

# Redis state
redis-cli keys "channel:*"
redis-cli keys "TV_VOD_RUNNING:*"
```

---

## Services

### panel-api not starting

```bash
# Check logs
journalctl -u panel-api -n 50 --no-pager

# Test manually
cd /var/lib/panel/api
set -a && source /etc/panel/panel.env && set +a
/var/lib/panel/venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000

# Common causes:
# - Database not running: systemctl start postgresql
# - Wrong DATABASE_URL in /etc/panel/panel.env
# - Port 8000 already in use: lsof -i :8000
```

### panel-switch-controller not starting

```bash
journalctl -u panel-switch-controller -n 50 --no-pager

# Redis connection issue?
redis-cli ping   # should return PONG
```

### Playout worker not starting

```bash
# Check specific channel worker
journalctl -u "panel-playout@CHANNEL_ID" -n 50 --no-pager
tail -f /var/log/panel/playout-CHANNEL_ID-error.log

# Start manually for debugging
cd /var/lib/panel/api
set -a && source /etc/panel/panel.env && set +a
/var/lib/panel/venv/bin/python -m app.workers.playout_worker CHANNEL_ID
```

---

## Playout Issues

### Playout not starting on schedule

```bash
# Check if schedule block has duration
cd /var/lib/panel/api
set -a && source /etc/panel/panel.env && set +a
python3 -c "
import asyncio
from app.database import AsyncSessionLocal
from app.models.schedule import ScheduleBlock
from sqlalchemy import select

async def check():
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(ScheduleBlock))
        for b in result.scalars().all():
            print(f'{b.id} | type={b.block_type} | duration={b.duration_secs} | mask={b.day_mask}')

asyncio.run(check())
"
# duration=None or duration=0 means block will never trigger
```

### Playout not resuming after OBS disconnects

```bash
# Check Redis for PAUSE/RESUME commands
redis-cli subscribe "playout:CHANNEL_ID"

# Check channel state in DB
cd /var/lib/panel/api
set -a && source /etc/panel/panel.env && set +a
python3 -c "
import asyncio
from app.database import AsyncSessionLocal
from app.models.channel import Channel
from sqlalchemy import select

async def check():
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Channel))
        for ch in result.scalars().all():
            print(f'{ch.name} | state={ch.state} | key={ch.stream_key}')

asyncio.run(check())
"

# Manually send RESUME command
redis-cli publish "playout:CHANNEL_ID" "RESUME_AS_CLOCK"
```

### FFmpeg crashing

```bash
tail -f /var/log/panel/playout-CHANNEL_ID-error.log

# Test FFmpeg manually
ffmpeg -re -i /path/to/video.mp4 -c:v libx264 -preset veryfast -f flv rtmp://127.0.0.1:1935/live/test

# Check asset file exists and is readable
ls -lh /var/lib/panel/media/TENANT_ID/ASSET_ID/
```

---

## Streaming Issues

### HLS not playing

```bash
# Check SRS is running
systemctl status srs
curl http://127.0.0.1:1985/api/v1/streams/

# Check HLS files exist
ls /var/lib/srs/hls/live/

# Check Nginx HLS proxy
curl -I http://localhost/hls/STREAM_KEY.m3u8
```

### OBS can't connect

```bash
# Check port 1935 is open
ss -tlnp | grep 1935
ufw status | grep 1935

# Check SRS is accepting connections
tail -20 /var/log/srs/srs.log

# Test RTMP locally
ffmpeg -re -i /path/to/test.mp4 -f flv rtmp://127.0.0.1:1935/live/test
```

### OBS connects but playout doesn't pause

```bash
# Check SRS hooks are firing
tail -f /var/log/srs/srs.log | grep hook
tail -f /var/log/panel/api.log | grep "OBS CONNECTED"

# Check hook URL in srs.conf
grep on_publish /etc/srs/srs.conf
# Should be: http://127.0.0.1:8000/api/hooks/srs/publish
```

---

## Database Issues

### Migration errors

```bash
cd /var/lib/panel/api
set -a && source /etc/panel/panel.env && set +a

# Check current migration state
/var/lib/panel/venv/bin/alembic current

# Show migration history
/var/lib/panel/venv/bin/alembic history

# Run pending migrations
/var/lib/panel/venv/bin/alembic upgrade head
```

### DB connection errors

```bash
# Test connection
psql $DATABASE_URL -c "SELECT 1;"

# Check PostgreSQL is running
systemctl status postgresql
pg_lsclusters
```

---

## Nginx Issues

### 502 Bad Gateway

```bash
# API running?
systemctl status panel-api
curl http://127.0.0.1:8000/api/health

# Nginx error log
tail -50 /var/log/nginx/error.log
```

### Frontend not updating after build

```bash
# Rebuild and redeploy
cd /var/lib/panel/frontend
npm run build
cp -r dist/* /var/www/panel/

# Clear Nginx cache if any
nginx -s reload
```

---

## Logs Reference

| Log File | Purpose |
|----------|---------|
| `/var/log/panel/api.log` | API stdout |
| `/var/log/panel/api-error.log` | API errors |
| `/var/log/panel/switch-controller.log` | Channel FSM |
| `/var/log/panel/playout-{id}.log` | Per-channel playout |
| `/var/log/panel/playout-{id}-error.log` | Per-channel errors |
| `/var/log/srs/srs.log` | SRS media server |
| `/var/log/nginx/error.log` | Nginx errors |
| `/var/log/nginx/access.log` | Nginx access |

---

## Useful Commands

```bash
# Restart all panel services
systemctl restart panel-api panel-switch-controller srs

# Watch all logs live
journalctl -fu panel-api &
journalctl -fu panel-switch-controller &
tail -f /var/log/srs/srs.log

# Check active RTMP streams
curl -s http://127.0.0.1:1985/api/v1/streams/ | python3 -m json.tool

# Check Redis pub/sub channels
redis-cli pubsub channels "*"

# Force stop a stuck playout worker
systemctl stop panel-playout@CHANNEL_ID
redis-cli del "TV_VOD_RUNNING:CHANNEL_ID"

# Check disk usage (media files)
du -sh /var/lib/panel/media/*

# Check all channel states in DB
cd /var/lib/panel/api && set -a && source /etc/panel/panel.env && set +a
python3 -c "
import asyncio
from app.database import AsyncSessionLocal
from app.models.channel import Channel
from sqlalchemy import select

async def check():
    async with AsyncSessionLocal() as db:
        for ch in (await db.execute(select(Channel))).scalars().all():
            print(f'{ch.name:30} state={ch.state:20} type={ch.channel_type}')

asyncio.run(check())
"
```

---

## Common Error Messages

| Error | Cause | Fix |
|-------|-------|-----|
| `AttributeError: 'NoneType' object has no attribute 'returncode'` | PAUSE arrived before FFmpeg started | Fixed in v2.1 — update playout_worker.py |
| `ModuleNotFoundError: No module named 'app'` | Wrong working directory | `cd /var/lib/panel/api` first |
| `sqlalchemy.exc.ArgumentError: Could not parse SQLAlchemy URL` | Env not loaded | `set -a && source /etc/panel/panel.env && set +a` |
| `Connection refused` on port 8000 | panel-api not running | `systemctl restart panel-api` |
| `Could not connect to RTMP` | SRS not running or port blocked | `systemctl restart srs && ufw allow 1935/tcp` |
