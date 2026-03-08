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

function BarMeter({ percent, color }: { percent: number, color: string }) {
  return (
    <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 99, overflow: 'hidden', marginTop: 6 }}>
      <div style={{ height: '100%', width: `${Math.min(100, percent)}%`, background: color, borderRadius: 99, transition: 'width 0.7s ease' }}/>
    </div>
  )
}

// Simple sparkline chart
function SparkChart({ data, color, height = 60 }: { data: number[], color: string, height?: number }) {
  if (data.length < 2) return <div style={{ height }}/>
  const max = Math.max(...data, 1)
  const w = 600; const h = height
  const points = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - (v / max) * h * 0.9}`).join(' ')
  const area = `0,${h} ${points} ${w},${h}`
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height }} preserveAspectRatio="none">
      <defs>
        <linearGradient id={`grad-${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3"/>
          <stop offset="100%" stopColor={color} stopOpacity="0.02"/>
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#grad-${color.replace('#','')})`}/>
      <polyline points={points} fill="none" stroke={color} strokeWidth="2"/>
    </svg>
  )
}

export default function Dashboard() {
  const [channels, setChannels] = useState<any[]>([])
  const [stats, setStats] = useState<any>(null)
  const [netRate, setNetRate] = useState({ rx: 0, tx: 0 })
  const [loading, setLoading] = useState(true)
  const prevNet = useRef<any>(null)

  // History for charts (last 30 data points = 2.5 min)
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
          const totalMbps = (rx + tx) / 1024 / 1024
          setRateHistory(h => [...h.slice(-29), totalMbps])
        }
        prevNet.current = st.data.network
        setStats(st.data)
        const totalClients = (st.data.streams || []).reduce((a: number, s: any) => a + (s.clients || 0), 0)
        setConnHistory(h => [...h.slice(-29), totalClients])
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    const t = setInterval(load, 5000)
    return () => clearInterval(t)
  }, [])

  const onlineChannels = channels.filter(c => c.state?.includes('RUNNING')).length
  const offlineChannels = channels.length - onlineChannels
  const totalViewers = stats?.streams?.reduce((a: number, s: any) => a + (s.clients || 0), 0) ?? 0
  const totalKbps = stats?.streams?.reduce((a: number, s: any) => a + (s.kbps_send || 0), 0) ?? 0

  return (
    <Layout>
      <div style={{ padding: '28px 32px', animation: 'fadein 0.25s ease', minHeight: '100vh' }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 20, letterSpacing: '-0.02em' }}>Dashboard</h1>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><Spinner size={32}/></div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Top stat bars */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0, border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', overflow: 'hidden' }}>
              {[
                { icon: '📡', label: 'Channels Online', value: onlineChannels, color: '#22c55e', sub: `${offlineChannels} offline` },
                { icon: '⚠️', label: 'Channels Offline', value: offlineChannels, color: offlineChannels > 0 ? '#ff4d4d' : 'var(--text-3)', sub: `${channels.length} total` },
                { icon: '👥', label: 'Active Viewers', value: totalViewers, color: '#3b9eff', sub: `${fmtKbps(totalKbps)} out` },
              ].map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 18, padding: '20px 24px',
                  borderRight: i < 2 ? '1px solid var(--border)' : 'none', background: 'var(--bg-card)' }}>
                  <div style={{ width: 52, height: 52, borderRadius: 12, background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
                    {s.icon}
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 2 }}>{s.label}</div>
                    <div style={{ fontSize: 28, fontWeight: 800, color: s.color, lineHeight: 1, fontFamily: 'var(--mono)' }}>{s.value}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 3 }}>{s.sub}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Main grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20 }}>

              {/* Left column */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

                {/* Connections + Rate chart */}
                <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '20px 22px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>Connections</div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                        {totalViewers} viewers @ {fmtMbps((netRate.rx + netRate.tx))}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 16, fontSize: 11, color: 'var(--text-3)' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ width: 10, height: 3, background: '#3b9eff', borderRadius: 99, display: 'inline-block' }}/>Connections
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ width: 10, height: 3, background: '#22c55e', borderRadius: 99, display: 'inline-block' }}/>Data Rate
                      </span>
                    </div>
                  </div>
                  <div style={{ position: 'relative', height: 100 }}>
                    <div style={{ position: 'absolute', inset: 0 }}>
                      <SparkChart data={rateHistory} color="#22c55e" height={100}/>
                    </div>
                    <div style={{ position: 'absolute', inset: 0, opacity: 0.7 }}>
                      <SparkChart data={connHistory} color="#3b9eff" height={100}/>
                    </div>
                  </div>
                </div>

                {/* Top streams */}
                <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '20px 22px' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 16 }}>Active Streams</div>
                  {(!stats?.streams || stats.streams.length === 0) ? (
                    <div style={{ fontSize: 13, color: 'var(--text-3)', padding: '20px 0', textAlign: 'center' }}>No active streams</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                      {stats.streams.map((s: any, i: number) => (
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
                          <div style={{ fontSize: 12, fontFamily: 'var(--mono)', color: '#3b9eff', flexShrink: 0 }}>›</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* System resources */}
                {stats && (
                  <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '20px 22px' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 16 }}>System Resources</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                      {[
                        { label: 'CPU', value: stats.cpu.percent, sub: `${stats.cpu.count} cores · ${stats.cpu.freq_mhz ? (stats.cpu.freq_mhz/1000).toFixed(1)+'GHz' : ''}` },
                        { label: 'Memory', value: stats.memory.percent, sub: `${fmt(stats.memory.used)} / ${fmt(stats.memory.total)}` },
                        { label: 'Network ↓', value: Math.min(100,(netRate.rx/(100*1024*1024))*100), sub: fmt(netRate.rx)+'/s', color: '#22c55e' },
                        { label: 'Network ↑', value: Math.min(100,(netRate.tx/(100*1024*1024))*100), sub: fmt(netRate.tx)+'/s', color: '#f59e0b' },
                      ].map(r => (
                        <div key={r.label}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 2 }}>
                            <span style={{ color: 'var(--text-2)' }}>{r.label}</span>
                            <span style={{ fontFamily: 'var(--mono)', color: r.color ?? statColor(r.value) }}>{r.value.toFixed(0)}%</span>
                          </div>
                          <BarMeter percent={r.value} color={r.color ?? statColor(r.value)}/>
                          <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>{r.sub}</div>
                        </div>
                      ))}
                    </div>
                    {/* Disks */}
                    <div style={{ marginTop: 20 }}>
                      {stats.disks.slice(0,3).map((d: any) => (
                        <div key={d.mountpoint} style={{ marginBottom: 12 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 2 }}>
                            <span style={{ fontFamily: 'var(--mono)', color: 'var(--text-2)' }}>{d.mountpoint}</span>
                            <span style={{ color: statColor(d.percent) }}>{fmt(d.used)} / {fmt(d.total)} · {d.percent.toFixed(0)}%</span>
                          </div>
                          <BarMeter percent={d.percent} color={statColor(d.percent)}/>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Right column */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

                {/* Channels list */}
                <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '20px 22px' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 16 }}>Channels</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {channels.map((ch: any) => (
                      <Link key={ch.id} to={`/channels/${ch.id}`} style={{ textDecoration: 'none' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 'var(--r)', background: 'rgba(255,255,255,0.03)', border: '1px solid transparent', transition: 'border-color 0.15s' }}
                          onMouseEnter={(e: any) => e.currentTarget.style.borderColor = 'var(--amber)'}
                          onMouseLeave={(e: any) => e.currentTarget.style.borderColor = 'transparent'}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: ch.state?.includes('RUNNING') ? '#22c55e' : 'var(--text-3)', flexShrink: 0 }}/>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ch.name}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase' }}>{ch.channel_type}</div>
                          </div>
                          <div style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 4,
                            background: ch.state?.includes('RUNNING') ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.05)',
                            color: ch.state?.includes('RUNNING') ? '#22c55e' : 'var(--text-3)' }}>
                            {ch.state?.includes('RUNNING') ? 'ONLINE' : 'OFFLINE'}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>

                {/* Quick links */}
                <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '20px 22px' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>Quick Access</div>
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
