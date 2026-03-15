# StreamPanel Troubleshooting Guide

## Contributors / DJ Takeover Issues

### Contributor stream not connecting ("Unknown stream key")

**Symptoms:**
- OBS shows connection rejected
- SRS logs show "Unknown stream key"

**Solution:**
```bash
# Check if hooks are working
curl http://127.0.0.1:8000/api/ping

# Restart API
systemctl restart panel-api

# Check contributor exists
psql -U paneluser -d streampanel -c "SELECT name, stream_key FROM contributors;"
```

### VOD pauses when contributor connects (should continue playing)

**Symptoms:**
- Contributor connects to OBS
- Playout immediately pauses instead of waiting for scheduled time

**Cause:** Hooks treating contributor as regular OBS cut-in

**Solution:**
Check hooks.py has contributor detection:
```bash
grep -A5 "Check if this is a contributor" /var/lib/panel/api/app/routers/hooks.py
```

Should see code checking `Contributor` table and skipping PAUSE command.

### Contributor stream never ends after duration

**Symptoms:**
- Contributor block duration expires
- Playout keeps playing contributor stream
- Doesn't switch to next scheduled block

**Solution:**
```bash
# Check playout worker has contributor in polling list
grep "current_block_type in ('rtmp', 'hls', 'contributor')" /var/lib/panel/api/app/workers/playout_worker.py
```

If not found, add 'contributor' to the tuple.

Restart playout:
```bash
systemctl restart panel-playout@<CHANNEL_ID>
```

### Video appears small/letterboxed during contributor streams

**Symptoms:**
- Contributor video has black bars (not fullscreen)
- VOD playback is fine

**Cause:** OBS canvas/output resolution mismatch

**Solution:**
In OBS:
1. Settings → Video
2. Base (Canvas) Resolution: 1920x1080
3. Output (Scaled) Resolution: 1920x1080
4. Right-click video source → Transform → Fit to Screen (or Ctrl+F)

### 🔴 LIVE indicator not showing

**Symptoms:**
- Contributor is streaming in OBS
- No red LIVE badge appears on Contributors page

**Diagnosis:**
```bash
# Check SRS sees the stream
curl http://127.0.0.1:1985/api/v1/streams/ | grep -A10 "<STREAM_KEY>"

# Test status endpoint
curl -H "Authorization: Bearer <TOKEN>" \
  http://127.0.0.1:8000/api/contributors/channel/<CHANNEL_ID>/status
```

**Solutions:**
1. **API endpoint missing:**
```bash
grep "get_contributors_status" /var/lib/panel/api/app/routers/contributors.py
systemctl restart panel-api
```

2. **Frontend not polling:**
Check browser console (F12) for errors. Should see requests to `/api/contributors/channel/.../status` every 5 seconds.

3. **SRS not responding:**
```bash
systemctl status srs
curl http://127.0.0.1:1985/api/v1/streams/
```

---

## General Playout Issues

### Playout worker crashes on startup

**Check error logs:**
```bash
tail -100 /var/log/panel/playout-<CHANNEL_ID>-error.log
```

**Common causes:**

1. **Foreign key violation (orphaned cursor):**
```bash
# Fix: Clear invalid cursor
cd /var/lib/panel/api
export $(grep -v '^#' /etc/panel/panel.env | xargs)
/var/lib/panel/venv/bin/python3 -c "
import asyncio, uuid
from app.database import AsyncSessionLocal
from app.models.playout_cursor import PlayoutCursor

async def fix():
    async with AsyncSessionLocal() as db:
        cursor = await db.get(PlayoutCursor, uuid.UUID('<CHANNEL_ID>'))
        if cursor:
            cursor.current_block_id = None
            await db.commit()
            print('Fixed')

asyncio.run(fix())
"
```

2. **Missing imports:**
Check for `ImportError` or `NameError` in logs. Usually means model imports missing.

3. **IndentationError:**
Python syntax error in playout_worker.py. Check recent edits.

### Schedule not switching between blocks

**Check:**
```bash
# View current schedule
curl http://127.0.0.1:8000/api/schedule?channel_id=<CHANNEL_ID>

# Check playout logs
tail -f /var/log/panel/playout-<CHANNEL_ID>.log
```

