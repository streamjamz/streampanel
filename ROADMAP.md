# StreamPanel Roadmap

## In Progress
- None

## Planned Features

### 1. External Source Scheduling (High Priority)
Schedule external RTMP/HLS feeds as first-class schedule items alongside assets and playlists.
- Add `source_type` to schedule entries: `asset`, `playlist`, `rtmp`, `hls`
- Add `source_url` field for external feeds
- FFmpeg playout switches to external source at scheduled time
- Works independently from filler/fallback

### 2. Auto Schedule Fill / Filler Source (High Priority)
Automatically fill unscheduled gaps with a designated filler source.
- Per-channel setting: filler source type (playlist, RTMP URL, HLS URL)
- Scheduler detects gaps and routes to filler automatically
- Manual schedule overrides filler at scheduled times
- Affiliate station model: network feed as filler, local content interrupts on schedule

### 3. News Ticker / Lower Third Scroller (Medium Priority)
Burn a scrolling news ticker into the stream via FFmpeg drawtext filter.
- Pull headlines from multiple RSS feeds (BBC, AP, Reuters, etc.)
- Local news based on viewer geolocation
- Enable/disable toggle per channel in settings
- Backend caches and refreshes headlines on a timer

### 4. Traffic / Bandwidth Tracking (Medium Priority)
Track cumulative bandwidth consumed per tenant per month.
- Store bytes served from nginx logs into DB
- Reset monthly
- Show Traffic (GB) usage meter on tenant dashboard alongside existing stats

## Completed
- Password reset UI for admin panel
- CDN integration with auto fallback to local HLS
- Tenant usage widget (connections, bitrate, disk)
- Real-time viewer count from nginx log parsing
