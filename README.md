# StreamPanel v2.1

Multi-tenant linear streaming platform with automated 24/7 VOD playout, live cut-in, and multi-platform restreaming.

## Features

- **Automated 24/7 Playout** — Schedule-based FFmpeg streaming with clock-sync, no gaps
- **Live Cut-In** — Seamless OBS takeover with automatic return to schedule on disconnect
- **Multi-Platform Restreaming** — YouTube, Facebook, Twitch, TikTok, Kick, Custom RTMP
- **Multi-Tenant** — Fully isolated channels, assets, schedules, and users per tenant
- **Genre Tags** — Tag videos and playlists by genre (R&B, Dancehall, Soul, Rock, Pop, Reggae, Hip-Hop) with filter support across Assets, Playlists, and Schedule
- **HLS + WebRTC Playback** — Low-latency viewing on any device
- **Role-Based Access** — Super Admin, Tenant Admin, Operator
- **Upload & Manage** — Drag-and-drop video upload with processing status and metadata extraction

## Performance

Tested on a 16-core / 70GB RAM server:

| Metric | Value |
|--------|-------|
| Concurrent dashboard users | ~500–1,000 |
| Concurrent HLS stream viewers | Thousands (handled by SRS, not the API) |
| Uvicorn API workers | 33 (2× cores + 1) |
| PostgreSQL shared_buffers | 17GB |
| Playout workers | Independent per channel — unaffected by viewer or user load |

> Viewer load (HLS) and tenant/dashboard load are fully decoupled. You can have thousands of viewers with zero impact on the API.

## Quick Start
```bash
git clone https://github.com/streamjamz/streampanel.git
cd streampanel
sudo bash install.sh
```

> **Note:** The install script builds SRS 7.0 from source. This takes 10–15 minutes on first install.

See [docs/INSTALLATION.md](docs/INSTALLATION.md) for the full setup guide.

## Architecture
```
Nginx (SSL + Static files)
    │
    ├── /api/*   → FastAPI (uvicorn, 33 workers, port 8000)
    ├── /hls/*   → SRS HLS output (port 8080)
    └── /        → React frontend (/var/www/panel)

FastAPI
    ├── PostgreSQL  (data — 17GB shared_buffers)
    ├── Redis       (pub/sub, channel state, AOF persistence)
    └── SRS 7.0     (RTMP/HLS/WebRTC)
            │
            ├── Playout Workers    (FFmpeg, one per channel)
            ├── Switch Controller  (FSM, OBS detection)
            └── Restream Workers   (multi-platform output)
```

## Stack

| Component | Version |
|-----------|---------|
| Python | 3.11+ |
| FastAPI | 0.111 |
| PostgreSQL | 15+ |
| Redis | 7+ |
| SRS | 7.0.137 |
| FFmpeg | 5.1+ |
| Node.js | 20+ |
| React | 18 |

## Paths

| Path | Purpose |
|------|---------|
| `/var/lib/panel/api` | Backend source |
| `/var/lib/panel/frontend` | Frontend source |
| `/var/lib/panel/media` | Uploaded media files |
| `/var/lib/panel/venv` | Python virtualenv |
| `/var/www/panel` | Built frontend (served by Nginx) |
| `/etc/panel/panel.env` | Environment config |
| `/var/log/panel/` | Application logs |

## Services

| Service | Purpose |
|---------|---------|
| `panel-api` | FastAPI backend (uvicorn) |
| `panel-switch-controller` | Channel state machine |
| `panel-playout@{id}` | Per-channel FFmpeg playout |
| `srs` | RTMP/HLS/WebRTC media server |
| `nginx` | Reverse proxy + static files |

## Documentation

- [Installation Guide](docs/INSTALLATION.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)

## License

MIT

## Contributors / DJ Takeover Feature

Allows DJs, guests, and co-hosts to stream directly to your channel with their own credentials.

### Setup

1. **Add Contributors** (Admin → Contributors):
   - Click "+ Add Contributor"
   - Enter name and role (DJ/Guest/Co-host)
   - System generates unique stream key automatically
   - Copy RTMP server and stream key

2. **Schedule Contributor Blocks**:
   - Go to Schedule → Add Block → Contributor tab
   - Select contributor from dropdown
   - Set duration (15m, 30m, 1hr, 2hr, 3hr, or custom)
   - Set start time
   - Save

3. **Go Live**:
   - Contributor connects OBS anytime (VOD continues)
   - At scheduled time, playout switches to contributor stream
   - After duration, automatically returns to next scheduled block

### OBS Setup for Contributors

**Server:** rtmp://vod.sjamz.com:1935/live  
**Stream Key:** (provided by admin, looks like `ctbfrd4nlJbiYAgDXJdXBn6P5x3KS4jZ`)

**Settings → Video:**
- Base (Canvas) Resolution: 1920x1080
- Output (Scaled) Resolution: 1920x1080

**Settings → Output:**
- Video Bitrate: 4000 Kbps
- Encoder: x264
- Keyframe Interval: 2

**Add your video source and right-click → Transform → Fit to Screen**

### Live Status Indicator

The Contributors page shows a 🔴 LIVE badge next to contributors who are currently streaming. Updates every 5 seconds.

### Contributor Limits

- Default: 3 contributors per channel
- Super-admins can adjust limits in Channel Settings
- Upgrade prompt shown when limit reached

### Troubleshooting

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for common issues and solutions.
