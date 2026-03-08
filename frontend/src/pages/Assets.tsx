import { useEffect, useState, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../api/client'
import { Layout } from '../components/Layout'
import { Btn, Toast, Spinner } from '../components/UI'

const fmtDur = (s: number|null) => { if(!s) return '—'; const m=Math.floor(s/60); return `${m}:${String(Math.floor(s%60)).padStart(2,'0')}` }
const fmtSize = (b: number|null) => { if(!b) return '—'; if(b>1e9) return (b/1e9).toFixed(1)+'GB'; return (b/1e6).toFixed(0)+'MB' }

interface UploadItem {
  id: string
  name: string
  pct: number
  status: 'pending' | 'uploading' | 'done' | 'error'
  error?: string
}

const GENRES = ['R&B','Dancehall','Soul','Rock','Pop','Reggae','Hip-Hop']

export default function Assets() {
  const { id: channelId } = useParams<{ id: string }>()
  const [assets, setAssets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [uploads, setUploads] = useState<UploadItem[]>([])
  const [toast, setToast] = useState<any>(null)
  const [activeGenre, setActiveGenre] = useState<string|null>(null)
  const [editingId, setEditingId] = useState<string|null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkGenre, setBulkGenre] = useState<string|null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const showToast = (msg: string, type='success') => { setToast({msg,type}); setTimeout(()=>setToast(null),3000) }
  const load = () => api.get('/assets').then(r => { setAssets(r.data); setLoading(false) }).catch(()=>setLoading(false))
  useEffect(() => { load(); const iv = setInterval(load, 5000); return () => clearInterval(iv) }, [])

  const updateUpload = (id: string, patch: Partial<UploadItem>) =>
    setUploads(prev => prev.map(u => u.id === id ? { ...u, ...patch } : u))

  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return

    const items: UploadItem[] = files.map(f => ({
      id: Math.random().toString(36).slice(2),
      name: f.name,
      pct: 0,
      status: 'pending' as const,
    }))
    setUploads(prev => [...prev, ...items])

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const item = items[i]
      updateUpload(item.id, { status: 'uploading' })
      const fd = new FormData()
      fd.append('file', file)
      try {
        await api.post('/assets/upload', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (p: any) => updateUpload(item.id, { pct: Math.round((p.loaded / (p.total ?? 1)) * 100) }),
        })
        updateUpload(item.id, { status: 'done', pct: 100 })
        // auto-tag with active genre filter if one is selected
        if (activeGenre) {
          try {
            const res = await api.get('/assets')
            const all = res.data
            const latest = all.find((a: any) => !assets.find((ex: any) => ex.id === a.id))
            if (latest) {
              await api.patch(`/assets/${latest.id}/genres`, { genres: [activeGenre] })
            }
          } catch {}
        }
        load()
      } catch (err: any) {
        updateUpload(item.id, { status: 'error', error: err.response?.data?.detail ?? 'Upload failed' })
      }
    }

    if (fileRef.current) fileRef.current.value = ''
    setTimeout(() => setUploads(prev => prev.filter(u => u.status !== 'done')), 4000)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    if (fileRef.current) {
      const dt = e.dataTransfer
      const fakeEvent = { target: { files: dt.files } } as any
      upload(fakeEvent)
    }
  }

  const isUploading = uploads.some(u => u.status === 'uploading' || u.status === 'pending')

  const del = async (id: string, name: string) => {
    if(!confirm(`Delete "${name}"?`)) return
    try { await api.delete(`/assets/${id}`); showToast('Asset deleted'); load() }
    catch { showToast('Delete failed','error') }
  }

  const toggleGenre = async (assetId: string, currentGenres: string[], genre: string) => {
    const updated = currentGenres.includes(genre)
      ? currentGenres.filter(g => g !== genre)
      : [...currentGenres, genre]
    try {
      await api.patch(`/assets/${assetId}/genres`, { genres: updated })
      setAssets(prev => prev.map(a => a.id === assetId ? { ...a, genres: updated } : a))
    } catch { showToast('Failed to update genres', 'error') }
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const selectAll = () => {
    if (selectedIds.size === filteredAssets.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredAssets.map((a:any) => a.id)))
    }
  }

  const bulkTag = async (genre: string) => {
    const ids = Array.from(selectedIds)
    await Promise.all(ids.map(id => {
      const asset = assets.find((a:any) => a.id === id)
      const current = asset?.genres || []
      const updated = current.includes(genre) ? current : [...current, genre]
      return api.patch(`/assets/${id}/genres`, { genres: updated })
    }))
    setAssets(prev => prev.map((a:any) =>
      selectedIds.has(a.id)
        ? { ...a, genres: (a.genres||[]).includes(genre) ? a.genres : [...(a.genres||[]), genre] }
        : a
    ))
    setSelectedIds(new Set())
    setBulkGenre(null)
    showToast(`Tagged ${ids.length} video${ids.length!==1?'s':''} as ${genre}`)
  }

  const filteredAssets = activeGenre
    ? assets.filter(a => (a.genres || []).includes(activeGenre))
    : assets

  const statusStyle = (s: string): React.CSSProperties => ({
    display:'inline-block', marginTop:2, padding:'1px 6px', borderRadius:3, fontSize:10, fontWeight:600, fontFamily:'var(--mono)',
    background: s==='ready'?'var(--green-dim)':s==='error'?'var(--red-dim)':'var(--amber-dim)',
    color: s==='ready'?'var(--green)':s==='error'?'var(--red)':'var(--amber)',
    border: `1px solid ${s==='ready'?'rgba(46,204,143,0.25)':s==='error'?'rgba(255,77,106,0.25)':'rgba(245,166,35,0.25)'}`,
  })

  return (
    <Layout>
      <div style={{ padding:'32px 36px', animation:'fadein 0.25s ease' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:24, fontSize:13 }}>
          <Link to={`/channels/${channelId}`} style={{ color:'var(--text-2)', textDecoration:'none' }}>Channel</Link>
          <span style={{ color:'var(--text-3)' }}>›</span>
          <span>Assets</span>
        </div>

        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:28 }}>
          <div>
            <h1 style={{ fontSize:26, fontWeight:800, marginBottom:6, letterSpacing:'-0.02em' }}>Assets</h1>
            <p style={{ fontSize:13, color:'var(--text-2)' }}>{filteredAssets.length}{activeGenre ? ` ${activeGenre}` : ''} video file{filteredAssets.length!==1?'s':''}</p>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <input ref={fileRef} type="file" accept="video/*" multiple style={{ display:'none' }} onChange={upload}/>
            {assets.length > 0 && <button onClick={selectAll} style={{ padding:'7px 14px', borderRadius:'var(--r)', fontSize:12, fontWeight:600, cursor:'pointer', border:'1px solid var(--border)', background:'var(--bg-card)', color:'var(--text-2)' }}>{selectedIds.size===filteredAssets.length && filteredAssets.length>0 ? 'Deselect All' : 'Select All'}</button>}
            <Btn icon="↑" loading={isUploading} onClick={() => fileRef.current?.click()}>Upload Videos</Btn>
          </div>
        </div>

        {/* Genre filter */}
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:20 }}>
          <button
            onClick={() => setActiveGenre(null)}
            style={{ padding:'5px 14px', borderRadius:20, fontSize:12, fontWeight:600, cursor:'pointer', border:'1px solid var(--border)', background: activeGenre===null ? 'var(--amber)' : 'var(--bg-card)', color: activeGenre===null ? '#000' : 'var(--text-2)', transition:'all 0.15s' }}
          >All</button>
          {GENRES.map(g => (
            <button key={g} onClick={() => setActiveGenre(activeGenre===g ? null : g)}
              style={{ padding:'5px 14px', borderRadius:20, fontSize:12, fontWeight:600, cursor:'pointer', border:'1px solid var(--border)', background: activeGenre===g ? 'var(--amber)' : 'var(--bg-card)', color: activeGenre===g ? '#000' : 'var(--text-2)', transition:'all 0.15s' }}
            >{g}</button>
          ))}
        </div>

        {/* Bulk action bar */}
        {selectedIds.size > 0 && (
          <div style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 16px', background:'rgba(245,166,35,0.08)', border:'1px solid rgba(245,166,35,0.25)', borderRadius:'var(--r-lg)', marginBottom:16, flexWrap:'wrap' }}>
            <span style={{ fontSize:13, fontWeight:600, color:'var(--amber)' }}>{selectedIds.size} selected</span>
            <span style={{ fontSize:12, color:'var(--text-3)' }}>Tag as:</span>
            {GENRES.map(g => (
              <button key={g} onClick={() => bulkTag(g)}
                style={{ padding:'4px 12px', borderRadius:14, fontSize:11, fontWeight:600, cursor:'pointer', border:'1px solid rgba(245,166,35,0.4)', background:'rgba(245,166,35,0.12)', color:'var(--amber)', transition:'all 0.15s' }}
                onMouseEnter={(e:any)=>e.currentTarget.style.background='rgba(245,166,35,0.25)'}
                onMouseLeave={(e:any)=>e.currentTarget.style.background='rgba(245,166,35,0.12)'}
              >{g}</button>
            ))}
            <button onClick={() => setSelectedIds(new Set())}
              style={{ marginLeft:'auto', background:'none', border:'none', color:'var(--text-3)', cursor:'pointer', fontSize:12 }}>Clear</button>
          </div>
        )}

        {/* Drop zone */}
        <div
          style={{ border:'2px dashed var(--border-hi)', borderRadius:'var(--r-lg)', padding:'24px 20px', textAlign:'center', marginBottom: uploads.length ? 0 : 24, background:'var(--bg-card)', cursor:'pointer', transition:'border-color 0.15s' }}
          onMouseEnter={(e:any)=>e.currentTarget.style.borderColor='var(--amber)'}
          onMouseLeave={(e:any)=>e.currentTarget.style.borderColor='var(--border-hi)'}
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); (e.currentTarget as HTMLElement).style.borderColor='var(--amber)' }}
          onDragLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor='var(--border-hi)' }}
          onDrop={handleDrop}
        >
          <div style={{ fontSize:28, marginBottom:8, opacity:0.4 }}>🎬</div>
          <div style={{ fontSize:13, color:'var(--text-2)', marginBottom:4 }}>Drop video files here or <span style={{ color:'var(--amber)' }}>browse</span></div>
          <div style={{ fontSize:11, color:'var(--text-3)' }}>MP4, MOV, MKV, TS — multiple files supported — up to 10 GB each</div>
        </div>

        {/* Upload queue */}
        {uploads.length > 0 && (
          <div style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:'var(--r-lg)', overflow:'hidden', marginBottom:24, marginTop:8 }}>
            {uploads.map(u => (
              <div key={u.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 16px', borderBottom:'1px solid var(--border)' }}>
                <span style={{ fontSize:13, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', color:'var(--text-2)' }}>{u.name}</span>
                {u.status === 'error' ? (
                  <span style={{ fontSize:11, color:'var(--red)', flexShrink:0 }}>{u.error}</span>
                ) : u.status === 'done' ? (
                  <span style={{ fontSize:11, color:'var(--green)', flexShrink:0 }}>Done</span>
                ) : (
                  <>
                    <div style={{ width:140, height:4, background:'var(--border)', borderRadius:2, overflow:'hidden', flexShrink:0 }}>
                      <div style={{ height:'100%', width:`${u.pct}%`, background: u.status==='pending'?'var(--text-3)':'var(--amber)', transition:'width 0.3s', borderRadius:2 }}/>
                    </div>
                    <span style={{ fontSize:11, color:'var(--text-3)', fontFamily:'var(--mono)', width:34, textAlign:'right', flexShrink:0 }}>
                      {u.status === 'pending' ? 'wait' : `${u.pct}%`}
                    </span>
                  </>
                )}
                <button onClick={() => setUploads(prev => prev.filter(x => x.id !== u.id))}
                  style={{ background:'none', border:'none', color:'var(--text-3)', cursor:'pointer', fontSize:13, flexShrink:0 }}>✕</button>
              </div>
            ))}
          </div>
        )}

        {loading ? (
          <div style={{ display:'flex', justifyContent:'center', padding:80 }}><Spinner size={32}/></div>
        ) : assets.length === 0 ? (
          <div style={{ textAlign:'center', padding:'60px 20px', border:'1px dashed var(--border)', borderRadius:'var(--r-xl)' }}>
            <p style={{ color:'var(--text-2)' }}>No assets uploaded yet</p>
          </div>
        ) : (
          <div style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:'var(--r-lg)', overflow:'hidden' }}>
            <div style={{ display:'grid', gridTemplateColumns:'32px 1fr 90px 110px 70px 70px 50px', gap:16, padding:'10px 20px', borderBottom:'1px solid var(--border)', fontSize:11, fontWeight:600, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.08em' }}>
              <span/><span>Name</span><span>Duration</span><span>Resolution</span><span>Codec</span><span>Size</span><span/>
            </div>
            {filteredAssets.map((a, i) => (
              <div key={a.id} style={{ borderBottom:i<filteredAssets.length-1?'1px solid var(--border)':'none' }}>
                <div style={{ display:'grid', gridTemplateColumns:'32px 1fr 90px 110px 70px 70px 50px', gap:16, padding:'14px 20px', alignItems:'center', transition:'background 0.1s', background: selectedIds.has(a.id) ? 'rgba(245,166,35,0.05)' : 'transparent' }}
                  onMouseEnter={(e:any)=>e.currentTarget.style.background='var(--bg-raised)'}
                  onMouseLeave={(e:any)=>e.currentTarget.style.background='transparent'}
                >
                  <input type="checkbox" checked={selectedIds.has(a.id)} onChange={() => toggleSelect(a.id)} style={{ cursor:'pointer', accentColor:'var(--amber)', width:15, height:15 }}/>
                  <div style={{ display:'flex', alignItems:'center', gap:12, minWidth:0 }}>
                    <div style={{ width:34, height:34, borderRadius:8, background:'var(--bg-raised)', border:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, flexShrink:0 }}>🎬</div>
                    <div style={{ minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{a.original_name}</div>
                      <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:3, flexWrap:'wrap' }}>
                        <span style={statusStyle(a.status)}>{a.status}</span>
                        {(a.genres||[]).map((g:string) => (
                          <span key={g} style={{ padding:'1px 7px', borderRadius:10, fontSize:10, fontWeight:600, background:'rgba(245,166,35,0.12)', color:'var(--amber)', border:'1px solid rgba(245,166,35,0.25)' }}>{g}</span>
                        ))}
                        <button onClick={() => setEditingId(editingId===a.id ? null : a.id)}
                          style={{ background:'none', border:'1px dashed var(--border)', borderRadius:10, color:'var(--text-3)', cursor:'pointer', fontSize:10, padding:'1px 7px', lineHeight:1.6 }}>
                          {editingId===a.id ? 'done' : '+ genre'}
                        </button>
                      </div>
                    </div>
                  </div>
                  <span style={{ fontSize:12, fontFamily:'var(--mono)', color:'var(--text-2)' }}>{fmtDur(a.duration_secs)}</span>
                  <span style={{ fontSize:12, color:'var(--text-2)' }}>{a.width?`${a.width}×${a.height}`:'—'}</span>
                  <span style={{ fontSize:12, fontFamily:'var(--mono)', color:'var(--text-2)' }}>{a.video_codec??'—'}</span>
                  <span style={{ fontSize:12, color:'var(--text-2)' }}>{fmtSize(a.file_size)}</span>
                  <div style={{ display:'flex', justifyContent:'flex-end' }}>
                    <button onClick={() => del(a.id, a.original_name)} style={{ background:'none', border:'none', color:'var(--text-3)', cursor:'pointer', fontSize:14, padding:'2px 6px', borderRadius:4, transition:'color 0.12s' }}
                      onMouseEnter={(e:any)=>e.currentTarget.style.color='var(--red)'}
                      onMouseLeave={(e:any)=>e.currentTarget.style.color='var(--text-3)'}
                    >✕</button>
                  </div>
                </div>
                {editingId===a.id && (
                  <div style={{ padding:'10px 20px 14px 76px', background:'var(--bg-raised)', display:'flex', gap:8, flexWrap:'wrap' }}>
                    {GENRES.map(g => {
                      const active = (a.genres||[]).includes(g)
                      return (
                        <button key={g} onClick={() => toggleGenre(a.id, a.genres||[], g)}
                          style={{ padding:'4px 12px', borderRadius:14, fontSize:11, fontWeight:600, cursor:'pointer', border:'1px solid', borderColor: active?'var(--amber)':'var(--border)', background: active?'rgba(245,166,35,0.15)':'transparent', color: active?'var(--amber)':'var(--text-2)', transition:'all 0.15s' }}
                        >{g}</button>
                      )
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      {toast && <Toast message={toast.msg} type={toast.type}/>}
    </Layout>
  )
}
