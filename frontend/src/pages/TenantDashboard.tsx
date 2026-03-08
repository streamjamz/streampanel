import React, { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { Layout } from '../components/Layout'
import { Spinner } from '../components/UI'

// HLS player using hls.js via CDN
function HlsPlayer({ hlsUrl, isRunning }: { hlsUrl: string, isRunning: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const hlsRef = useRef<any>(null)
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!hlsUrl || !isRunning) { setLoading(false); return }

    const initPlayer = () => {
      const video = videoRef.current
      if (!video) return
      const Hls = (window as any).Hls
      if (!Hls) return

      if (hlsRef.current) { hlsRef.current.destroy() }

      if (Hls.isSupported()) {
        const hls = new Hls({ enableWorker: false, lowLatencyMode: true })
        hlsRef.current = hls
        hls.loadSource(hlsUrl)
        hls.attachMedia(video)
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setLoading(false)
          setError(false)
          video.play().catch(() => {})
        })
        hls.on(Hls.Events.ERROR, (_: any, data: any) => {
          if (data.fatal) { setError(true); setLoading(false) }
        })
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = hlsUrl
        video.addEventListener('loadedmetadata', () => { setLoading(false); video.play().catch(() => {}) })
      }
    }

    // Load hls.js if not already loaded
    if (!(window as any).Hls) {
      const script = document.createElement('script')
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/hls.js/1.4.12/hls.min.js'
      script.onload = initPlayer
      document.head.appendChild(script)
    } else {
      initPlayer()
    }

    return () => { if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null } }
  }, [hlsUrl, isRunning])

  if (!isRunning) {
    return (
      <div style={{ width: '100%', aspectRatio: '16/9', background: '#0a0a0a', borderRadius: 'var(--r)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, border: '1px solid var(--border)' }}>
        <div style={{ fontSize: 32 }}>📺</div>
        <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Channel is offline</div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ width: '100%', aspectRatio: '16/9', background: '#0a0a0a', borderRadius: 'var(--r)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, border: '1px solid var(--border)' }}>
        <div style={{ fontSize: 32 }}>⚠️</div>
        <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Stream not available</div>
        <button onClick={() => { setError(false); setLoading(true) }} style={{ fontSize: 11, padding: '5px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-2)', cursor: 'pointer' }}>Retry</button>
      </div>
    )
  }

  return (
    <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', background: '#000', borderRadius: 'var(--r)', overflow: 'hidden', border: '1px solid var(--border)' }}>
      {loading && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a', zIndex: 1 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <Spinner size={24}/>
            <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Connecting to stream...</div>
          </div>
        </div>
      )}
      <video ref={videoRef} muted controls style={{ width: '100%', height: '100%', display: 'block' }}/>
      <div style={{ position: 'absolute', top: 8, left: 8, display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(0,0,0,0.7)', padding: '3px 8px', borderRadius: 4 }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ff4d4d', display: 'inline-block', animation: 'pulse 1.4s ease-in-out infinite' }}/>
        <span style={{ fontSize: 10, fontWeight: 700, color: '#fff', letterSpacing: '0.08em' }}>LIVE</span>
      </div>
    </div>
  )
}

