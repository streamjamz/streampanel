import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { Layout } from '../components/Layout'
import { Btn, Toast, Spinner } from '../components/UI'

function formatDuration(secs: number) {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = Math.floor(secs % 60)
  return h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s}s` : `${s}s`
}

export default function Playlists() {
  const GENRES = ['R&B','Dancehall','Soul','Rock','Pop','Reggae','Hip-Hop']
  const [playlists, setPlaylists] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [filterGenre, setFilterGenre] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)

  const showToast = (msg: string, type = 'success') => {
    setToast({ msg, type }); setTimeout(() => setToast(null), 3000)
  }

  const load = () => api.get('/playlists').then(r => { setPlaylists(r.data); setLoading(false) })
  useEffect(() => { load() }, [])

  const create = async () => {
    if (!newName.trim()) return
    try {
      await api.post('/playlists', { name: newName.trim() })
      setNewName(''); setCreating(false); load(); showToast('✓ Playlist created')
    } catch { showToast('Failed to create playlist', 'error') }
  }

  const del = async (id: string) => {
    if (!confirm('Delete this playlist?')) return
    try { await api.delete(`/playlists/${id}`); load(); showToast('✓ Deleted') }
    catch { showToast('Delete failed', 'error') }
  }

  if (loading) return <Layout><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}><Spinner size={32} /></div></Layout>

  return (
    <Layout>
      <div style={{ padding: '32px 36px', animation: 'fadein 0.25s ease' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 4 }}>Playlists</h1>
            <p style={{ fontSize: 13, color: 'var(--text-2)' }}>Group assets into playlists to schedule as a single block</p>
          </div>
          <Btn variant="green" icon="+" onClick={() => setCreating(true)}>New Playlist</Btn>
        </div>

        {/* Genre filter */}
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:20 }}>
          <button onClick={() => setFilterGenre(null)}
            style={{ padding:'4px 12px', borderRadius:20, border:`1px solid ${filterGenre===null?'var(--amber)':'var(--border)'}`, background:filterGenre===null?'var(--amber-dim)':'transparent', color:filterGenre===null?'var(--amber)':'var(--text-2)', fontSize:12, cursor:'pointer', fontWeight:filterGenre===null?700:400 }}>All</button>
          {GENRES.map(g => (
            <button key={g} onClick={() => setFilterGenre(filterGenre===g?null:g)}
              style={{ padding:'4px 12px', borderRadius:20, border:`1px solid ${filterGenre===g?'var(--amber)':'var(--border)'}`, background:filterGenre===g?'var(--amber-dim)':'transparent', color:filterGenre===g?'var(--amber)':'var(--text-2)', fontSize:12, cursor:'pointer', fontWeight:filterGenre===g?700:400 }}>{g}</button>
          ))}
        </div>

        {creating && (
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--amber)', borderRadius: 'var(--r-lg)', padding: 20, marginBottom: 20, display: 'flex', gap: 10, alignItems: 'center' }}>
            <input
              autoFocus
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') create(); if (e.key === 'Escape') setCreating(false) }}
              placeholder="Playlist name..."
              style={{ flex: 1, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '8px 12px', color: 'var(--text)', fontSize: 14, fontFamily: 'var(--sans)', outline: 'none' }}
            />
            <Btn variant="green" size="sm" onClick={create}>Create</Btn>
            <Btn variant="ghost" size="sm" onClick={() => setCreating(false)}>Cancel</Btn>
          </div>
        )}

        {playlists.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-3)' }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>♫</div>
            <div style={{ fontSize: 14 }}>No playlists yet</div>
            <div style={{ fontSize: 12, marginTop: 6 }}>Create a playlist to group assets for scheduling</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
            {playlists.filter((p:any) => !filterGenre || (p.genres||[]).includes(filterGenre)).map((p: any) => (
              <div key={p.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{p.name}</div>
                    {p.description && <div style={{ fontSize: 12, color: 'var(--text-2)' }}>{p.description}</div>}
                  </div>
                  {p.shuffle && (
                    <span style={{ fontSize: 10, fontFamily: 'var(--mono)', background: 'var(--amber-dim)', color: 'var(--amber)', border: '1px solid rgba(245,166,35,0.25)', borderRadius: 3, padding: '2px 6px' }}>SHUFFLE</span>
                  )}
                </div>
                {(p.genres||[]).length > 0 && (
                  <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                    {p.genres.map((g:string) => (
                      <span key={g} style={{ fontSize:10, padding:'2px 8px', borderRadius:10, background:'rgba(245,166,35,0.1)', border:'1px solid rgba(245,166,35,0.2)', color:'var(--amber)', fontWeight:600 }}>{g}</span>
                    ))}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 16 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-2)' }}>
                    <span style={{ fontFamily: 'var(--mono)', color: 'var(--text)', fontWeight: 600 }}>{p.item_count}</span> assets
                  </div>
                  {p.total_duration_secs > 0 && (
                    <div style={{ fontSize: 12, color: 'var(--text-2)' }}>
                      <span style={{ fontFamily: 'var(--mono)', color: 'var(--text)', fontWeight: 600 }}>{formatDuration(p.total_duration_secs)}</span> total
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <Link to={`/playlists/${p.id}`} style={{ flex: 1 }}>
                    <Btn variant="outline" size="sm" style={{ width: '100%' }}>Edit</Btn>
                  </Link>
                  <Btn variant="danger" size="sm" onClick={() => del(p.id)}>✕</Btn>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {toast && <Toast message={toast.msg} type={toast.type as any} />}
    </Layout>
  )
}
