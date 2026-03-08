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

export default function Assets() {
  const { id: channelId } = useParams<{ id: string }>()
  const [assets, setAssets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [uploads, setUploads] = useState<UploadItem[]>([])
  const [toast, setToast] = useState<any>(null)
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
            <p style={{ fontSize:13, color:'var(--text-2)' }}>{assets.length} video file{assets.length!==1?'s':''}</p>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <input ref={fileRef} type="file" accept="video/*" multiple style={{ display:'none' }} onChange={upload}/>
            <Btn icon="↑" loading={isUploading} onClick={() => fileRef.current?.click()}>Upload Videos</Btn>
          </div>
        </div>

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
            <div style={{ display:'grid', gridTemplateColumns:'1fr 90px 110px 70px 70px 50px', gap:16, padding:'10px 20px', borderBottom:'1px solid var(--border)', fontSize:11, fontWeight:600, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.08em' }}>
              <span>Name</span><span>Duration</span><span>Resolution</span><span>Codec</span><span>Size</span><span/>
            </div>
            {assets.map((a, i) => (
              <div key={a.id} style={{ display:'grid', gridTemplateColumns:'1fr 90px 110px 70px 70px 50px', gap:16, padding:'14px 20px', borderBottom:i<assets.length-1?'1px solid var(--border)':'none', alignItems:'center', transition:'background 0.1s' }}
                onMouseEnter={(e:any)=>e.currentTarget.style.background='var(--bg-raised)'}
                onMouseLeave={(e:any)=>e.currentTarget.style.background='transparent'}
              >
                <div style={{ display:'flex', alignItems:'center', gap:12, minWidth:0 }}>
                  <div style={{ width:34, height:34, borderRadius:8, background:'var(--bg-raised)', border:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, flexShrink:0 }}>🎬</div>
                  <div style={{ minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{a.original_name}</div>
                    <span style={statusStyle(a.status)}>{a.status}</span>
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
            ))}
          </div>
        )}
      </div>
      {toast && <Toast message={toast.msg} type={toast.type}/>}
    </Layout>
  )
}