Should see "Poll: new_block=..." messages every 5 seconds for RTMP/HLS/contributor blocks.

### HLS/RTMP stream drops after 30 seconds

**Symptoms:**
- External stream plays briefly
- Cuts to next block or off-air

**Causes:**
1. Source stream ended/unavailable
2. Network timeout
3. Invalid URL

**Check:**
```bash
# Test stream manually
ffplay <RTMP_OR_HLS_URL>

# Check ffmpeg stderr
# (playout worker redirects to DEVNULL, check system logs)
journalctl -u panel-playout@<CHANNEL_ID> -n 100
```

---

## Database Issues

### Migration failed
```bash
cd /var/lib/panel/api
source /var/lib/panel/venv/bin/activate
alembic current
alembic history
alembic upgrade head
```

### Duplicate key errors (contributors)
```bash
# Check for duplicates
psql -U paneluser -d streampanel -c "
SELECT stream_key, COUNT(*) FROM contributors 
GROUP BY stream_key HAVING COUNT(*) > 1;
"
```

---

## API Issues

### API won't start (port 8000 in use)
```bash
# Find what's using port 8000
lsof -i :8000

# Kill old process
kill -9 <PID>

# Restart
systemctl restart panel-api
```

### Routes return 404

**Check router registration in main.py:**
```bash
grep "app.include_router" /var/lib/panel/api/app/main.py
```

Should see `contributors.router` and `hooks.router`.

**Missing decorator:**
```bash
# Check all route decorators exist
grep -n "@router\.(get|post|patch|delete)" /var/lib/panel/api/app/routers/contributors.py
```

---

## Frontend Build Issues

### TypeScript errors
```bash
cd /var/lib/panel/frontend
npm run build 2>&1 | tee build-errors.log
```

Common fixes:
- Missing type imports
- Incorrect type annotations
- Fragment not closed (`<>` without `</>`)

### Changes not appearing
```bash
# Full rebuild
cd /var/lib/panel/frontend
npm run build
sudo rm -rf /var/www/panel/*
sudo cp -r dist/* /var/www/panel/

# Hard refresh browser (Ctrl+Shift+R)
```

---

## SRS Streaming Issues

### Streams rejected at SRS level

**Check SRS config:**
```bash
cat /usr/local/srs/conf/srs.conf | grep -A10 "http_hooks"
```

Should point to: `http://127.0.0.1:8000/api/hooks/srs/publish`

**Check hooks responding:**
```bash
curl -X POST http://127.0.0.1:8000/api/hooks/srs/publish?secret=disabled \
  -H "Content-Type: application/json" \
  -d '{"stream":"test-key"}'
```

Should return `{"code":0}` or `{"code":403,"msg":"Unknown stream key"}`

**SRS logs:**
```bash
tail -f /var/log/srs/srs.log
```

---

## Performance Issues

### High CPU usage
```bash
# Check processes
top -o %CPU

# Check ffmpeg instances
ps aux | grep ffmpeg
```

Multiple ffmpeg processes may be running if playout didn't clean up.

**Fix:**
```bash
# Kill orphaned ffmpeg
pkill -9 ffmpeg

# Restart playout workers
systemctl restart panel-playout@*
```

### High memory usage
```bash
free -h
# Check swap usage

# Restart API (multi-worker)
systemctl restart panel-api
```

---

## Quick Diagnostic Commands
```bash
# Check all services
systemctl status panel-api panel-playout@* srs nginx postgresql redis

# Check logs
tail -f /var/log/panel/api-error.log
tail -f /var/log/panel/playout-<CHANNEL_ID>.log
tail -f /var/log/srs/srs.log

# Test API
curl http://127.0.0.1:8000/api/ping

# Test SRS
curl http://127.0.0.1:1985/api/v1/streams/

# Check database
psql -U paneluser -d streampanel -c "\dt"
```

---

## Getting Help

1. Check logs first (API, playout, SRS)
2. Verify services are running
3. Test endpoints directly with curl
4. Check browser console for frontend errors
5. Review recent code changes with `git diff`

For contributor-specific issues, verify:
- Contributor exists in database
- Stream key matches exactly
- Hooks.py has contributor detection
- Playout worker polls for 'contributor' blocks
- SRS sees the incoming stream
