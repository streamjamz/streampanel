import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../api/client'

const typeLabel: Record<string, string> = { live: 'LIVE', tv: 'TV STATION' }
const typeColor: Record<string, string> = { live: '#ef4444', tv: '#8b5cf6' }

function LiveDot({ active }: { active: boolean }) {
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:5 }}>
      <span style={{
        width:7, height:7, borderRadius:'50%',
        background: active ? '#22c55e' : '#6b7280',
        boxShadow: active ? '0 0 6px #22c55e' : 'none',
        animation: active ? 'pulse 1.5s ease-in-out infinite' : 'none',
        display:'inline-block',
      }}/>
      <span style={{ fontSize:10, fontWeight:700, letterSpacing:'0.1em', color: active ? '#22c55e' : '#6b7280' }}>
        {active ? 'ON AIR' : 'OFFLINE'}
      </span>
    </span>
  )
}

export default function WatchTenant() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>()
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    api.get(`/channels/public/tenant/${tenantSlug}`)
      .then(r => setData(r.data))
      .catch(() => setError(true))
  }, [tenantSlug])

  if (error) return (
    <div style={{ minHeight:'100vh', background:'#0a0a0a', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'system-ui', color:'#fff' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:64, marginBottom:16, opacity:0.2 }}>◉</div>
        <div style={{ fontSize:18, fontWeight:700, marginBottom:8 }}>Station not found</div>
        <div style={{ fontSize:13, color:'#6b7280' }}>This station doesn't exist or is currently unavailable.</div>
      </div>
    </div>
  )

  if (!data) return (
    <div style={{ minHeight:'100vh', background:'#0a0a0a', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ width:32, height:32, border:'2px solid #f59e0b', borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/>
    </div>
  )

  const { tenant, channels } = data
  const liveChannels = channels.filter((c: any) => c.state === 'LIVE_ONLY' || c.state === 'TV_VOD_RUNNING' || c.state === 'TV_LIVE_RUNNING')

  return (
    <div style={{ minHeight:'100vh', background:'#0a0a0a', color:'#fff', fontFamily:'"Inter", system-ui, sans-serif' }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes fadein { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        a { color: inherit; text-decoration: none; }
      `}</style>

      {/* Header */}
      <header style={{ borderBottom:'1px solid #1f1f1f', padding:'18px 40px', display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, background:'rgba(10,10,10,0.95)', backdropFilter:'blur(12px)', zIndex:10 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ width:36, height:36, borderRadius:10, background:'linear-gradient(135deg,#f59e0b,#b45309)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, fontWeight:900, color:'#000' }}>◈</div>
          <div>
            <div style={{ fontSize:16, fontWeight:800, letterSpacing:'-0.02em' }}>{tenant.name}</div>
            <div style={{ fontSize:11, color:'#6b7280' }}>{channels.length} channel{channels.length!==1?'s':''} · {liveChannels.length} live</div>
          </div>
        </div>
        <div style={{ fontSize:11, color:'#4b5563', fontFamily:'monospace' }}>Powered by StreamPanel</div>
      </header>

      <main style={{ maxWidth:1100, margin:'0 auto', padding:'48px 40px', animation:'fadein 0.4s ease' }}>

        {/* Hero */}
        <div style={{ marginBottom:48 }}>
          <h1 style={{ fontSize:36, fontWeight:900, letterSpacing:'-0.03em', marginBottom:8 }}>
            Watch {tenant.name}
          </h1>
          <p style={{ fontSize:15, color:'#9ca3af' }}>
            {liveChannels.length > 0
              ? `${liveChannels.length} channel${liveChannels.length!==1?'s':''} streaming live right now`
              : 'No channels currently live — check back soon'}
          </p>
        </div>

        {/* Channel grid */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(320px, 1fr))', gap:20 }}>
          {channels.map((ch: any) => {
            const isLive = ch.state === 'LIVE_ONLY' || ch.state === 'TV_VOD_RUNNING' || ch.state === 'TV_LIVE_RUNNING'
            return (
              <Link key={ch.id} to={`/watch/${tenantSlug}/${ch.slug}`}
                style={{ display:'block', background:'#111', border:`1px solid ${isLive ? 'rgba(34,197,94,0.2)' : '#1f1f1f'}`, borderRadius:14, overflow:'hidden', transition:'all 0.2s', cursor:'pointer' }}
                onMouseEnter={(e:any) => { e.currentTarget.style.transform='translateY(-3px)'; e.currentTarget.style.borderColor=isLive?'rgba(34,197,94,0.4)':'#374151' }}
                onMouseLeave={(e:any) => { e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.borderColor=isLive?'rgba(34,197,94,0.2)':'#1f1f1f' }}
              >
                {/* Thumbnail area */}
                <div style={{ aspectRatio:'16/9', background:'#0a0a0a', position:'relative', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  {isLive ? (
                    <div style={{ position:'absolute', inset:0, background:'radial-gradient(ellipse at center, rgba(34,197,94,0.08) 0%, transparent 70%)' }}/>
                  ) : null}
                  <div style={{ fontSize:36, opacity: isLive ? 0.6 : 0.15 }}>◉</div>
                  {isLive && (
                    <div style={{ position:'absolute', top:12, left:12, background:'#ef4444', color:'#fff', fontSize:10, fontWeight:800, padding:'3px 8px', borderRadius:4, letterSpacing:'0.08em' }}>
                      ● LIVE
                    </div>
                  )}
                  <div style={{ position:'absolute', top:12, right:12, background:'rgba(0,0,0,0.7)', border:`1px solid ${typeColor[ch.channel_type] || '#374151'}`, color: typeColor[ch.channel_type] || '#9ca3af', fontSize:9, fontWeight:800, padding:'2px 7px', borderRadius:3, letterSpacing:'0.1em' }}>
                    {typeLabel[ch.channel_type] || ch.channel_type.toUpperCase()}
                  </div>
                </div>

                {/* Info */}
                <div style={{ padding:'16px 18px' }}>
                  <div style={{ fontSize:15, fontWeight:700, marginBottom:6 }}>{ch.name}</div>
                  <LiveDot active={isLive}/>
                </div>
              </Link>
            )
          })}
        </div>

        {channels.length === 0 && (
          <div style={{ textAlign:'center', padding:'80px 20px', border:'1px dashed #1f1f1f', borderRadius:16 }}>
            <div style={{ fontSize:48, marginBottom:16, opacity:0.2 }}>📡</div>
            <div style={{ fontSize:16, fontWeight:700, marginBottom:8 }}>No channels yet</div>
            <div style={{ fontSize:13, color:'#6b7280' }}>This station hasn't set up any channels yet.</div>
          </div>
        )}
      </main>
    </div>
  )
}
