import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../api/client'
import { Layout } from '../components/Layout'
import { Btn, Input, Select, Modal, Toast, Spinner } from '../components/UI'

function formatDur(secs: number) {
  if (!secs) return 'auto'
  const m = Math.floor(secs / 60), s = Math.floor(secs % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function Schedule() {
  const { id: channelId } = useParams<{ id: string }>()
  const [blocks, setBlocks] = useState<any[]>([])
  const [assets, setAssets] = useState<any[]>([])
  const [playlists, setPlaylists] = useState<any[]>([])
  const [nowPlaying, setNowPlaying] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [blockType, setBlockType] = useState<'asset' | 'playlist'>('asset')
  const [form, setForm] = useState({ start_time: '', asset_id: '', playlist_id: '', day_mask: 127 })
  const [editBlock, setEditBlock] = useState<any>(null)
  const [editForm, setEditForm] = useState({ start_time: '', day_mask: 127 })
  const [toast, setToast] = useState<any>(null)

  const showToast = (msg: string, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000) }

  const load = async () => {
    try {
      const [b, a, p, n] = await Promise.all([
        api.get(`/schedule/channel/${channelId}`),
        api.get('/assets'),
        api.get('/playlists'),
        api.get(`/schedule/channel/${channelId}/now`).catch(() => ({ data: null })),
      ])
      setBlocks(b.data); setAssets(a.data); setPlaylists(p.data); setNowPlaying(n.data)
    } finally { setLoading(false) }
  }
  useEffect(() => { load(); const iv = setInterval(load, 5000); return () => clearInterval(iv) }, [])

  const addBlock = async (e: React.FormEvent) => {
    e.preventDefault()
    const payload: any = { channel_id: channelId, start_time: form.start_time, day_mask: form.day_mask, block_type: blockType }
    if (blockType === 'asset') payload.asset_id = form.asset_id
    if (blockType === 'playlist') payload.playlist_id = form.playlist_id
    try {
      await api.post(`/schedule/channel/${channelId}`, payload)
      setShowAdd(false); showToast('Block added'); load()
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
    setEditForm({ start_time: b.start_time, day_mask: b.day_mask })
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
            <p style={{ fontSize:13, color:'var(--text-2)' }}>{blocks.length} block{blocks.length!==1?'s':''} · UTC</p>
          </div>
          <Btn icon="+" onClick={() => setShowAdd(true)}>Add Block</Btn>
        </div>

        {nowPlaying?.block_id && (
          <div style={{ background:'var(--green-dim)', border:'1px solid rgba(46,204,143,0.25)', borderRadius:'var(--r-lg)', padding:'12px 20px', marginBottom:20, display:'flex', alignItems:'center', gap:12 }}>
            <span style={{ width:8, height:8, borderRadius:'50%', background:'var(--green)', animation:'pulse 1.4s ease-in-out infinite', flexShrink:0 }}/>
            <div>
              <span style={{ fontSize:12, color:'var(--green)', fontWeight:600 }}>NOW PLAYING</span>
              <span style={{ fontSize:13, color:'var(--text)', marginLeft:12 }}>{nowPlaying.block_type==='playlist'?'♫ Playlist':nowPlaying.asset_id}</span>
              <span style={{ fontSize:12, color:'var(--text-2)', marginLeft:8, fontFamily:'var(--mono)' }}>+{Math.floor(nowPlaying.offset_secs)}s</span>
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
                <span style={{ fontFamily:'var(--mono)', fontSize:13, color:'var(--amber)', fontWeight:600 }}>{b.start_time}</span>
                <span style={{ fontSize:13, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{blockLabel(b)}</span>
                <span style={{ fontSize:11, fontFamily:'var(--mono)', color:b.block_type==='playlist'?'var(--amber)':'var(--text-3)', background:b.block_type==='playlist'?'var(--amber-dim)':'var(--bg-raised)', borderRadius:3, padding:'2px 5px', width:'fit-content' }}>
                  {b.block_type}
                </span>
                <span style={{ fontFamily:'var(--mono)', fontSize:12, color:'var(--text-2)' }}>{formatDur(b.duration_secs)}</span>
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
              {(['asset','playlist'] as const).map(t => (
                <button key={t} type="button" onClick={() => setBlockType(t)}
                  style={{ flex:1, padding:'6px 0', borderRadius:6, border:'none', cursor:'pointer', fontSize:13, fontWeight:blockType===t?600:400, background:blockType===t?'var(--bg-raised)':'transparent', color:blockType===t?'var(--text)':'var(--text-2)', fontFamily:'var(--sans)', transition:'all 0.12s' }}
                >{t==='playlist'?'♫ Playlist':'🎬 Asset'}</button>
              ))}
            </div>
            <Input label="Start Time (HH:MM:SS)" value={form.start_time} onChange={(e:any)=>setForm({...form,start_time:e.target.value})} placeholder="06:00:00" required/>
            {blockType==='asset' ? (
              <Select label="Asset" value={form.asset_id} onChange={(e:any)=>setForm({...form,asset_id:e.target.value})} required>
                <option value="">Select asset…</option>
                {assets.filter(a=>a.status==='ready').map(a=><option key={a.id} value={a.id}>{a.original_name}</option>)}
              </Select>
            ) : (
              <Select label="Playlist" value={form.playlist_id} onChange={(e:any)=>setForm({...form,playlist_id:e.target.value})} required>
                <option value="">Select playlist…</option>
                {playlists.map((p:any)=><option key={p.id} value={p.id}>{p.name} ({p.item_count} assets)</option>)}
              </Select>
            )}
            <Select label="Days" value={String(form.day_mask)} onChange={(e:any)=>setForm({...form,day_mask:parseInt(e.target.value)})}>
              <option value="127">Every day</option>
              <option value="31">Weekdays (Mon–Fri)</option>
              <option value="96">Weekends</option>
            </Select>
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
            <Input label="Start Time (HH:MM:SS)" value={editForm.start_time} onChange={(e:any)=>setEditForm({...editForm,start_time:e.target.value})} placeholder="06:00:00" required/>
            <Select label="Days" value={String(editForm.day_mask)} onChange={(e:any)=>setEditForm({...editForm,day_mask:parseInt(e.target.value)})}>
              <option value="127">Every day</option>
              <option value="31">Weekdays (Mon–Fri)</option>
              <option value="96">Weekends</option>
            </Select>
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
