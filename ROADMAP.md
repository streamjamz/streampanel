# StreamPanel Roadmap

## In Progress
- None

## Planned Features — Priority Order

### Priority 1 — External Source Scheduling
Schedule external RTMP/HLS feeds as first-class schedule items alongside assets and playlists.
- Add `source_type` to schedule entries: `asset`, `playlist`, `rtmp`, `hls`
- Add `source_url` field for external feeds
- FFmpeg playout switches to external source at scheduled time
- Works independently from filler/fallback
- **No changes to existing schedule features**

### Priority 2 — Auto Schedule Fill / Filler Source
Automatically fill unscheduled gaps with a designated filler source.
- Per-channel setting: filler source type (playlist, RTMP URL, HLS URL)
- Scheduler detects gaps and routes to filler automatically
- Manual schedule overrides filler at scheduled times
- Affiliate station model: network feed as filler, local content interrupts on schedule

### Priority 3 — Multi-Source Channel Inputs / DJ Takeover
Multiple RTMP input keys per channel with live and scheduled switching.
- Each channel can have multiple contributor stream keys (DJ 1, DJ 2, Backup, etc.)
- Scheduled takeovers — switch to a contributor at a specific time slot
- Live manual switch from channel manager UI
- Auto fallback to main playout if contributor disconnects
- 2-3 second gap on switch is acceptable and expected
- Implementation: FFmpeg restarts with new source at switch time
- Contributor keys managed in channel settings, each gets unique RTMP key
- **Existing live cut-in and schedule features unchanged**

### Priority 4 — News Ticker / Lower Third Scroller
Burn a scrolling news ticker into the stream via FFmpeg drawtext filter.
- Pull headlines from multiple RSS feeds (BBC, AP, Reuters, etc.)
- Local news based on viewer geolocation
- Enable/disable toggle per channel in settings
- Backend caches and refreshes headlines on a timer

### Priority 5 — Traffic / Bandwidth Tracking
Track cumulative bandwidth consumed per tenant per month.
- Store bytes served from nginx logs into DB
- Reset monthly
- Show Traffic (GB) usage meter on tenant dashboard alongside existing stats

## Completed
- Password reset UI for admin panel
- CDN integration with auto fallback to local HLS
- Tenant usage widget (connections, bitrate, disk)
- Real-time viewer count from nginx log parsing
- External source scheduling groundwork (filler/fallback concept defined)
