import { useEffect, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../api/client'
import Hls from 'hls.js'

function HLSPlayer({ hlsUrl, autoPlay = true }: { hlsUrl: string, autoPlay?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null)
  const hlsRef = useRef<any>(null)

  useEffect(() => {
    if (!ref.current || !hlsUrl) return
    if (Hls.isSupported()) {
      const hls = new Hls({
        liveSyncDurationCount: 3,
        liveMaxLatencyDurationCount: 10,
        liveDurationInfinity: true,
        manifestLoadingMaxRetry: 30,
        fragLoadingMaxRetry: 30,
        manifestLoadingRetryDelay: 1000,
      })
      hlsRef.current = hls
      hls.loadSource(hlsUrl)
      hls.attachMedia(ref.current)
      if (autoPlay) ref.current.play().catch(() => {})
      hls.on(Hls.Events.ERROR, (_: any, data: any) => {
        if (data.fatal) {
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) hls.startLoad()
          else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError()
        }
      })
      return () => { hls.destroy(); hlsRef.current = null }
    } else if (ref.current.canPlayType('application/vnd.apple.mpegurl')) {
      ref.current.src = hlsUrl
    }
  }, [hlsUrl])

  return (
    <video ref={ref} controls autoPlay muted playsInline
      style={{ width:'100%', aspectRatio:'16/9', background:'#000', display:'block' }}
    />
  )
}

