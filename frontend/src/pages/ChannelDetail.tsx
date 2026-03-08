import { useEffect, useState, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../api/client'
import { Layout } from '../components/Layout'
import { Btn, StateTag, TypeTag, CopyField, Toast, Spinner } from '../components/UI'
import Hls from 'hls.js'

const PLATFORM_ICONS: Record<string, string> = {
  youtube: '▶', twitch: '🟣', facebook: '📘', tiktok: '🎵', kick: '🟢', custom: '⚙'
}
const PLATFORM_COLORS: Record<string, string> = {
  youtube: '#ef4444', twitch: '#9333ea', facebook: '#3b82f6', tiktok: '#ec4899', kick: '#22c55e', custom: '#6b7280'
}

function StreamTargets({ channelId }: { channelId: string }) {
  const [targets, setTargets] = useState<any[]>([])
  const [platforms, setPlatforms] = useState<any[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ platform: 'youtube', name: '', stream_key: '', rtmp_url: '' })
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{msg:string,type:string}|null>(null)

  const showToast = (msg: string, type = 'success') => { setToast({msg,type}); setTimeout(()=>setToast(null),3000) }

  const load = () => {
    api.get(`/targets/channel/${channelId}`).then(r => setTargets(r.data)).catch(() => {})
    api.get('/targets/platforms').then(r => setPlatforms(r.data)).catch(() => {})
  }
  useEffect(() => { load() }, [channelId])

  const addTarget = async () => {
    if (!form.name || !form.stream_key) return showToast('Name and stream key required', 'error')
    setSaving(true)
    try {
      await api.post(`/targets/channel/${channelId}`, form)
      setShowAdd(false)
      setForm({ platform: 'youtube', name: '', stream_key: '', rtmp_url: '' })
      load()
      showToast('Stream target added')
    } catch (e: any) { showToast(e.response?.data?.detail ?? 'Failed', 'error') }
    finally { setSaving(false) }
  }

  const toggle = async (t: any) => {
    try {
      await api.patch(`/targets/${t.id}`, { enabled: !t.enabled })
      setTargets(prev => prev.map(x => x.id === t.id ? { ...x, enabled: !x.enabled } : x))
      showToast(t.enabled ? 'Target disabled' : 'Target enabled — restream starting...')
    } catch { showToast('Failed to update', 'error') }
  }

  const remove = async (t: any) => {
    if (!confirm(`Remove ${t.name}?`)) return
    try {
      await api.delete(`/targets/${t.id}`)
      setTargets(prev => prev.filter(x => x.id !== t.id))
      showToast('Target removed')
    } catch { showToast('Failed to remove', 'error') }
  }

  const selectedPlatform = platforms.find(p => p.id === form.platform)

  return (
    <div style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:'var(--r-lg)', padding:22, marginTop:16 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
        <div style={{ fontSize:14, fontWeight:700 }}>Stream Targets</div>
        <button onClick={() => setShowAdd(!showAdd)}
          style={{ fontSize:11, padding:'5px 12px', borderRadius:6, border:'1px solid var(--border)', background: showAdd ? 'var(--amber-dim)' : 'transparent', color: showAdd ? 'var(--amber)' : 'var(--text-2)', cursor:'pointer', fontWeight:600 }}>
          {showAdd ? 'Cancel' : '+ Add Target'}
        </button>
      </div>
      <div style={{ fontSize:12, color:'var(--text-3)', marginBottom:14 }}>
        Restream to YouTube, Twitch, Facebook, TikTok, Kick, or any custom RTMP server simultaneously.
      </div>

      {showAdd && (
        <div style={{ background:'var(--bg)', border:'1px solid var(--border)', borderRadius:'var(--r)', padding:16, marginBottom:16 }}>
          <div style={{ marginBottom:12 }}>
            <label style={{ fontSize:11, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.08em', display:'block', marginBottom:6 }}>Platform</label>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              {platforms.map(p => (
                <button key={p.id} onClick={() => setForm({...form, platform: p.id, name: p.name})}
                  style={{ padding:'6px 12px', borderRadius:6, border:`1px solid ${form.platform===p.id ? PLATFORM_COLORS[p.id] : 'var(--border)'}`, background: form.platform===p.id ? `${PLATFORM_COLORS[p.id]}22` : 'transparent', color: form.platform===p.id ? PLATFORM_COLORS[p.id] : 'var(--text-2)', cursor:'pointer', fontSize:12, fontWeight:600 }}>
                  {p.icon} {p.name}
                </button>
              ))}
            </div>
          </div>
          <div style={{ marginBottom:12 }}>
            <label style={{ fontSize:11, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.08em', display:'block', marginBottom:6 }}>Label</label>
            <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g. My YouTube Channel"
              style={{ width:'100%', background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:'var(--r)', color:'var(--text)', padding:'8px 12px', fontSize:13, boxSizing:'border-box' as const }}/>
          </div>
          {form.platform === 'custom' && (
            <div style={{ marginBottom:12 }}>
              <label style={{ fontSize:11, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.08em', display:'block', marginBottom:6 }}>RTMP Server URL</label>
              <input value={form.rtmp_url} onChange={e => setForm({...form, rtmp_url: e.target.value})} placeholder="rtmp://your-server/live"
                style={{ width:'100%', background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:'var(--r)', color:'var(--text)', padding:'8px 12px', fontSize:13, boxSizing:'border-box' as const }}/>
            </div>
          )}
          <div style={{ marginBottom:14 }}>
            <label style={{ fontSize:11, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.08em', display:'block', marginBottom:6 }}>Stream Key</label>
            <input value={form.stream_key} onChange={e => setForm({...form, stream_key: e.target.value})} placeholder="Your stream key"
              type="password"
              style={{ width:'100%', background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:'var(--r)', color:'var(--text)', padding:'8px 12px', fontSize:13, boxSizing:'border-box' as const }}/>
            {selectedPlatform && <div style={{ fontSize:11, color:'var(--text-3)', marginTop:4 }}>💡 {selectedPlatform.key_help}</div>}
          </div>
          <button onClick={addTarget} disabled={saving}
            style={{ width:'100%', padding:'9px', borderRadius:'var(--r)', border:'none', background:'var(--amber)', color:'#000', fontWeight:700, fontSize:13, cursor:'pointer', opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Saving...' : 'Add Stream Target'}
          </button>
        </div>
      )}

      {targets.length === 0 && !showAdd ? (
        <div style={{ textAlign:'center', padding:'20px', border:'1px dashed var(--border)', borderRadius:'var(--r)', fontSize:12, color:'var(--text-3)' }}>
          No stream targets yet — add one to start restreaming
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {targets.map(t => (
            <div key={t.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 14px', background:'var(--bg)', border:`1px solid ${t.enabled ? `${PLATFORM_COLORS[t.platform]}44` : 'var(--border)'}`, borderRadius:'var(--r)' }}>
              <span style={{ fontSize:18, flexShrink:0 }}>{PLATFORM_ICONS[t.platform] || '📡'}</span>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, fontWeight:600 }}>{t.name}</div>
                <div style={{ fontSize:10, color:'var(--text-3)', fontFamily:'var(--mono)' }}>{t.stream_key}</div>
              </div>
              <button onClick={() => toggle(t)}
                style={{ flexShrink:0, padding:'5px 14px', borderRadius:20, cursor:'pointer', fontSize:11, fontWeight:700,
                  background: t.enabled ? '#1a3a1a' : '#2a2a2a',
                  color: t.enabled ? '#22c55e' : '#888',
                  border: `1px solid ${t.enabled ? '#22c55e' : '#444'}`,
                }}>
                {t.enabled ? '● LIVE' : 'OFF'}
              </button>
              <button onClick={() => remove(t)}
                style={{ background:'none', border:'none', color:'var(--text-3)', cursor:'pointer', fontSize:13, padding:'2px 6px', borderRadius:4 }}
                onMouseEnter={(e:any) => e.currentTarget.style.color='var(--red)'}
                onMouseLeave={(e:any) => e.currentTarget.style.color='var(--text-3)'}
              >✕</button>
            </div>
          ))}
        </div>
      )}
      {toast && <Toast message={toast.msg} type={toast.type as any}/>}
    </div>
  )
}

function HLSPlayer({ hlsUrl }: { hlsUrl: string }) {
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    if (!ref.current || !hlsUrl) return
    if (Hls.isSupported()) {
      const hls = new Hls({
        liveSyncDurationCount: 3,
        liveMaxLatencyDurationCount: 10,
        liveDurationInfinity: true,
        levelLoadingMaxRetry: 20,
        fragLoadingMaxRetry: 20,
        manifestLoadingMaxRetry: 20,
        levelLoadingRetryDelay: 500,
        fragLoadingRetryDelay: 500,
      })
      hls.loadSource(hlsUrl)
      hls.attachMedia(ref.current)
      ref.current.play().catch(() => {})
      hls.on(Hls.Events.ERROR, (_: any, data: any) => {
        if (data.fatal) {
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) hls.startLoad()
          else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError()
        }
      })
      return () => hls.destroy()
    } else if (ref.current.canPlayType('application/vnd.apple.mpegurl')) {
      ref.current.src = hlsUrl
    }
  }, [hlsUrl])
  return (
    <video ref={ref} controls autoPlay muted
      style={{ width:'100%', aspectRatio:'16/9', borderRadius:'var(--r-lg)', background:'#000', display:'block', border:'1px solid var(--border)' }}
    />
  )
}

function OfflineScreen({ channel }: { channel: any }) {
  const bg = channel?.offline_bg_color || '#0f0f0f'
  const msg = channel?.offline_message || "We'll be back soon. Stay tuned!"
  const logo = channel?.offline_logo_path
  return (
    <div style={{ aspectRatio:'16/9', background:bg, borderRadius:'var(--r-lg)', border:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:16, padding:32 }}>
      {logo ? (
        <img src={logo} alt="logo" style={{ maxHeight:80, maxWidth:200, objectFit:'contain', opacity:0.85 }} />
      ) : (
        <div style={{ fontSize:36, opacity:0.15 }}>◉</div>
      )}
      <div style={{ textAlign:'center' }}>
        <div style={{ fontFamily:'var(--mono)', fontSize:10, color:'var(--text-3)', letterSpacing:'0.15em', textTransform:'uppercase', marginBottom:8 }}>Offline</div>
        <div style={{ fontSize:14, color:'var(--text-2)', maxWidth:300, lineHeight:1.5 }}>{msg}</div>
      </div>
    </div>
  )
}

function VideoPlayer({ state, hlsUrl, channel }: any) {
  const isLive = state === 'LIVE_ONLY' || state === 'TV_LIVE_RUNNING'
  const isVod  = state === 'TV_VOD_RUNNING'
  if (!isLive && !isVod) return <OfflineScreen channel={channel} />
  return (
    <div style={{ position:'relative' }}>
      <HLSPlayer hlsUrl={hlsUrl}/>
      {isLive && (
        <div style={{ position:'absolute', top:12, right:12, display:'flex', alignItems:'center', gap:6, background:'rgba(0,0,0,0.7)', border:'1px solid rgba(255,77,106,0.4)', borderRadius:4, padding:'3px 9px' }}>
          <span style={{ width:6, height:6, borderRadius:'50%', background:'var(--red)', animation:'pulse 1.2s ease-in-out infinite' }}/>
          <span style={{ fontFamily:'var(--mono)', fontSize:10, fontWeight:700, color:'var(--red)', letterSpacing:'0.1em' }}>ON AIR</span>
        </div>
      )}
      <div style={{ position:'absolute', bottom:12, right:12, background:'rgba(0,0,0,0.6)', border:'1px solid var(--border)', borderRadius:3, padding:'2px 6px', fontSize:9, fontFamily:'var(--mono)', color:'var(--text-3)' }}>HLS · ~3s</div>
    </div>
  )
}

function OfflineScreenSettings({ channel, id, setChannel, showToast }: any) {
  const [msg, setMsg] = useState(channel?.offline_message || "We'll be back soon. Stay tuned!")
  const [bgColor, setBgColor] = useState(channel?.offline_bg_color || '#0f0f0f')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      await api.put(`/channels/${id}`, { offline_message: msg, offline_bg_color: bgColor })
      setChannel((c: any) => ({ ...c, offline_message: msg, offline_bg_color: bgColor }))
      showToast('Offline screen saved')
    } catch { showToast('Failed to save', 'error') }
    finally { setSaving(false) }
  }

  const uploadLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const r = await api.post(`/channels/${id}/offline-logo`, fd, { headers:{ 'Content-Type':'multipart/form-data' } })
      setChannel((c: any) => ({ ...c, offline_logo_path: r.data.offline_logo_path }))
      showToast('Logo uploaded')
    } catch { showToast('Upload failed', 'error') }
    finally { setUploading(false) }
  }

  const removeLogo = async () => {
    try {
      await api.delete(`/channels/${id}/offline-logo`)
      setChannel((c: any) => ({ ...c, offline_logo_path: null }))
      showToast('Logo removed')
    } catch { showToast('Failed to remove', 'error') }
  }

  return (
    <div style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:'var(--r-lg)', padding:22, marginTop:16 }}>
      <div style={{ fontSize:14, fontWeight:700, marginBottom:14 }}>Offline Screen</div>

      <OfflineScreen channel={{ offline_message: msg, offline_bg_color: bgColor, offline_logo_path: channel?.offline_logo_path }} />

      <div style={{ marginTop:16, display:'flex', flexDirection:'column', gap:12 }}>
        <div>
          <label style={{ fontSize:11, color:'var(--text-3)', letterSpacing:'0.08em', textTransform:'uppercase', display:'block', marginBottom:4 }}>Message</label>
          <input value={msg} onChange={e => setMsg(e.target.value)}
            style={{ width:'100%', background:'var(--bg)', border:'1px solid var(--border)', borderRadius:'var(--r)', padding:'8px 10px', color:'var(--text)', fontSize:13, boxSizing:'border-box' as const }} />
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <label style={{ fontSize:11, color:'var(--text-3)', letterSpacing:'0.08em', textTransform:'uppercase' }}>Background</label>
          <input type="color" value={bgColor} onChange={e => setBgColor(e.target.value)}
            style={{ width:40, height:30, border:'1px solid var(--border)', borderRadius:4, background:'none', cursor:'pointer', padding:2 }} />
          <span style={{ fontSize:12, color:'var(--text-3)', fontFamily:'var(--mono)' }}>{bgColor}</span>
        </div>

        <div>
          <label style={{ fontSize:11, color:'var(--text-3)', letterSpacing:'0.08em', textTransform:'uppercase', display:'block', marginBottom:6 }}>Logo</label>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <label style={{ background:'var(--bg)', border:'1px solid var(--border)', borderRadius:'var(--r)', padding:'6px 14px', fontSize:12, cursor:'pointer', color:'var(--text-2)' }}>
              {uploading ? 'Uploading…' : 'Upload Logo'}
              <input type="file" accept="image/*" onChange={uploadLogo} style={{ display:'none' }} />
            </label>
            {channel?.offline_logo_path && (
              <button onClick={removeLogo}
                style={{ background:'transparent', border:'1px solid var(--border)', borderRadius:'var(--r)', padding:'6px 14px', fontSize:12, cursor:'pointer', color:'var(--text-3)' }}>
                Remove
              </button>
            )}
          </div>
        </div>

        <div style={{ display:'flex', justifyContent:'flex-end', marginTop:4 }}>
          <button onClick={save} disabled={saving}
            style={{ background:'var(--amber)', color:'#000', border:'none', borderRadius:'var(--r)', padding:'8px 20px', fontSize:13, fontWeight:700, cursor:'pointer', opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ChannelDetail() {
  const { id } = useParams<{ id: string }>()
  const [channel, setChannel] = useState<any>(null)
  const [playback, setPlayback] = useState<any>(null)
  const [status, setStatus] = useState<any>(null)
  const [ingest, setIngest] = useState<any>(null)
  const [tab, setTab] = useState<'preview'|'ingest'|'settings'>('preview')
  const [toast, setToast] = useState<{msg:string;type:string}|null>(null)
  const logoRef = useRef<HTMLInputElement>(null)

  const showToast = (msg: string, type = 'success') => { setToast({msg,type}); setTimeout(()=>setToast(null),3000) }

  useEffect(() => {
    api.get(`/channels/${id}`).then(r => setChannel(r.data))
    api.get(`/channels/${id}/playback`).then(r => setPlayback(r.data))
    api.get(`/channels/${id}/ingest`).then(r => setIngest(r.data))
    const iv = setInterval(() => api.get(`/channels/${id}/status`).then(r => setStatus(r.data)), 3000)
    return () => clearInterval(iv)
  }, [id])

  const action = async (endpoint: string, label: string) => {
    try { await api.post(`/channels/${id}/${endpoint}`); showToast(`✓ ${label}`) }
    catch (e: any) { showToast(e.response?.data?.detail ?? 'Error', 'error') }
  }

  const uploadLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    const fd = new FormData(); fd.append('file', file)
    try { await api.post(`/channels/${id}/logo`, fd, { headers:{ 'Content-Type':'multipart/form-data' } }); showToast('✓ Logo uploaded') }
    catch (e: any) { showToast(e.response?.data?.detail ?? 'Upload failed', 'error') }
  }

  if (!channel) return <Layout><div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh' }}><Spinner size={32}/></div></Layout>

  const isTV = channel.channel_type === 'tv'
  const currentState = status?.state ?? channel.state

  return (
    <Layout>
      <div style={{ padding:'32px 36px', animation:'fadein 0.25s ease' }}>

        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:24, fontSize:13 }}>
          <Link to="/" style={{ color:'var(--text-2)', textDecoration:'none' }}>Channels</Link>
          <span style={{ color:'var(--text-3)' }}>›</span>
          <span>{channel.name}</span>
        </div>

        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:24, flexWrap:'wrap', gap:12 }}>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
              <h1 style={{ fontSize:22, fontWeight:800, letterSpacing:'-0.02em' }}>{channel.name}</h1>
              <TypeTag type={channel.channel_type}/>
            </div>
            <StateTag state={currentState}/>
          </div>
          {isTV && (
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              <Btn variant="green" size="sm" icon="▶" onClick={() => action('playout/start','Playout started')}>Start Playout</Btn>
              <Btn variant="outline" size="sm" icon="⏹" onClick={() => action('playout/stop','Playout stopped')}>Stop</Btn>
              {false && <Btn variant="danger" size="sm" icon="●" onClick={() => action('take-live','Take Live requested')}>Take Live</Btn>}
              {false && <Btn variant="blue" size="sm" icon="⏎" onClick={() => action('return-to-vod','Returning to VOD')}>Return to VOD</Btn>}
            </div>
          )}
        </div>

        <div style={{ display:'flex', gap:1, marginBottom:24, background:'var(--border)', borderRadius:'var(--r-lg)', padding:3, width:'fit-content' }}>
          {(['preview','ingest','settings'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ padding:'6px 18px', borderRadius:'var(--r)', border:'none', cursor:'pointer', fontSize:13, fontWeight:tab===t?600:400, textTransform:'capitalize', background:tab===t?'var(--bg-raised)':'transparent', color:tab===t?'var(--text)':'var(--text-2)', transition:'all 0.12s', fontFamily:'var(--sans)' }}>{t}</button>
          ))}
        </div>

        {tab === 'preview' && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 260px', gap:16, alignItems:'start' }}>
            <VideoPlayer state={currentState} hlsUrl={playback?.hls_url} channel={playback}/>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              <div style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:'var(--r-lg)', padding:16 }}>
                <div style={{ fontSize:11, fontWeight:600, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:14 }}>Stream Info</div>
                {[
                  { l:'Type',     v: channel.channel_type.toUpperCase() },
                  { l:'State',    v: currentState },
                  { l:'Timezone', v: channel.timezone },
                  ...(isTV?[{ l:'Return', v:channel.return_strategy },{ l:'Timeout', v:`${channel.live_timeout_seconds}s` }]:[]),
                ].map(r => (
                  <div key={r.l} style={{ display:'flex', justifyContent:'space-between', padding:'7px 0', borderBottom:'1px solid var(--border)' }}>
                    <span style={{ fontSize:12, color:'var(--text-2)' }}>{r.l}</span>
                    <span style={{ fontSize:12, fontFamily:'var(--mono)', color:'var(--text)' }}>{r.v}</span>
                  </div>
                ))}
              </div>

            </div>
          </div>
        )}

        {tab === 'ingest' && ingest && playback && (
          <div style={{ maxWidth:580, display:'flex', flexDirection:'column', gap:14 }}>
            <div style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:'var(--r-lg)', padding:22 }}>
              <div style={{ fontSize:14, fontWeight:700, marginBottom:18 }}>OBS / Encoder Setup</div>
              <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                <CopyField label="RTMP Server" value={ingest.rtmp_url}/>
                <CopyField label="Stream Key" value={ingest.stream_key} secret/>
              </div>
            </div>
            <div style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:'var(--r-lg)', padding:22 }}>
              <div style={{ fontSize:14, fontWeight:700, marginBottom:18 }}>Playback URLs</div>
              <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                <CopyField label="HLS" value={playback.hls_url}/>
              </div>
            </div>
            {isTV && (
              <div style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:'var(--r-lg)', padding:22 }}>
                <div style={{ fontSize:14, fontWeight:700, marginBottom:12 }}>Channel Logo</div>
                <p style={{ fontSize:13, color:'var(--text-2)', marginBottom:16 }}>PNG overlay on playout stream. Recommended: 200×60px transparent PNG.</p>
                <input ref={logoRef} type="file" accept=".png,.jpg,.jpeg" style={{ display:'none' }} onChange={uploadLogo}/>
                <Btn variant="outline" icon="↑" onClick={() => logoRef.current?.click()}>Upload Logo</Btn>
              </div>
            )}
            <StreamTargets channelId={id!}/>
          </div>
        )}

        {tab === 'settings' && (
          <div style={{ maxWidth:520 }}>
            <div style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:'var(--r-lg)', padding:22 }}>
              <div style={{ fontSize:14, fontWeight:700, marginBottom:18 }}>TV Channel Settings</div>

              <div style={{ marginBottom:16 }}>
                <label style={{ fontSize:11, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.08em', display:'block', marginBottom:6 }}>Timezone</label>
                <select defaultValue={channel.timezone || 'UTC'} id="tz-select"
                  style={{ width:'100%', background:'var(--bg)', border:'1px solid var(--border)', borderRadius:'var(--r)', color:'var(--text)', padding:'9px 12px', fontSize:13 }}>
                  {['UTC','America/New_York','America/Chicago','America/Denver','America/Los_Angeles','America/Toronto','America/Vancouver','America/Phoenix','America/Halifax','America/Jamaica','America/Barbados','America/Trinidad','America/Guyana','Europe/London','Europe/Paris','Europe/Berlin','Europe/Rome','Europe/Madrid','Asia/Dubai','Asia/Kolkata','Asia/Singapore','Asia/Tokyo','Asia/Shanghai','Pacific/Auckland','Pacific/Sydney','Africa/Lagos','Africa/Nairobi'].map(tz => <option key={tz} value={tz}>{tz}</option>)}
                </select>
                <div style={{ fontSize:11, color:'var(--text-3)', marginTop:5 }}>Schedule block times are interpreted in this timezone.</div>
              </div>

              <div style={{ marginBottom:16 }}>
                <label style={{ fontSize:11, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.08em', display:'block', marginBottom:6 }}>Return Strategy (after live)</label>
                <select defaultValue={channel.return_strategy || 'as_clock'} id="rs-select"
                  style={{ width:'100%', background:'var(--bg)', border:'1px solid var(--border)', borderRadius:'var(--r)', color:'var(--text)', padding:'9px 12px', fontSize:13 }}>
                  <option value="as_clock">As Clock — resume at current schedule time</option>
                  <option value="resume_paused">Resume Paused — continue from where it stopped</option>
                </select>
              </div>

              <div style={{ marginBottom:16 }}>
                <label style={{ fontSize:11, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.08em', display:'block', marginBottom:6 }}>Live Timeout (seconds)</label>
                <input id="lt-input" type="number" defaultValue={channel.live_timeout_seconds || 10}
                  style={{ width:'100%', background:'var(--bg)', border:'1px solid var(--border)', borderRadius:'var(--r)', color:'var(--text)', padding:'9px 12px', fontSize:13, boxSizing:'border-box' as const }} />
                <div style={{ fontSize:11, color:'var(--text-3)', marginTop:5 }}>How long to wait after live encoder disconnects before returning to VOD.</div>
              </div>

              <button
                onClick={async () => {
                  const tz = (document.getElementById('tz-select') as HTMLSelectElement).value
                  const rs = (document.getElementById('rs-select') as HTMLSelectElement).value
                  const lt = parseInt((document.getElementById('lt-input') as HTMLInputElement).value)
                  try {
                    await api.patch(`/channels/${id}`, { timezone: tz, return_strategy: rs, live_timeout_seconds: lt })
                    setChannel({ ...channel, timezone: tz, return_strategy: rs, live_timeout_seconds: lt })
                    showToast('Settings saved')
                  } catch { showToast('Failed to save settings', 'error') }
                }}
                style={{ width:'100%', padding:'10px', borderRadius:'var(--r)', border:'none', background:'var(--amber)', color:'#000', fontWeight:700, fontSize:13, cursor:'pointer', marginTop:4 }}>
                Save Settings
              </button>
            </div>

            <OfflineScreenSettings channel={channel} id={id} setChannel={setChannel} showToast={showToast} />
          </div>
        )}

      </div>
      {toast && <Toast message={toast.msg} type={toast.type as any}/>}
    </Layout>
  )
}
