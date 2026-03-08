import React, { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { Layout } from '../components/Layout'
import { Spinner } from '../components/UI'

function fmt(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

function fmtMbps(bps: number): string {
  return (bps / 1024 / 1024).toFixed(2) + ' Mbps'
}

function fmtKbps(kbps: number): string {
  if (kbps >= 1000) return (kbps / 1000).toFixed(1) + ' Mbps'
  return kbps + ' Kbps'
}

function statColor(pct: number) {
  return pct > 80 ? '#ff4d4d' : pct > 60 ? '#f59e0b' : '#3b9eff'
}

function DonutChart({ percent, color, size = 90 }: { percent: number, color: string, size?: number }) {
  const r = (size / 2) - 10
  const circ = 2 * Math.PI * r
  const offset = circ - (percent / 100) * circ
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={9}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={9}
        strokeDasharray={circ} strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 0.7s ease' }} strokeLinecap="round"/>
      <text x={size/2} y={size/2} textAnchor="middle" dominantBaseline="middle"
        style={{ transform: `rotate(90deg) translate(0px, -${size}px)`, fill: 'var(--text)', fontSize: 14, fontWeight: 700, fontFamily: 'var(--mono)' }}>
        {percent.toFixed(0)}%
      </text>
    </svg>
  )
}

function BarMeter({ percent, color }: { percent: number, color: string }) {
  return (
    <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 99, overflow: 'hidden', marginTop: 5 }}>
      <div style={{ height: '100%', width: `${Math.min(100, percent)}%`, background: color, borderRadius: 99, transition: 'width 0.7s ease' }}/>
    </div>
  )
}

function SparkChart({ data, color, height = 80 }: { data: number[], color: string, height?: number }) {
  if (data.length < 2) return <div style={{ height }}/>
  const max = Math.max(...data, 1)
  const w = 600; const h = height
  const points = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - (v / max) * h * 0.9}`).join(' ')
  const area = `0,${h} ${points} ${w},${h}`
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height }} preserveAspectRatio="none">
      <defs>
        <linearGradient id={`g${color.replace(/[^a-z0-9]/gi,'')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35"/>
          <stop offset="100%" stopColor={color} stopOpacity="0.02"/>
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#g${color.replace(/[^a-z0-9]/gi,'')})`}/>
      <polyline points={points} fill="none" stroke={color} strokeWidth="2.5"/>
    </svg>
  )
}

