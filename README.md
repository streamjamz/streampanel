# StreamPanel v2.1

Multi-tenant streaming platform with automated VOD playout, live cut-in, and multi-platform restreaming.

## Features

- **Automated 24/7 Playout** — Schedule-based FFmpeg streaming with clock-sync
- **Live Cut-In** — Seamless OBS takeover with automatic return to schedule
- **Multi-Platform Restreaming** — YouTube, Facebook, Twitch, TikTok, Kick, Custom RTMP
- **Multi-Tenant** — Isolated channels, assets, and schedules per tenant
- **Genre-Tagged Playlists** — Organize and filter playlists by genre
- **HLS + WebRTC Playback** — Low-latency viewing on any device
- **Role-Based Access** — Super Admin, Tenant Admin, Operator

## Quick Start

```bash
git clone https://github.com/streamjamz/streampanel.git
cd streampanel
sudo bash install.sh
```

See [docs/INSTALLATION.md](docs/INSTALLATION.md) for full setup guide.

## Architecture

```
Nginx (SSL + Static)
    │
    ├── /api/*     → FastAPI (uvicorn, port 8000)
    ├── /hls/*     → SRS HLS output (port 8080)
    └── /          → React frontend (/var/www/panel)

FastAPI
    ├── PostgreSQL  (data)
    ├── Redis       (pub/sub, state)
    └── SRS         (RTMP/HLS/WebRTC)
            │
            ├── Playout Workers   (FFmpeg, per-channel)
            ├── Switch Controller (FSM, OBS detection)
            └── Restream Workers  (multi-platform)
```

## Stack

| Component | Version |
|-----------|---------|
| Python | 3.11+ |
| FastAPI | 0.111 |
| PostgreSQL | 15+ |
| Redis | 7+ |
| SRS | 6.0 |
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

## Documentation

- [Installation Guide](docs/INSTALLATION.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)
- [Stream Targets](docs/STREAM_TARGETS.md)
- [Deployment & Updates](docs/DEPLOYMENT.md)

## License

MIT
