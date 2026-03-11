import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../api/client'
import { Layout } from '../components/Layout'
import { Btn, Input, Select, Modal, Toast, Spinner } from '../components/UI'

function formatDur(secs: number) {
  if (!secs) return 'auto'
  const m = Math.floor(secs / 60), s = Math.floor(secs % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}


function to24h(h: string, m: string, s: string, ampm: string): string {
  let hour = parseInt(h)
  if (ampm === 'PM' && hour !== 12) hour += 12
  if (ampm === 'AM' && hour === 12) hour = 0
  return `${String(hour).padStart(2,'0')}:${m.padStart(2,'0')}:${s.padStart(2,'00')}`
}

function from24h(time: string): { h: string, m: string, s: string, ampm: string } {
  const parts = (time || '00:00:00').split(':')
  let hour = parseInt(parts[0]) || 0
  const ampm = hour >= 12 ? 'PM' : 'AM'
  if (hour > 12) hour -= 12
  if (hour === 0) hour = 12
  return { h: String(hour), m: parts[1] || '00', s: parts[2] || '00', ampm }
}

function clamp(v: number, min: number, max: number) { return Math.max(min, Math.min(max, v)) }

function TimeInput({ value, onChange }: { value: string, onChange: (v: string) => void }) {
  const parsed = value ? from24h(value) : { h: '12', m: '00', s: '00', ampm: 'AM' }
  const [h, setH] = React.useState(parsed.h)
  const [m, setM] = React.useState(parsed.m)
  const [s, setS] = React.useState(parsed.s)
  const [ampm, setAmpm] = React.useState(parsed.ampm)

  React.useEffect(() => {
    if (value) { const p = from24h(value); setH(p.h); setM(p.m); setS(p.s); setAmpm(p.ampm) }
  }, [value])

  const update = (nh: string, nm: string, ns: string, na: string) => {
    setH(nh); setM(nm); setS(ns); setAmpm(na)
    onChange(to24h(nh, nm, ns, na))
  }

  const segStyle: any = {
    background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6,
    color: 'var(--text)', fontFamily: 'var(--mono)', fontSize: 18, fontWeight: 700,
    textAlign: 'center', outline: 'none', padding: '8px 0', width: 52,
    MozAppearance: 'textfield',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Start Time</label>
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <input type="number" min={1} max={12} value={h} style={segStyle}
          onChange={(e:any) => update(e.target.value, m, s, ampm)}
          onBlur={(e:any) => { const v = clamp(parseInt(e.target.value)||1,1,12); update(String(v),m,s,ampm) }}
        />
        <span style={{ color:'var(--text-3)', fontWeight:700, fontSize:20 }}>:</span>
        <input type="number" min={0} max={59} value={m} style={segStyle}
          onChange={(e:any) => update(h, e.target.value, s, ampm)}
          onBlur={(e:any) => { const v = clamp(parseInt(e.target.value)||0,0,59); update(h,String(v).padStart(2,'0'),s,ampm) }}
        />
        <span style={{ color:'var(--text-3)', fontWeight:700, fontSize:20 }}>:</span>
        <input type="number" min={0} max={59} value={s} style={segStyle}
          onChange={(e:any) => update(h, m, e.target.value, ampm)}
          onBlur={(e:any) => { const v = clamp(parseInt(e.target.value)||0,0,59); update(h,m,String(v).padStart(2,'0'),ampm) }}
        />
        <div style={{ display:'flex', gap:2, background:'var(--border)', borderRadius:8, padding:3, marginLeft:4 }}>
          {['AM','PM'].map(a => (
            <button key={a} type="button" onClick={() => update(h,m,s,a)}
              style={{ padding:'6px 12px', borderRadius:6, border:'none', cursor:'pointer', fontSize:13, fontWeight:ampm===a?700:400, background:ampm===a?'var(--amber)':'transparent', color:ampm===a?'#000':'var(--text-2)', fontFamily:'var(--sans)', transition:'all 0.12s' }}
            >{a}</button>
          ))}
        </div>
      </div>
    </div>
  )
}

const DAY_LABELS = ['M','T','W','T','F','S','S']
const DAY_FULL = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']

function DayPicker({ value, onChange }: { value: number, onChange: (v: number) => void }) {
  const toggle = (i: number) => onChange(value ^ (1 << i))
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
      <label style={{ fontSize:11, fontWeight:600, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.08em' }}>Days</label>
      <div style={{ display:'flex', gap:5 }}>
        {DAY_LABELS.map((d, i) => {
          const active = !!(value & (1 << i))
          return (
            <button key={i} type="button" onClick={() => toggle(i)} title={DAY_FULL[i]}
              style={{ width:36, height:36, borderRadius:'50%', border:`2px solid ${active?'var(--amber)':'var(--border)'}`, background:active?'var(--amber-dim)':'var(--bg)', color:active?'var(--amber)':'var(--text-3)', fontWeight:active?700:400, fontSize:12, cursor:'pointer', fontFamily:'var(--sans)', transition:'all 0.12s' }}
            >{d}</button>
          )
        })}
        <button type="button" onClick={() => onChange(value === 127 ? 0 : 127)}
          style={{ padding:'0 10px', borderRadius:18, border:`2px solid ${value===127?'var(--amber)':'var(--border)'}`, background:value===127?'var(--amber-dim)':'var(--bg)', color:value===127?'var(--amber)':'var(--text-3)', fontSize:11, fontWeight:value===127?700:400, cursor:'pointer', transition:'all 0.12s' }}
        >All</button>
      </div>
    </div>
  )
}

export default function Schedule() {
  const { id: channelId } = useParams<{ id: string }>()
  const [blocks, setBlocks] = useState<any[]>([])
  const [assets, setAssets] = useState<any[]>([])
  const [playlists, setPlaylists] = useState<any[]>([])
  const [nowPlaying, setNowPlaying] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [blockType, setBlockType] = useState<'asset' | 'playlist' | 'rtmp' | 'hls'>('asset')
  const [sourceUrl, setSourceUrl] = useState('')
  const [form, setForm] = useState({ start_time: '', asset_id: '', playlist_id: '', day_mask: 127, duration_secs: '3600' })
  const [editBlock, setEditBlock] = useState<any>(null)
  const [editForm, setEditForm] = useState({ start_time: '', day_mask: 127, source_url: '' })
  const [toast, setToast] = useState<any>(null)
  const GENRES = ['R&B','Dancehall','Soul','Rock','Pop','Reggae','Hip-Hop','Ads']
  const [playlistGenreFilter, setPlaylistGenreFilter] = useState<string | null>(null)
  const [channelTz, setChannelTz] = useState<string>('UTC')

  const showToast = (msg: string, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000) }

  const load = async () => {
    try {
      const [b, a, p, n, ch] = await Promise.all([
        api.get(`/schedule/channel/${channelId}`),
        api.get('/assets'),
        api.get('/playlists'),
        api.get(`/schedule/channel/${channelId}/now`).catch(() => ({ data: null })),
        api.get(`/channels/${channelId}`).catch(() => ({ data: null })),
      ])
      setBlocks(b.data); setAssets(a.data); setPlaylists(p.data); setNowPlaying(n.data)
      if (ch.data?.timezone) setChannelTz(ch.data.timezone)
    } finally { setLoading(false) }
  }
  useEffect(() => { load(); const iv = setInterval(load, 5000); return () => clearInterval(iv) }, [])

  const addBlock = async (e: React.FormEvent) => {
    e.preventDefault()
    const payload: any = { channel_id: channelId, start_time: form.start_time, day_mask: form.day_mask, block_type: blockType }
    if (blockType === 'asset') payload.asset_id = form.asset_id
    if (blockType === 'playlist') payload.playlist_id = form.playlist_id
    if (blockType === 'rtmp' || blockType === 'hls') { payload.source_url = sourceUrl; payload.duration_secs = parseFloat(form.duration_secs) || 3600 }
    try {
      await api.post(`/schedule/channel/${channelId}`, payload)
      setShowAdd(false); setSourceUrl(''); showToast('Block added'); load()
    } catch (e: any) { showToast(e.response?.data?.detail ?? 'Error', 'error') }
  }

  const delBlock = async (blockId: string) => {
    try { await api.delete(`/schedule/block/${blockId}`); showToast('Block deleted'); load() }
    catch { showToast('Delete failed', 'error') }
  }

  const duplicateBlock = async (b: any) => {
    // Increment start time by block duration or 1 minute
    const [h, m, s] = b.start_time.split(':').map(Number)
    const totalSecs = h * 3600 + m * 60 + s + Math.floor(b.duration_secs || 60)
    const nh = Math.floor(totalSecs / 3600) % 24
    const nm = Math.floor((totalSecs % 3600) / 60)
    const ns = totalSecs % 60
    const newTime = `${String(nh).padStart(2,'0')}:${String(nm).padStart(2,'0')}:${String(ns).padStart(2,'0')}`
    const payload: any = {
      channel_id: channelId,
      block_type: b.block_type,
      start_time: newTime,
      day_mask: b.day_mask,
      duration_secs: b.duration_secs,
      notes: b.notes,
    }
    if (b.asset_id) payload.asset_id = b.asset_id
    if (b.playlist_id) payload.playlist_id = b.playlist_id
    try { await api.post(`/schedule/channel/${channelId}`, payload); showToast('✓ Duplicated'); load() }
    catch (e: any) { showToast(e.response?.data?.detail ?? 'Duplicate failed', 'error') }
  }

  const openEdit = (b: any) => {
    setEditBlock(b)
    setEditForm({ start_time: b.start_time, day_mask: b.day_mask, source_url: b.source_url || '' })
  }

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await api.put(`/schedule/block/${editBlock.id}`, {
        ...editBlock,
        channel_id: channelId,
        start_time: editForm.start_time,
        day_mask: editForm.day_mask,
      })
      setEditBlock(null); showToast('✓ Updated'); load()
    } catch (e: any) { showToast(e.response?.data?.detail ?? 'Update failed', 'error') }
  }

  const dayLabel = (mask: number) => mask === 127 ? 'All' : ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].filter((_,i) => mask & (1<<i)).join(', ')

  const blockLabel = (b: any) => {
    if (b.block_type === 'playlist') return `♫ ${b.playlist_name || b.playlist_id}`
  if (b.block_type === 'rtmp') return `📡 RTMP: ${b.source_url || ''}` 
  if (b.block_type === 'hls') return `▶ HLS: ${b.source_url || ''}`
    return b.asset_name || b.asset_id
  }

  const isActive = (b: any) => nowPlaying?.block_id === b.id

  return (
    <Layout>
      <div style={{ padding:'32px 36px', animation:'fadein 0.25s ease' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:24, fontSize:13 }}>
          <Link to={`/channels/${channelId}`} style={{ color:'var(--text-2)', textDecoration:'none' }}>Channel</Link>
          <span style={{ color:'var(--text-3)' }}>›</span>
          <span>Schedule</span>
        </div>

        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:28 }}>
          <div>
            <h1 style={{ fontSize:26, fontWeight:800, marginBottom:6, letterSpacing:'-0.02em' }}>Schedule</h1>
            <p style={{ fontSize:13, color:'var(--text-2)' }}>{blocks.length} block{blocks.length!==1?'s':''} · <span style={{ color:'var(--amber)', fontFamily:'var(--mono)', fontSize:12 }}>{channelTz}</span></p>
          </div>
          <Btn icon="+" onClick={() => setShowAdd(true)}>Add Block</Btn>
        </div>

        {nowPlaying?.block_id && (
          <div style={{ background:'var(--green-dim)', border:'1px solid rgba(46,204,143,0.25)', borderRadius:'var(--r-lg)', padding:'12px 20px', marginBottom:20, display:'flex', alignItems:'center', gap:12 }}>
            <span style={{ width:8, height:8, borderRadius:'50%', background:'var(--green)', animation:'pulse 1.4s ease-in-out infinite', flexShrink:0 }}/>
            <div>
              <span style={{ fontSize:12, color:'var(--green)', fontWeight:600 }}>NOW PLAYING</span>
              <span style={{ fontSize:13, color:'var(--text)', marginLeft:12 }}>{nowPlaying.block_type==='playlist'?'♫ Playlist':nowPlaying.block_type==='rtmp'?'📡 RTMP':nowPlaying.block_type==='hls'?'▶ HLS':nowPlaying.asset_id}</span>
              <span style={{ fontSize:12, color:'var(--text-2)', marginLeft:8, fontFamily:'var(--mono)' }}>+{Math.floor(nowPlaying.offset_secs / 60)}m {Math.floor(nowPlaying.offset_secs % 60)}s</span>
            </div>
          </div>
        )}

        {loading ? (
          <div style={{ display:'flex', justifyContent:'center', padding:80 }}><Spinner size={32}/></div>
        ) : blocks.length === 0 ? (
          <div style={{ textAlign:'center', padding:'80px 20px', border:'1px dashed var(--border)', borderRadius:'var(--r-xl)' }}>
            <p style={{ color:'var(--text-2)', marginBottom:20 }}>No schedule blocks yet</p>
            <Btn onClick={() => setShowAdd(true)}>Add first block</Btn>
          </div>
        ) : (
          <div style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:'var(--r-lg)', overflow:'hidden' }}>
            <div style={{ display:'grid', gridTemplateColumns:'110px 1fr 70px 80px 110px 110px', gap:12, padding:'10px 20px', borderBottom:'1px solid var(--border)', fontSize:11, fontWeight:600, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.08em' }}>
              <span>Time</span><span>Content</span><span>Type</span><span>Duration</span><span>Days</span><span/>
            </div>
            {blocks.map((b, i) => (
              <div key={b.id} style={{ display:'grid', gridTemplateColumns:'110px 1fr 70px 80px 110px 110px', gap:12, padding:'13px 20px', borderBottom:i<blocks.length-1?'1px solid var(--border)':'none', alignItems:'center', transition:'background 0.1s', background:isActive(b)?'rgba(46,204,143,0.05)':'transparent' }}
                onMouseEnter={(e:any)=>{ if(!isActive(b)) e.currentTarget.style.background='var(--bg-raised)' }}
                onMouseLeave={(e:any)=>{ e.currentTarget.style.background=isActive(b)?'rgba(46,204,143,0.05)':'transparent' }}
              >
                <span style={{ fontFamily:'var(--mono)', fontSize:13, color:'var(--amber)', fontWeight:600 }}>{(() => { const p = from24h(b.start_time); return `${p.h}:${p.m}:${p.s} ${p.ampm}` })()}</span>
                <span style={{ fontSize:13, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{blockLabel(b)}</span>
                <span style={{ fontSize:11, fontFamily:'var(--mono)', color:b.block_type==='playlist'?'var(--amber)':'var(--text-3)', background:b.block_type==='playlist'?'var(--amber-dim)':'var(--bg-raised)', borderRadius:3, padding:'2px 5px', width:'fit-content' }}>
                  {b.block_type}
                </span>
                <span style={{ fontFamily:'var(--mono)', fontSize:12, color:'var(--text-2)' }}>
                  {formatDur(b.duration_secs)}
                  {b.duration_secs > 0 && (() => {
                    const [hh, mm, ss] = b.start_time.split(':').map(Number)
                    const startSecs = hh * 3600 + mm * 60 + (ss || 0)
                    const endSecs = startSecs + Math.floor(b.duration_secs)
                    const endH = Math.floor(endSecs / 3600) % 24
                    const endM = Math.floor((endSecs % 3600) / 60)
                    const ampm = endH >= 12 ? 'PM' : 'AM'
                    const h12 = endH % 12 || 12
                    return <span style={{ color:'var(--text-3)', marginLeft:4 }}>→ {h12}:{String(endM).padStart(2,'0')} {ampm}</span>
                  })()}
                </span>
                <span style={{ fontSize:12, color:'var(--text-2)' }}>{dayLabel(b.day_mask)}</span>
                <div style={{ display:'flex', gap:4, justifyContent:'flex-end' }}>
                  {/* Edit */}
                  <button onClick={() => openEdit(b)} title="Edit"
                    style={{ width:28, height:28, borderRadius:6, border:'1px solid var(--border)', background:'var(--bg)', cursor:'pointer', color:'var(--text-2)', fontSize:13, display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.12s' }}
                    onMouseEnter={(e:any)=>{e.currentTarget.style.borderColor='var(--amber)';e.currentTarget.style.color='var(--amber)'}}
                    onMouseLeave={(e:any)=>{e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.color='var(--text-2)'}}
                  >✎</button>
                  {/* Duplicate */}
                  <button onClick={() => duplicateBlock(b)} title="Duplicate"
                    style={{ width:28, height:28, borderRadius:6, border:'1px solid var(--border)', background:'var(--bg)', cursor:'pointer', color:'var(--text-2)', fontSize:13, display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.12s' }}
                    onMouseEnter={(e:any)=>{e.currentTarget.style.borderColor='var(--green)';e.currentTarget.style.color='var(--green)'}}
                    onMouseLeave={(e:any)=>{e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.color='var(--text-2)'}}
                  >⧉</button>
                  {/* Delete */}
                  <button onClick={() => delBlock(b.id)} title="Delete"
                    style={{ width:28, height:28, borderRadius:6, border:'1px solid var(--border)', background:'var(--bg)', cursor:'pointer', color:'var(--text-2)', fontSize:14, display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.12s' }}
                    onMouseEnter={(e:any)=>{e.currentTarget.style.borderColor='var(--red)';e.currentTarget.style.color='var(--red)'}}
                    onMouseLeave={(e:any)=>{e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.color='var(--text-2)'}}
                  >✕</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Block Modal */}
      {showAdd && (
        <Modal title="Add Schedule Block" onClose={() => setShowAdd(false)}>
          <form onSubmit={addBlock} style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div style={{ display:'flex', gap:1, background:'var(--border)', borderRadius:'var(--r)', padding:3 }}>
              {(['asset','playlist','rtmp','hls'] as const).map(t => (
                <button key={t} type="button" onClick={() => setBlockType(t)}
                  style={{ flex:1, padding:'6px 0', borderRadius:6, border:'none', cursor:'pointer', fontSize:13, fontWeight:blockType===t?600:400, background:blockType===t?'var(--bg-raised)':'transparent', color:blockType===t?'var(--text)':'var(--text-2)', fontFamily:'var(--sans)', transition:'all 0.12s' }}
                >{t==='playlist'?'♫ Playlist':t==='rtmp'?'📡 RTMP':t==='hls'?'▶ HLS':'🎬 Asset'}</button>
              ))}
            </div>
            <TimeInput value={form.start_time} onChange={(v:string)=>setForm({...form,start_time:v})}/>
            {(blockType==='rtmp' || blockType==='hls') ? (
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                <div>
                  <label style={{ fontSize:11, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.08em', display:'block', marginBottom:6 }}>
                    {blockType.toUpperCase()} URL
                  </label>
                  <input
                    value={sourceUrl}
                    onChange={(e:any) => setSourceUrl(e.target.value)}
                    placeholder={blockType === 'rtmp' ? 'rtmp://server/live/stream-key' : 'https://example.com/stream.m3u8'}
                    required
                    style={{ width:'100%', background:'var(--bg-raised)', border:'1px solid var(--border)', borderRadius:'var(--r)', padding:'9px 12px', fontSize:13, color:'var(--text)', boxSizing:'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize:11, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.08em', display:'block', marginBottom:6 }}>Duration</label>
                  <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center' }}>
                    {[['5m','300'],['15m','900'],['30m','1800'],['1hr','3600'],['2hr','7200'],['4hr','14400']].map(([label, val]) => (
                      <button key={val} type="button" onClick={() => setForm({...form, duration_secs: val})}
                        style={{ padding:'5px 12px', borderRadius:6, border:`1px solid ${form.duration_secs===val?'var(--amber)':'var(--border)'}`, background:form.duration_secs===val?'var(--amber-dim)':'transparent', color:form.duration_secs===val?'var(--amber)':'var(--text-2)', fontSize:12, cursor:'pointer', fontWeight:form.asset_id===val?700:400 }}>
                        {label}
                      </button>
                    ))}
                    <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                      <input type="number" min="1" placeholder="min" onChange={(e:any) => setForm({...form, duration_secs: String(parseInt(e.target.value||'0')*60)})}
                        style={{ width:60, background:'var(--bg-raised)', border:'1px solid var(--border)', borderRadius:6, padding:'5px 8px', fontSize:12, color:'var(--text)', textAlign:'center' }}/>
                      <span style={{ fontSize:11, color:'var(--text-3)' }}>min</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : blockType==='asset' ? (
              <Select label="Asset" value={form.asset_id} onChange={(e:any)=>setForm({...form,asset_id:e.target.value})} required>
                <option value="">Select asset…</option>
                {assets.filter(a=>a.status==='ready').map(a=><option key={a.id} value={a.id}>{a.original_name}</option>)}
              </Select>
            ) : (
              <div>
                <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginBottom:8 }}>
                  <button type="button" onClick={() => setPlaylistGenreFilter(null)}
                    style={{ padding:'2px 10px', borderRadius:20, border:`1px solid ${playlistGenreFilter===null?'var(--amber)':'var(--border)'}`, background:playlistGenreFilter===null?'var(--amber-dim)':'transparent', color:playlistGenreFilter===null?'var(--amber)':'var(--text-2)', fontSize:11, cursor:'pointer' }}>All</button>
                  {GENRES.map(g => (
                    <button type="button" key={g} onClick={() => setPlaylistGenreFilter(playlistGenreFilter===g?null:g)}
                      style={{ padding:'2px 10px', borderRadius:20, border:`1px solid ${playlistGenreFilter===g?'var(--amber)':'var(--border)'}`, background:playlistGenreFilter===g?'var(--amber-dim)':'transparent', color:playlistGenreFilter===g?'var(--amber)':'var(--text-2)', fontSize:11, cursor:'pointer' }}>{g}</button>
                  ))}
                </div>
                <Select label="Playlist" value={form.playlist_id} onChange={(e:any)=>setForm({...form,playlist_id:e.target.value})} required>
                  <option value="">Select playlist…</option>
                  {playlists.filter((p:any) => !playlistGenreFilter || (p.genres||[]).includes(playlistGenreFilter)).map((p:any)=><option key={p.id} value={p.id}>{p.name} ({p.item_count} assets)</option>)}
                </Select>
              </div>
            )}
            <DayPicker value={form.day_mask} onChange={(v:number)=>setForm({...form,day_mask:v})}/>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end', paddingTop:8 }}>
              <Btn variant="outline" type="button" onClick={() => setShowAdd(false)}>Cancel</Btn>
              <Btn type="submit">Add Block</Btn>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit Block Modal */}
      {editBlock && (
        <Modal title="Edit Schedule Block" onClose={() => setEditBlock(null)}>
          <form onSubmit={saveEdit} style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div style={{ padding:'10px 14px', background:'var(--bg)', borderRadius:'var(--r)', border:'1px solid var(--border)', fontSize:13, color:'var(--text-2)' }}>
              <span style={{ fontWeight:600, color:'var(--text)' }}>{blockLabel(editBlock)}</span>
              <span style={{ marginLeft:8, fontSize:11, fontFamily:'var(--mono)', color:'var(--text-3)' }}>{editBlock.block_type}</span>
            </div>
            <TimeInput value={editForm.start_time} onChange={(v:string)=>setEditForm({...editForm,start_time:v})}/>
            <DayPicker value={editForm.day_mask} onChange={(v:number)=>setEditForm({...editForm,day_mask:v})}/>
            {(editBlock?.block_type === 'rtmp' || editBlock?.block_type === 'hls') && (
              <div>
                <label style={{ fontSize:11, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.08em', display:'block', marginBottom:6 }}>
                  {editBlock.block_type.toUpperCase()} URL
                </label>
                <input
                  value={editForm.source_url}
                  onChange={(e:any) => setEditForm({...editForm, source_url: e.target.value})}
                  placeholder={editBlock.block_type === 'rtmp' ? 'rtmp://server/live/stream-key' : 'https://example.com/stream.m3u8'}
                  style={{ width:'100%', background:'var(--bg-raised)', border:'1px solid var(--border)', borderRadius:'var(--r)', padding:'9px 12px', fontSize:13, color:'var(--text)', boxSizing:'border-box' }}
                />
              </div>
            )}
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end', paddingTop:8 }}>
              <Btn variant="outline" type="button" onClick={() => setEditBlock(null)}>Cancel</Btn>
              <Btn type="submit">Save Changes</Btn>
            </div>
          </form>
        </Modal>
      )}

      {toast && <Toast message={toast.msg} type={toast.type}/>}
    </Layout>
  )
}
