import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../api/client'
import { Layout } from '../components/Layout'
import { Btn, Toast, Spinner } from '../components/UI'

function formatDuration(secs: number) {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = Math.floor(secs % 60)
  return h > 0 ? `${h}h ${m}m ${s}s` : m > 0 ? `${m}m ${s}s` : `${s}s`
}

export default function PlaylistDetail() {
  const { id } = useParams<{ id: string }>()
  const [playlist, setPlaylist] = useState<any>(null)
  const [assets, setAssets] = useState<any[]>([])
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)
  const [addingAsset, setAddingAsset] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [name, setName] = useState('')

  const showToast = (msg: string, type = 'success') => {
    setToast({ msg, type }); setTimeout(() => setToast(null), 3000)
  }

  const load = async () => {
    const [pl, av] = await Promise.all([
      api.get(`/playlists/${id}`),
      api.get('/assets'),
    ])
    setPlaylist(pl.data)
    setName(pl.data.name)
    setAssets(av.data.filter((a: any) => a.status === 'ready'))
  }

  useEffect(() => { load() }, [id])

  const addAsset = async (assetId: string) => {
    try {
      await api.post(`/playlists/${id}/items`, { asset_id: assetId })
      load(); showToast('✓ Added to playlist'); setAddingAsset(false)
    } catch (e: any) { showToast(e.response?.data?.detail ?? 'Error', 'error') }
  }

  const removeItem = async (itemId: string) => {
    try { await api.delete(`/playlists/${id}/items/${itemId}`); load() }
    catch { showToast('Remove failed', 'error') }
  }

  const saveName = async () => {
    try {
      await api.patch(`/playlists/${id}`, { name })
      setEditingName(false); load(); showToast('✓ Saved')
    } catch { showToast('Save failed', 'error') }
  }

  const toggleShuffle = async () => {
    try {
      await api.patch(`/playlists/${id}`, { shuffle: !playlist.shuffle })
      load()
    } catch { showToast('Save failed', 'error') }
  }

  const moveItem = async (items: any[], fromIdx: number, toIdx: number) => {
    const reordered = [...items]
    const [moved] = reordered.splice(fromIdx, 1)
    reordered.splice(toIdx, 0, moved)
    try {
      await api.put(`/playlists/${id}/items/reorder`, { item_ids: reordered.map((i: any) => i.id) })
      load()
    } catch { showToast('Reorder failed', 'error') }
  }

  if (!playlist) return <Layout><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}><Spinner size={32} /></div></Layout>

  const items = playlist.items || []
  const usedAssetIds = new Set(items.map((i: any) => i.asset_id))
  const availableAssets = assets.filter((a: any) => !usedAssetIds.has(a.id))

  return (
    <Layout>
      <div style={{ padding: '32px 36px', animation: 'fadein 0.25s ease', maxWidth: 720 }}>
        {/* Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24, fontSize: 13 }}>
          <Link to="/playlists" style={{ color: 'var(--text-2)', textDecoration: 'none' }}>Playlists</Link>
          <span style={{ color: 'var(--text-3)' }}>›</span>
          <span>{playlist.name}</span>
        </div>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            {editingName ? (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  autoFocus
                  value={name}
                  onChange={e => setName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditingName(false) }}
                  style={{ background: 'var(--bg)', border: '1px solid var(--amber)', borderRadius: 'var(--r)', padding: '6px 10px', color: 'var(--text)', fontSize: 18, fontWeight: 800, fontFamily: 'var(--sans)', outline: 'none', width: 300 }}
                />
                <Btn variant="green" size="sm" onClick={saveName}>Save</Btn>
                <Btn variant="ghost" size="sm" onClick={() => setEditingName(false)}>Cancel</Btn>
              </div>
            ) : (
              <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', cursor: 'pointer' }} onClick={() => setEditingName(true)}>
                {playlist.name} <span style={{ fontSize: 13, color: 'var(--text-3)', fontWeight: 400 }}>✎</span>
              </h1>
            )}
            <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 6, display: 'flex', gap: 16 }}>
              <span><span style={{ fontFamily: 'var(--mono)', color: 'var(--text)' }}>{items.length}</span> assets</span>
              {playlist.total_duration_secs > 0 && (
                <span><span style={{ fontFamily: 'var(--mono)', color: 'var(--text)' }}>{formatDuration(playlist.total_duration_secs)}</span> total</span>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={toggleShuffle}
              style={{
                padding: '6px 14px', borderRadius: 'var(--r)', border: '1px solid var(--border)', cursor: 'pointer', fontSize: 12,
                fontFamily: 'var(--mono)', background: playlist.shuffle ? 'var(--amber-dim)' : 'var(--bg-card)',
                color: playlist.shuffle ? 'var(--amber)' : 'var(--text-2)', transition: 'all 0.12s'
              }}
            >
              ⇌ SHUFFLE {playlist.shuffle ? 'ON' : 'OFF'}
            </button>
            <Btn variant="outline" size="sm" icon="+" onClick={() => setAddingAsset(!addingAsset)}>Add Asset</Btn>
          </div>
        </div>

        {/* Add asset panel */}
        {addingAsset && (
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--amber)', borderRadius: 'var(--r-lg)', padding: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Select Asset to Add</div>
            {availableAssets.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--text-3)' }}>All ready assets are already in this playlist</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 240, overflowY: 'auto' }}>
                {availableAssets.map((a: any) => (
                  <button key={a.id} onClick={() => addAsset(a.id)}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--r)', cursor: 'pointer', textAlign: 'left', transition: 'all 0.1s' }}
                    onMouseEnter={(e: any) => e.currentTarget.style.borderColor = 'var(--amber)'}
                    onMouseLeave={(e: any) => e.currentTarget.style.borderColor = 'var(--border)'}
                  >
                    <span style={{ fontSize: 13, color: 'var(--text)' }}>{a.original_name}</span>
                    <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text-3)' }}>
                      {a.duration_secs ? formatDuration(a.duration_secs) : '—'}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Items list */}
        {items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-3)', border: '1px dashed var(--border)', borderRadius: 'var(--r-lg)' }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>♫</div>
            <div style={{ fontSize: 13 }}>No assets in this playlist</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>Click "Add Asset" to get started</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {items.map((item: any, idx: number) => (
              <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--r)', transition: 'border-color 0.1s' }}>
                <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text-3)', width: 24, textAlign: 'center' }}>{idx + 1}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.asset_name}</div>
                  <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text-3)', marginTop: 2 }}>
                    {item.duration_secs ? formatDuration(item.duration_secs) : '—'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {idx > 0 && (
                    <button onClick={() => moveItem(items, idx, idx - 1)}
                      style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', cursor: 'pointer', color: 'var(--text-2)', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>↑</button>
                  )}
                  {idx < items.length - 1 && (
                    <button onClick={() => moveItem(items, idx, idx + 1)}
                      style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', cursor: 'pointer', color: 'var(--text-2)', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>↓</button>
                  )}
                  <button onClick={() => removeItem(item.id)}
                    style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', cursor: 'pointer', color: 'var(--red)', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
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
