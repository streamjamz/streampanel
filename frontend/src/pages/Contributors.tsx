import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../api/client'
import { Layout } from '../components/Layout'
import { Spinner, Btn, Modal } from '../components/UI'

function CopyBox({ label, value }: { label: string, value: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1, background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '8px 12px', fontSize: 12, fontFamily: 'var(--mono)', color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</div>
        <button onClick={copy} style={{ flexShrink: 0, padding: '7px 12px', borderRadius: 'var(--r)', border: '1px solid var(--border)', background: copied ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.05)', color: copied ? '#22c55e' : 'var(--text-2)', fontSize: 11, cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap' }}>
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>
    </div>
  )
}

export default function Contributors() {
  const { id: channelId } = useParams<{ id: string }>()
  const [contributors, setContributors] = useState<any[]>([])
  const [liveStatus, setLiveStatus] = useState<Set<string>>(new Set())
  const [channel, setChannel] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ name: '', role: 'DJ' })
  const [toast, setToast] = useState<any>(null)

  const showToast = (msg: string, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const load = async () => {
    // Load live status
    try {
      const statusResp = await api.get(`/contributors/channel/${channelId}/status`)
      const liveKeys = new Set<string>(statusResp.data.filter((c: any) => c.is_live).map((c: any) => c.stream_key))
      setLiveStatus(liveKeys)
    } catch (err) {
      // Ignore errors
    }
    try {
      const [chRes, contRes] = await Promise.all([
        api.get(`/channels/${channelId}`),
        api.get(`/contributors/channel/${channelId}`)
      ])
      setChannel(chRes.data)
      setContributors(contRes.data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [channelId])
  useEffect(() => {
    const interval = setInterval(load, 5000)
    return () => clearInterval(interval)
  }, [channelId])

  const addContributor = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await api.post('/contributors', { channel_id: channelId, ...form })
      setShowAdd(false)
      setForm({ name: '', role: 'DJ' })
      showToast('Contributor added')
      load()
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Error adding contributor', 'error')
    }
  }

  const toggleActive = async (id: string, isActive: boolean) => {
    try {
      await api.patch(`/contributors/${id}`, { is_active: !isActive })
      showToast(isActive ? 'Contributor disabled' : 'Contributor enabled')
      load()
    } catch (e: any) {
      showToast(e.response?.data?.detail || 'Error', 'error')
    }
  }

  const deleteContributor = async (id: string, name: string) => {
    if (!confirm(`Delete contributor "${name}"?`)) return
    try {
      await api.delete(`/contributors/${id}`)
      showToast('Contributor deleted')
      load()
    } catch (e: any) {
      showToast(e.response?.data?.detail || 'Error', 'error')
    }
  }

  const maxContributors = channel?.max_contributors || 3
  const slotsUsed = contributors.length
  const canAdd = slotsUsed < maxContributors

  return (
    <Layout>
      <div style={{ padding: '28px 32px', animation: 'fadein 0.25s ease' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
              <Link to={`/channels/${channelId}`} style={{ color: 'var(--text-3)', textDecoration: 'none', fontSize: 14 }}>← Back</Link>
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4, letterSpacing: '-0.02em' }}>
              {channel?.name} — Contributors
            </h1>
            <p style={{ fontSize: 13, color: 'var(--text-2)' }}>
              DJs, guests, and co-hosts with their own stream keys
            </p>
          </div>
          <Btn icon="+" onClick={() => canAdd ? setShowAdd(true) : showToast('Contributor limit reached. Contact support to upgrade.', 'error')}>
            Add Contributor
          </Btn>
        </div>

        {/* Slots indicator */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '14px 18px', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Contributor Slots</div>
            <div style={{ fontSize: 14, color: 'var(--text)' }}>
              <span style={{ fontWeight: 700, color: slotsUsed >= maxContributors ? 'var(--amber)' : 'var(--green)' }}>{slotsUsed}</span>
              <span style={{ color: 'var(--text-3)' }}> of {maxContributors} used</span>
            </div>
          </div>
          {slotsUsed >= maxContributors && (
            <div style={{ fontSize: 11, color: 'var(--amber)', background: 'var(--amber-dim)', padding: '4px 10px', borderRadius: 6, fontWeight: 600 }}>
              ⚠ Limit Reached
            </div>
          )}
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><Spinner size={32} /></div>
        ) : contributors.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 80, color: 'var(--text-3)', border: '1px dashed var(--border)', borderRadius: 'var(--r-lg)' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🎙</div>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>No contributors yet</div>
            <div style={{ fontSize: 13 }}>Add DJs, guests, or co-hosts with their own stream keys</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {contributors.map((c: any) => (
              <div key={c.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '18px 22px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                      <div style={{ fontSize: 16, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>{c.name}{liveStatus.has(c.stream_key) && <span style={{ fontSize: 11, fontWeight: 700, color: "#ef4444", display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: "#ef4444" }}></span>LIVE</span>}</div>
                      <div style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 5, background: 'rgba(168,85,247,0.12)', color: '#a855f7' }}>
                        {c.role}
                      </div>
                      {!c.is_active && (
                        <div style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 5, background: 'rgba(255,255,255,0.05)', color: 'var(--text-3)' }}>
                          Disabled
                        </div>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>
                      Added {new Date(c.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      onClick={() => toggleActive(c.id, c.is_active)}
                      style={{ padding: '6px 12px', borderRadius: 'var(--r)', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-2)', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}
                    >
                      {c.is_active ? 'Disable' : 'Enable'}
                    </button>
                    <button
                      onClick={() => deleteContributor(c.id, c.name)}
                      style={{ padding: '6px 12px', borderRadius: 'var(--r)', border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}
                    >
                      Delete
                    </button>
                  </div>
                </div>

                <div style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: 14 }}>
                  <CopyBox label="RTMP Server" value={`rtmp://${window.location.hostname}:1935/live`} />
                  <CopyBox label="Stream Key" value={c.stream_key} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showAdd && (
        <Modal title="Add Contributor" onClose={() => setShowAdd(false)}>
          <form onSubmit={addContributor} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>Name</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="DJ Kontrol"
                required
                style={{ width: '100%', background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '9px 12px', fontSize: 13, color: 'var(--text)', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>Role</label>
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                style={{ width: '100%', background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '9px 12px', fontSize: 13, color: 'var(--text)', boxSizing: 'border-box' }}
              >
                <option value="DJ">DJ</option>
                <option value="Guest">Guest</option>
                <option value="Co-host">Co-host</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8 }}>
              <Btn variant="outline" type="button" onClick={() => setShowAdd(false)}>Cancel</Btn>
              <Btn type="submit">Add Contributor</Btn>
            </div>
          </form>
        </Modal>
      )}

      {toast && (
        <div style={{ position: 'fixed', bottom: 20, right: 20, background: toast.type === 'error' ? '#ef4444' : '#22c55e', color: '#fff', padding: '12px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, boxShadow: '0 4px 12px rgba(0,0,0,0.3)', zIndex: 9999 }}>
          {toast.msg}
        </div>
      )}
    </Layout>
  )
}