export default function Dashboard() {
  const [channels, setChannels] = useState<any[]>([])
  const [stats, setStats] = useState<any>(null)
  const [netRate, setNetRate] = useState({ rx: 0, tx: 0 })
  const [loading, setLoading] = useState(true)
  const prevNet = useRef<any>(null)
  const [connHistory, setConnHistory] = useState<number[]>([])
  const [rateHistory, setRateHistory] = useState<number[]>([])

  const load = async () => {
    try {
      const [ch, st] = await Promise.all([
        api.get('/channels'),
        api.get('/stats').catch(() => ({ data: null })),
      ])
      setChannels(ch.data)
      if (st.data) {
        if (prevNet.current) {
          const dt = 5
          const rx = Math.max(0, (st.data.network.bytes_recv - prevNet.current.bytes_recv) / dt)
          const tx = Math.max(0, (st.data.network.bytes_sent - prevNet.current.bytes_sent) / dt)
          setNetRate({ rx, tx })
          setRateHistory(h => [...h.slice(-29), (rx + tx) / 1024 / 1024])
        }
        prevNet.current = st.data.network
        setStats(st.data)
        const totalClients = (st.data.streams || []).reduce((a: number, s: any) => a + (s.clients || 0), 0)
        setConnHistory(h => [...h.slice(-29), totalClients])
      }
    } finally { setLoading(false) }
  }

  useEffect(() => { load(); const t = setInterval(load, 5000); return () => clearInterval(t) }, [])

  const onlineChannels = channels.filter(c => c.state?.includes('RUNNING')).length
  const offlineChannels = channels.length - onlineChannels
  const totalViewers = stats?.streams?.reduce((a: number, s: any) => a + (s.clients || 0), 0) ?? 0
  const totalKbps = stats?.streams?.reduce((a: number, s: any) => a + (s.kbps_send || 0), 0) ?? 0

  return (
    <Layout>
      <div style={{ padding: '28px 32px', animation: 'fadein 0.25s ease' }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 20, letterSpacing: '-0.02em' }}>Dashboard</h1>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><Spinner size={32}/></div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Top stat bars */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', overflow: 'hidden' }}>
              {[
                { icon: '📡', label: 'Channels Online', value: onlineChannels, color: '#22c55e', sub: `${offlineChannels} offline` },
                { icon: '⚠️', label: 'Channels Offline', value: offlineChannels, color: offlineChannels > 0 ? '#ff4d4d' : 'var(--text-3)', sub: `${channels.length} total` },
                { icon: '👥', label: 'Active Viewers', value: totalViewers, color: '#3b9eff', sub: `${fmtKbps(totalKbps)} out` },
              ].map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 18, padding: '20px 24px',
                  borderRight: i < 2 ? '1px solid var(--border)' : 'none', background: 'var(--bg-card)' }}>
                  <div style={{ width: 52, height: 52, borderRadius: 12, background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>{s.icon}</div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 2 }}>{s.label}</div>
                    <div style={{ fontSize: 28, fontWeight: 800, color: s.color, lineHeight: 1, fontFamily: 'var(--mono)' }}>{s.value}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 3 }}>{s.sub}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Main grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20 }}>

              {/* Left column */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

                {/* Connection chart */}
                <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '20px 22px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>Connections</div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{totalViewers} viewers @ {fmtMbps(netRate.rx + netRate.tx)}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 14, fontSize: 11, color: 'var(--text-3)' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 3, background: '#3b9eff', borderRadius: 99, display: 'inline-block' }}/>Connections</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 3, background: '#22c55e', borderRadius: 99, display: 'inline-block' }}/>Data Rate</span>
                    </div>
                  </div>
                  <div style={{ position: 'relative', height: 90 }}>
                    <div style={{ position: 'absolute', inset: 0 }}><SparkChart data={rateHistory} color="#22c55e" height={90}/></div>
                    <div style={{ position: 'absolute', inset: 0, opacity: 0.7 }}><SparkChart data={connHistory} color="#3b9eff" height={90}/></div>
                  </div>
                </div>

                {/* Active streams */}
                <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '20px 22px' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>Active Streams</div>
                  {(!stats?.streams || stats.streams.length === 0) ? (
                    <div style={{ fontSize: 13, color: 'var(--text-3)', padding: '16px 0', textAlign: 'center' }}>No active streams</div>
                  ) : stats.streams.map((s: any, i: number) => (
                    <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0',
                      borderBottom: i < stats.streams.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(59,158,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3b9eff" strokeWidth="2"><path d="M8.5 2C6 5 5 8 5 12s1 7 3.5 10M15.5 2C18 5 19 8 19 12s-1 7-3.5 10M2 12h20"/></svg>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{s.clients} connections @ {fmtKbps(s.kbps_send)}</div>
                      </div>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.publish ? '#22c55e' : '#ff4d4d', flexShrink: 0 }}/>
                    </div>
                  ))}
                </div>

                {/* System resources - circular donuts + disk bars */}
                {stats && (
                  <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '20px 22px' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 18 }}>System Resources</div>

                    {/* Circular donuts */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 24 }}>
                      {[
                        { label: 'CPU', pct: stats.cpu.percent, sub: `${stats.cpu.count} cores`, color: statColor(stats.cpu.percent) },
                        { label: 'Memory', pct: stats.memory.percent, sub: fmt(stats.memory.used), color: statColor(stats.memory.percent) },
                        { label: '↓ In', pct: Math.min(100,(netRate.rx/(100*1024*1024))*100), sub: fmt(netRate.rx)+'/s', color: '#22c55e' },
                        { label: '↑ Out', pct: Math.min(100,(netRate.tx/(100*1024*1024))*100), sub: fmt(netRate.tx)+'/s', color: '#f59e0b' },
                      ].map(d => (
                        <div key={d.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                          <DonutChart percent={d.pct} color={d.color} size={90}/>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 12, fontWeight: 600 }}>{d.label}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{d.sub}</div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Disk bars */}
                    {stats.disks.slice(0, 4).map((d: any) => (
                      <div key={d.mountpoint} style={{ marginBottom: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 2 }}>
                          <span style={{ fontFamily: 'var(--mono)', color: 'var(--text-2)' }}>{d.mountpoint}</span>
                          <span style={{ color: statColor(d.percent) }}>{fmt(d.used)} / {fmt(d.total)} · {d.percent.toFixed(0)}%</span>
                        </div>
                        <BarMeter percent={d.percent} color={statColor(d.percent)}/>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Right column */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Channels list */}
                <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '20px 22px' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>Channels</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {channels.map((ch: any) => {
  const isOnline = ch.state?.includes('RUNNING') || ch.state === 'LIVE_ONLY'
  return (
    <Link key={ch.id} to={`/channels/${ch.id}`} style={{ textDecoration: 'none' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 'var(--r)', background: 'rgba(255,255,255,0.03)', border: '1px solid transparent', transition: 'border-color 0.15s' }}
        onMouseEnter={(e: any) => e.currentTarget.style.borderColor = 'var(--amber)'}
        onMouseLeave={(e: any) => e.currentTarget.style.borderColor = 'transparent'}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: isOnline ? '#22c55e' : 'var(--text-3)', flexShrink: 0 }}/>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ch.name}</div>
            {ch.tenant_name && (
              <div style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3, background: 'rgba(245,158,11,0.15)', color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0 }}>
                {ch.tenant_name}
              </div>
            )}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase' }}>{ch.channel_type}</div>
        </div>
        <div style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 4,
          background: isOnline ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.05)',
          color: isOnline ? '#22c55e' : 'var(--text-3)' }}>
          {isOnline ? 'ONLINE' : 'OFFLINE'}
        </div>
      </div>
    </Link>
  )
})}
                  </div>
                </div>

                {/* Quick links */}
                <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '20px 22px' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Quick Access</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {[
                      { label: 'Upload Video', icon: '⬆️', to: channels[0] ? `/channels/${channels[0].id}/assets` : '/' },
                      { label: 'Manage Playlists', icon: '🎵', to: channels[0] ? `/channels/${channels[0].id}/playlists` : '/' },
                      { label: 'Schedule', icon: '🕐', to: channels[0] ? `/channels/${channels[0].id}/schedule` : '/' },
                    ].map(l => (
                      <Link key={l.label} to={l.to} style={{ textDecoration: 'none' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 'var(--r)', background: 'rgba(255,255,255,0.03)', fontSize: 13, color: 'var(--text)', transition: 'background 0.15s' }}
                          onMouseEnter={(e: any) => e.currentTarget.style.background = 'rgba(255,255,255,0.07)'}
                          onMouseLeave={(e: any) => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}>
                          <span>{l.icon}</span><span>{l.label}</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
