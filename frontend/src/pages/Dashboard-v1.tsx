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

function DonutChart({ percent, color, size = 100 }: { percent: number, color: string, size?: number }) {
  const r = (size / 2) - 12
  const circ = 2 * Math.PI * r
  const offset = circ - (percent / 100) * circ
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={10}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={10}
        strokeDasharray={circ} strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 0.7s ease' }} strokeLinecap="round"/>
      <text x={size/2} y={size/2} textAnchor="middle" dominantBaseline="middle"
        style={{ transform: `rotate(90deg) translate(0px, -${size}px)`, fill: 'var(--text)', fontSize: 15, fontWeight: 700, fontFamily: 'var(--mono)' }}>
        {percent.toFixed(0)}%
      </text>
    </svg>
  )
}

function BarMeter({ percent, color }: { percent: number, color: string }) {
  return (
    <div style={{ height: 5, background: 'rgba(255,255,255,0.06)', borderRadius: 99, overflow: 'hidden', marginTop: 5 }}>
      <div style={{ height: '100%', width: `${Math.min(100, percent)}%`, background: color, borderRadius: 99, transition: 'width 0.7s ease' }}/>
    </div>
  )
}

function Card({ title, children }: { title: string, children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '20px 22px' }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16 }}>{title}</div>
      {children}
    </div>
  )
}

function statColor(pct: number) {
  return pct > 80 ? '#ff4d4d' : pct > 60 ? 'var(--amber)' : '#3b9eff'
}

export default function Dashboard() {
  const [channels, setChannels] = useState<any[]>([])
  const [stats, setStats] = useState<any>(null)
  const [netRate, setNetRate] = useState({ rx: 0, tx: 0 })
  const [loading, setLoading] = useState(true)
  const prevNet = useRef<any>(null)

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
          setNetRate({
            rx: Math.max(0, (st.data.network.bytes_recv - prevNet.current.bytes_recv) / dt),
            tx: Math.max(0, (st.data.network.bytes_sent - prevNet.current.bytes_sent) / dt),
          })
        }
        prevNet.current = st.data.network
        setStats(st.data)
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

  return (
    <Layout>
      <div style={{ padding: '32px 36px', animation: 'fadein 0.25s ease' }}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 4, letterSpacing: '-0.02em' }}>Dashboard</h1>
          <p style={{ fontSize: 13, color: 'var(--text-2)' }}>{channels.length} channel{channels.length !== 1 ? 's' : ''}</p>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><Spinner size={32}/></div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

            {/* Channels */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
              {channels.map((ch: any) => (
                <Link key={ch.id} to={`/channels/${ch.id}`} style={{ textDecoration: 'none' }}>
                  <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '18px 22px', transition: 'border-color 0.15s, transform 0.15s' }}
                    onMouseEnter={(e: any) => { e.currentTarget.style.borderColor = 'var(--amber)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
                    onMouseLeave={(e: any) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'none' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>{ch.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{ch.channel_type}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 4,
                        background: ch.state?.includes('RUNNING') ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.05)',
                        color: ch.state?.includes('RUNNING') ? '#22c55e' : 'var(--text-3)' }}>
                        {ch.state?.includes('RUNNING') && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }}/>}
                        {ch.state?.replace(/_/g, ' ')}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {/* System Stats */}
            {stats && (
              <>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>System</div>

                {/* CPU / Memory / Network */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
                  <Card title="CPU">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <DonutChart percent={stats.cpu.percent} color={statColor(stats.cpu.percent)}/>
                      <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.8 }}>
                        <div>{stats.cpu.count} cores</div>
                        {stats.cpu.freq_mhz && <div>{(stats.cpu.freq_mhz / 1000).toFixed(1)} GHz</div>}
                      </div>
                    </div>
                  </Card>

                  <Card title="Memory">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <DonutChart percent={stats.memory.percent} color={statColor(stats.memory.percent)}/>
                      <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.8 }}>
                        <div>{fmt(stats.memory.used)} used</div>
                        <div>{fmt(stats.memory.total)} total</div>
                      </div>
                    </div>
                  </Card>

                  <Card title="Network I/O">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                          <span style={{ color: 'var(--text-3)' }}>↓ Receiving</span>
                          <span style={{ fontFamily: 'var(--mono)', color: '#22c55e', fontWeight: 600 }}>{fmt(netRate.rx)}/s</span>
                        </div>
                        <BarMeter percent={(netRate.rx / (100 * 1024 * 1024)) * 100} color="#22c55e"/>
                      </div>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                          <span style={{ color: 'var(--text-3)' }}>↑ Sending</span>
                          <span style={{ fontFamily: 'var(--mono)', color: 'var(--amber)', fontWeight: 600 }}>{fmt(netRate.tx)}/s</span>
                        </div>
                        <BarMeter percent={(netRate.tx / (100 * 1024 * 1024)) * 100} color="var(--amber)"/>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
                        Total ↓{fmt(stats.network.bytes_recv)} ↑{fmt(stats.network.bytes_sent)}
                      </div>
                    </div>
                  </Card>
                </div>

                {/* Disks */}
                <Card title={`Disk Usage`}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
                    {stats.disks.map((d: any) => (
                      <div key={d.mountpoint}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 2 }}>
                          <span style={{ fontFamily: 'var(--mono)', color: 'var(--text-2)' }}>{d.mountpoint}</span>
                          <span style={{ color: statColor(d.percent) }}>{fmt(d.used)} / {fmt(d.total)} · {d.percent.toFixed(0)}%</span>
                        </div>
                        <BarMeter percent={d.percent} color={statColor(d.percent)}/>
                      </div>
                    ))}
                  </div>
                </Card>

                {/* Active Streams */}
                {stats.streams.length > 0 && (
                  <Card title={`Live Streams (${stats.streams.length})`}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
                      {stats.streams.map((s: any) => (
                        <div key={s.name} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '12px 14px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <span style={{ fontSize: 12, fontFamily: 'var(--mono)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>{s.name}</span>
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.publish ? '#22c55e' : 'var(--text-3)', flexShrink: 0 }}/>
                          </div>
                          <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--text-2)', flexWrap: 'wrap' }}>
                            <span>👥 {s.clients}</span>
                            <span>↓ {s.kbps_recv} kbps</span>
                            <span>↑ {s.kbps_send} kbps</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </Layout>
  )
}