function CopyBox({ label, value }: { label: string, value: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '8px 12px', fontSize: 12, fontFamily: 'var(--mono)', color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</div>
        <button onClick={copy} style={{ flexShrink: 0, padding: '7px 12px', borderRadius: 'var(--r)', border: '1px solid var(--border)', background: copied ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.05)', color: copied ? '#22c55e' : 'var(--text-2)', fontSize: 11, cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap' }}>
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>
    </div>
  )
}

function ChannelCard({ ch, tenantSlug }: { ch: any, tenantSlug: string }) {
  const [ingest, setIngest] = useState<any>(null)
  const [playback, setPlayback] = useState<any>(null)
  const [showEmbed, setShowEmbed] = useState(false)
  const [tab, setTab] = useState<'stream' | 'playback'>('stream')

  useEffect(() => {
    api.get(`/channels/${ch.id}/ingest`).then(r => setIngest(r.data)).catch(() => {})
    api.get(`/channels/${ch.id}/playback`).then(r => setPlayback(r.data)).catch(() => {})
  }, [ch.id])

  const isLive = ch.channel_type === 'live'
  const isRunning = true
  const embedCode = playback ? `<iframe\n  src="${playback.hls_url}"\n  width="640" height="360"\n  frameborder="0"\n  allowfullscreen>\n</iframe>` : ''

  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ padding: '16px 22px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 9, background: isLive ? 'rgba(59,158,255,0.15)' : 'rgba(168,85,247,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17 }}>
            {isLive ? '📡' : '📺'}
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{ch.name}</div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{isLive ? 'Live Stream' : 'TV Station'}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 5,
            background: isRunning ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.05)',
            color: isRunning ? '#22c55e' : 'var(--text-3)' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: isRunning ? '#22c55e' : 'var(--text-3)', display: 'inline-block' }}/>
            {ch.state?.replace(/_/g, ' ') ?? 'OFFLINE'}
          </div>
          <Link to={`/channels/${ch.id}`} style={{ textDecoration: 'none' }}>
            <button style={{ padding: '6px 14px', borderRadius: 'var(--r)', border: 'none', background: 'var(--amber)', color: '#000', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Manage →</button>
          </Link>
        </div>
      </div>

      {/* Body — Player left, Info right */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 0 }}>

        {/* Player */}
        <div style={{ padding: '20px 22px', borderRight: '1px solid var(--border)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
            Preview
          </div>
          {playback ? (
            <HlsPlayer hlsUrl={playback.hls_url} isRunning={isRunning}/>
          ) : (
            <div style={{ width: '100%', aspectRatio: '16/9', background: '#0a0a0a', borderRadius: 'var(--r)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Spinner size={24}/>
            </div>
          )}
        </div>

        {/* Info panel */}
        <div style={{ padding: '20px 22px' }}>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 16, background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: 3 }}>
            {(['stream', 'playback'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} style={{ flex: 1, padding: '6px 0', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em',
                background: tab === t ? 'var(--bg-card)' : 'transparent',
                color: tab === t ? 'var(--amber)' : 'var(--text-3)', transition: 'all 0.15s' }}>
                {t === 'stream' ? '🎙 Stream' : '▶ Playback'}
              </button>
            ))}
          </div>

          {tab === 'stream' && ingest && (
            <>
              <CopyBox label="RTMP Server" value={ingest.rtmp_url ?? ''}/>
              <CopyBox label="Stream Key" value={ingest.stream_key ?? ''}/>
              <CopyBox label="Full RTMP URL" value={ingest.rtmp_url ?? ''}/>
              <div style={{ marginTop: 12, padding: '10px 12px', background: 'rgba(59,158,255,0.08)', borderRadius: 'var(--r)', border: '1px solid rgba(59,158,255,0.15)' }}>
                <div style={{ fontSize: 11, color: '#3b9eff', fontWeight: 600, marginBottom: 4 }}>OBS Settings</div>
                <div style={{ fontSize: 11, color: 'var(--text-3)', lineHeight: 1.6 }}>
                  Service: Custom<br/>
                  Server: rtmp://YOUR_SERVER:1935/live<br/>
                  Stream Key: (copy above)
                </div>
              </div>
            </>
          )}

          {tab === 'playback' && playback && (
            <>
              <CopyBox label="HLS URL" value={playback.hls_url ?? ''}/>
              <CopyBox label="WebRTC URL" value={playback.webrtc_url ?? ''}/>
              {tenantSlug && ch.slug && <CopyBox label="Public Watch URL" value={`${window.location.origin}/watch/${tenantSlug}/${ch.slug}`}/>}
              <div style={{ marginTop: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Embed Code</div>
                  <button onClick={() => setShowEmbed(!showEmbed)} style={{ fontSize: 11, color: 'var(--amber)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>{showEmbed ? 'Hide' : 'Show'}</button>
                </div>
                {showEmbed && (
                  <div style={{ position: 'relative' }}>
                    <textarea readOnly value={embedCode} rows={5} style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '9px 12px', fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text-2)', resize: 'none', boxSizing: 'border-box' }}/>
                    <button onClick={() => navigator.clipboard.writeText(embedCode)} style={{ position: 'absolute', top: 6, right: 6, padding: '3px 8px', borderRadius: 4, border: 'none', background: 'rgba(255,255,255,0.1)', color: 'var(--text-2)', fontSize: 10, cursor: 'pointer' }}>Copy</button>
                  </div>
                )}
              </div>
            </>
          )}

          {!isLive && (
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Link to={`/channels/${ch.id}/assets`} style={{ textDecoration: 'none' }}>
                <div style={{ padding: '8px 12px', borderRadius: 'var(--r)', border: '1px solid var(--border)', fontSize: 12, color: 'var(--text)', background: 'transparent', cursor: 'pointer', transition: 'background 0.15s' }}
                  onMouseEnter={(e: any) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                  onMouseLeave={(e: any) => e.currentTarget.style.background = 'transparent'}>
                  ⬆ Upload Videos
                </div>
              </Link>
              <Link to={`/playlists`} style={{ textDecoration: 'none' }}>
                <div style={{ padding: '8px 12px', borderRadius: 'var(--r)', border: '1px solid var(--border)', fontSize: 12, color: 'var(--text)', background: 'transparent', cursor: 'pointer', transition: 'background 0.15s' }}
                  onMouseEnter={(e: any) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                  onMouseLeave={(e: any) => e.currentTarget.style.background = 'transparent'}>
                  ♫ Manage Playlists
                </div>
              </Link>
              <Link to={`/channels/${ch.id}/schedule`} style={{ textDecoration: 'none' }}>
                <div style={{ padding: '8px 12px', borderRadius: 'var(--r)', border: '1px solid var(--border)', fontSize: 12, color: 'var(--text)', background: 'transparent', cursor: 'pointer', transition: 'background 0.15s' }}
                  onMouseEnter={(e: any) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                  onMouseLeave={(e: any) => e.currentTarget.style.background = 'transparent'}>
                  🕐 Schedule
                </div>
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function TenantDashboard() {
  const [channels, setChannels] = useState<any[]>([])
  const [tenantSlug, setTenantSlug] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/channels').then(r => setChannels(r.data)).finally(() => setLoading(false))
    api.get('/users/me').then(r => setTenantSlug(r.data?.tenant_slug ?? "")).catch(() => {})
  }, [])

  return (
    <Layout>
      <div style={{ padding: '28px 32px', animation: 'fadein 0.25s ease' }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4, letterSpacing: '-0.02em' }}>My Channels</h1>
          <p style={{ fontSize: 13, color: 'var(--text-2)' }}>Your streaming setup and live preview</p>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><Spinner size={32}/></div>
        ) : channels.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 80, color: 'var(--text-3)' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📡</div>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>No channels set up yet</div>
            <div style={{ fontSize: 13 }}>Contact your administrator to get started.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {channels.map((ch: any) => <ChannelCard key={ch.id} ch={ch} tenantSlug={tenantSlug}/>)}
          </div>
        )}
      </div>
    </Layout>
  )
}