export default function WatchChannel() {
  const { tenantSlug, channelSlug } = useParams<{ tenantSlug: string, channelSlug: string }>()
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState(false)
  const [copied, setCopied] = useState(false)

  const load = () => {
    api.get(`/channels/public/watch/${tenantSlug}/${channelSlug}`)
      .then(r => setData(r.data))
      .catch(() => setError(true))
  }

  useEffect(() => {
    load()
    const iv = setInterval(load, 15000) // refresh state every 15s
    return () => clearInterval(iv)
  }, [tenantSlug, channelSlug])

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (error) return (
    <div style={{ minHeight:'100vh', background:'#0a0a0a', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'system-ui', color:'#fff' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:64, marginBottom:16, opacity:0.2 }}>◉</div>
        <div style={{ fontSize:18, fontWeight:700, marginBottom:8 }}>Channel not found</div>
        <div style={{ fontSize:13, color:'#6b7280' }}>This channel doesn't exist or is unavailable.</div>
        <Link to={`/watch/${tenantSlug}`} style={{ display:'inline-block', marginTop:20, fontSize:13, color:'#f59e0b' }}>← Back to all channels</Link>
      </div>
    </div>
  )

  if (!data) return (
    <div style={{ minHeight:'100vh', background:'#0a0a0a', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ width:32, height:32, border:'2px solid #f59e0b', borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/>
    </div>
  )

  const { tenant, channel } = data
  const isLive = channel.state === 'LIVE_ONLY' || channel.state === 'TV_LIVE_RUNNING'
  const isOnAir = channel.state === 'TV_VOD_RUNNING' || channel.state === 'TV_LIVE_RUNNING' || channel.state === 'LIVE_ONLY'
  const isTV = channel.channel_type === 'tv'
  const upcomingSchedule = channel.upcoming_schedule || []

  return (
    <div style={{ minHeight:'100vh', background:'#0a0a0a', color:'#fff', fontFamily:'"Inter", system-ui, sans-serif' }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes fadein { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        a { text-decoration: none; }
        video:focus { outline: none; }
      `}</style>

      {/* Top bar */}
      <header style={{ borderBottom:'1px solid #161616', padding:'14px 28px', display:'flex', alignItems:'center', justifyContent:'space-between', background:'#0a0a0a', position:'sticky', top:0, zIndex:20 }}>
        <Link to={`/watch/${tenantSlug}`} style={{ display:'flex', alignItems:'center', gap:10, color:'#fff' }}>
          <div style={{ width:30, height:30, borderRadius:8, background:'linear-gradient(135deg,#f59e0b,#b45309)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:900, color:'#000' }}>◈</div>
          <span style={{ fontSize:14, fontWeight:700, color:'#d1d5db' }}>{tenant.name}</span>
        </Link>
        <div style={{ fontSize:11, color:'#4b5563' }}>StreamPanel</div>
      </header>

      {/* Main layout */}
      <div style={{ maxWidth:1280, margin:'0 auto', padding:'24px 28px', display:'grid', gridTemplateColumns:'1fr 340px', gap:28, animation:'fadein 0.3s ease' }}>

        {/* Left: player + info */}
        <div>
          {/* Player */}
          <div style={{ borderRadius:12, overflow:'hidden', background:'#000', border:'1px solid #1a1a1a', marginBottom:18 }}>
            {isOnAir ? (
              <HLSPlayer hlsUrl={channel.hls_url}/>
            ) : (
              <div style={{ aspectRatio:'16/9', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:14, background:'#080808', padding:'32px' }}>
                <div style={{ fontSize:52, opacity:0.15 }}>◉</div>
                <div style={{ textAlign:'center', maxWidth:400 }}>
                  <div style={{ fontSize:15, fontWeight:700, marginBottom:4 }}>Off Air</div>
                  <div style={{ fontSize:12, color:'#6b7280', marginBottom:20 }}>
                    {isTV ? 'No content scheduled right now — check back soon' : 'Stream is currently offline'}
                  </div>
                  
                  {/* Upcoming Schedule */}
                  {upcomingSchedule.length > 0 && (
                    <div style={{ 
                      background:'rgba(245,158,11,0.05)', 
                      border:'1px solid rgba(245,158,11,0.2)', 
                      borderRadius:8, 
                      padding:'16px 20px',
                      textAlign:'left'
                    }}>
                      <div style={{ 
                        fontSize:11, 
                        fontWeight:700, 
                        color:'#f59e0b', 
                        textTransform:'uppercase', 
                        letterSpacing:'0.1em', 
                        marginBottom:12 
                      }}>
                        Coming Up
                      </div>
                      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                        {upcomingSchedule.map((item: any, i: number) => (
                          <div key={i} style={{ 
                            display:'flex', 
                            alignItems:'center', 
                            gap:10,
                            fontSize:12,
                            color:'#d1d5db'
                          }}>
                            <div style={{ 
                              fontWeight:700, 
                              color:'#f59e0b',
                              minWidth:70,
                              fontVariantNumeric:'tabular-nums'
                            }}>
                              {item.time}
                            </div>
                            <div style={{ flex:1, color:'#9ca3af' }}>
                              {item.content}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Title row */}
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:16, marginBottom:14 }}>
            <div>
              <h1 style={{ fontSize:22, fontWeight:800, letterSpacing:'-0.02em', marginBottom:6 }}>{channel.name}</h1>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                {isLive ? (
                  <span style={{ display:'inline-flex', alignItems:'center', gap:5, background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:5, padding:'3px 9px' }}>
                    <span style={{ width:6, height:6, borderRadius:'50%', background:'#ef4444', animation:'pulse 1.2s ease-in-out infinite', display:'inline-block' }}/>
                    <span style={{ fontSize:10, fontWeight:800, color:'#ef4444', letterSpacing:'0.08em' }}>LIVE</span>
                  </span>
                ) : isOnAir ? (
                  <span style={{ display:'inline-flex', alignItems:'center', gap:5, background:'rgba(34,197,94,0.1)', border:'1px solid rgba(34,197,94,0.3)', borderRadius:5, padding:'3px 9px' }}>
                    <span style={{ width:6, height:6, borderRadius:'50%', background:'#22c55e', animation:'pulse 1.2s ease-in-out infinite', display:'inline-block' }}/>
                    <span style={{ fontSize:10, fontWeight:800, color:'#22c55e', letterSpacing:'0.08em' }}>ON AIR</span>
                  </span>
                ) : (
                  <span style={{ display:'inline-flex', alignItems:'center', gap:5, background:'rgba(107,114,128,0.1)', border:'1px solid rgba(107,114,128,0.2)', borderRadius:5, padding:'3px 9px' }}>
                    <span style={{ fontSize:10, fontWeight:700, color:'#6b7280', letterSpacing:'0.08em' }}>OFFLINE</span>
                  </span>
                )}
                <span style={{ fontSize:11, color:'#6b7280', background:'#161616', border:'1px solid #262626', borderRadius:4, padding:'2px 7px', fontWeight:600 }}>
                  {isTV ? 'TV Station' : 'Live Channel'}
                </span>
              </div>
            </div>

            {/* Share button */}
            <button onClick={copyLink}
              style={{ flexShrink:0, display:'flex', alignItems:'center', gap:6, padding:'8px 14px', borderRadius:8, border:'1px solid #262626', background: copied ? 'rgba(34,197,94,0.1)' : '#111', color: copied ? '#22c55e' : '#9ca3af', fontSize:12, fontWeight:600, cursor:'pointer', transition:'all 0.15s' }}
            >
              {copied ? '✓ Copied!' : '🔗 Share'}
            </button>
          </div>

          {/* Divider */}
          <div style={{ borderTop:'1px solid #161616', paddingTop:18 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
              <div style={{ width:34, height:34, borderRadius:9, background:'linear-gradient(135deg,#f59e0b,#b45309)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:900, color:'#000', flexShrink:0 }}>◈</div>
              <div>
                <div style={{ fontSize:14, fontWeight:700 }}>{tenant.name}</div>
                <div style={{ fontSize:11, color:'#6b7280' }}>Broadcasting on StreamPanel</div>
              </div>
            </div>
            <p style={{ fontSize:13, color:'#9ca3af', lineHeight:1.7 }}>
              {isTV
                ? channel.description || `${channel.name} is a 24/7 TV station. Programming runs on a schedule — tune in anytime to see what's on.`
                : `${channel.name} broadcasts live events. When the stream is offline, check back for the next broadcast.`
              }
            </p>
          </div>
        </div>

        {/* Right: sidebar - other channels */}
        <div>
          <div style={{ fontSize:12, fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:14 }}>More from {tenant.name}</div>
          <OtherChannels tenantSlug={tenantSlug!} currentSlug={channelSlug!}/>
        </div>
      </div>
    </div>
  )
}

function OtherChannels({ tenantSlug, currentSlug }: { tenantSlug: string, currentSlug: string }) {
  const [channels, setChannels] = useState<any[]>([])

  useEffect(() => {
    api.get(`/channels/public/tenant/${tenantSlug}`)
      .then(r => setChannels(r.data.channels.filter((c: any) => c.slug !== currentSlug)))
      .catch(() => {})
  }, [tenantSlug, currentSlug])

  if (channels.length === 0) return (
    <div style={{ textAlign:'center', padding:'32px 16px', border:'1px dashed #1f1f1f', borderRadius:10 }}>
      <div style={{ fontSize:11, color:'#4b5563' }}>No other channels</div>
    </div>
  )

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
      {channels.map((ch: any) => {
        const isLive = ch.state === 'LIVE_ONLY' || ch.state === 'TV_LIVE_RUNNING'
        const isOnAir = ch.state === 'TV_VOD_RUNNING' || ch.state === 'TV_LIVE_RUNNING' || ch.state === 'LIVE_ONLY'
        return (
          <Link key={ch.id} to={`/watch/${tenantSlug}/${ch.slug}`}
            style={{ display:'flex', gap:10, padding:'10px', borderRadius:9, border:`1px solid ${isLive ? 'rgba(34,197,94,0.15)' : '#1a1a1a'}`, background:'#111', transition:'all 0.15s' }}
            onMouseEnter={(e:any) => { e.currentTarget.style.borderColor=isLive?'rgba(34,197,94,0.3)':'#262626'; e.currentTarget.style.background='#161616' }}
            onMouseLeave={(e:any) => { e.currentTarget.style.borderColor=isLive?'rgba(34,197,94,0.15)':'#1a1a1a'; e.currentTarget.style.background='#111' }}
          >
            <div style={{ width:80, flexShrink:0, aspectRatio:'16/9', background:'#0a0a0a', borderRadius:6, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, opacity: isLive ? 0.5 : 0.15, position:'relative', overflow:'hidden' }}>
              ◉
              {isLive && <div style={{ position:'absolute', top:4, left:4, background:'#ef4444', borderRadius:3, fontSize:8, fontWeight:800, padding:'1px 4px', color:'#fff', opacity:1 }}>LIVE</div>}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:13, fontWeight:600, marginBottom:4, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{ch.name}</div>
              <div style={{ fontSize:10, color: isLive ? '#22c55e' : '#6b7280', fontWeight:600 }}>{isLive ? '● On Air' : 'Offline'}</div>
            </div>
          </Link>
        )
      })}
    </div>
  )
}
