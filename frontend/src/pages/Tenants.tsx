import React, { useEffect, useState } from 'react'
import { api } from '../api/client'
import { Layout } from '../components/Layout'
import { Spinner, Modal, Input } from '../components/UI'

const PLAN_COLORS: any = {
  live: '#3b9eff',
  tv: '#a855f7',
  pro: '#f59e0b',
  enterprise: '#22c55e',
}

function PlanBadge({ plan }: { plan: string }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4, textTransform: 'uppercase', letterSpacing: '0.06em',
      background: `${PLAN_COLORS[plan] ?? '#888'}22`, color: PLAN_COLORS[plan] ?? '#888' }}>
      {plan}
    </span>
  )
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 4,
      background: active ? 'rgba(34,197,94,0.12)' : 'rgba(255,77,77,0.12)',
      color: active ? '#22c55e' : '#ff4d4d' }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: active ? '#22c55e' : '#ff4d4d', display: 'inline-block' }}/>
      {active ? 'Active' : 'Suspended'}
    </span>
  )
}

export default function Tenants() {
  const [tenants, setTenants] = useState<any[]>([])
  const [plans, setPlans] = useState<any>({})
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [editTenant, setEditTenant] = useState<any>(null)
  const [toast, setToast] = useState<any>(null)

  const showToast = (msg: string, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const [form, setForm] = useState({
    name: '', slug: '', plan: 'live', notes: '', admin_email: '', admin_password: ''
  })
  const [editForm, setEditForm] = useState({
    name: '', plan: 'live', notes: '', max_channels: 2, max_storage_gb: 10, feature_flags: {} as any
  })

  const load = async () => {
    try {
      const [t, p] = await Promise.all([api.get('/tenants'), api.get('/tenants/plans')])
      setTenants(t.data)
      setPlans(p.data)
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const autoSlug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

  const handleCreate = async () => {
    try {
      await api.post('/tenants', form)
      showToast('Tenant created successfully')
      setShowCreate(false)
      setForm({ name: '', slug: '', plan: 'live', notes: '', admin_email: '', admin_password: '' })
      load()
    } catch (e: any) {
      showToast(e.response?.data?.detail ?? 'Failed to create tenant', 'error')
    }
  }

  const handleEdit = async () => {
    try {
      await api.patch(`/tenants/${editTenant.id}`, editForm)
      showToast('Tenant updated')
      setEditTenant(null)
      load()
    } catch (e: any) {
      showToast(e.response?.data?.detail ?? 'Failed to update', 'error')
    }
  }

  const handleSuspend = async (t: any) => {
    const action = t.is_active ? 'suspend' : 'unsuspend'
    await api.post(`/tenants/${t.id}/${action}`)
    showToast(`Tenant ${action}ed`)
    load()
  }

  const handleDelete = async (t: any) => {
    if (!confirm(`Delete tenant "${t.name}" and ALL their data? This cannot be undone.`)) return
    await api.delete(`/tenants/${t.id}`)
    showToast('Tenant deleted')
    load()
  }

  const openEdit = (t: any) => {
    setEditForm({ name: t.name, plan: t.plan, notes: t.notes ?? '', max_channels: t.max_channels, max_storage_gb: t.max_storage_gb, feature_flags: t.feature_flags ?? {} })
    setEditTenant(t)
  }

  const s: any = { padding: '32px 36px', animation: 'fadein 0.25s ease' }

  return (
    <Layout>
      <div style={s}>
        {toast && (
          <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 999, background: toast.type === 'error' ? '#ff4d4d' : '#22c55e',
            color: '#fff', padding: '10px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600 }}>{toast.msg}</div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 4, letterSpacing: '-0.02em' }}>Tenants</h1>
            <p style={{ fontSize: 13, color: 'var(--text-2)' }}>{tenants.length} tenant{tenants.length !== 1 ? 's' : ''}</p>
          </div>
          <button onClick={() => setShowCreate(true)} style={{ background: 'var(--amber)', color: '#000', border: 'none', borderRadius: 'var(--r)', padding: '10px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            +New Tenant
          </button>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><Spinner size={32}/></div>
        ) : (
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Tenant', 'Plan', 'Status', 'Channels', 'Users', 'Storage', 'Notes', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tenants.map((t: any, i: number) => (
                  <tr key={t.id} style={{ borderBottom: i < tenants.length - 1 ? '1px solid var(--border)' : 'none',
                    opacity: t.is_active ? 1 : 0.6 }}>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>{t.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>{t.slug}</div>
                    </td>
                    <td style={{ padding: '14px 16px' }}><PlanBadge plan={t.plan}/></td>
                    <td style={{ padding: '14px 16px' }}><StatusBadge active={t.is_active}/></td>
                    <td style={{ padding: '14px 16px', fontSize: 13, fontFamily: 'var(--mono)' }}>{t.channel_count} / {t.max_channels}</td>
                    <td style={{ padding: '14px 16px', fontSize: 13, fontFamily: 'var(--mono)' }}>{t.user_count}</td>
                    <td style={{ padding: '14px 16px', fontSize: 13, color: 'var(--text-2)' }}>{t.max_storage_gb} GB</td>
                    <td style={{ padding: '14px 16px', fontSize: 12, color: 'var(--text-3)', maxWidth: 160 }}>{t.notes ?? '—'}</td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => openEdit(t)} style={{ fontSize: 12, padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', cursor: 'pointer' }}>Edit</button>
                        <button onClick={() => handleSuspend(t)} style={{ fontSize: 12, padding: '5px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
                          background: t.is_active ? 'rgba(255,77,77,0.15)' : 'rgba(34,197,94,0.15)',
                          color: t.is_active ? '#ff4d4d' : '#22c55e' }}>
                          {t.is_active ? 'Suspend' : 'Unsuspend'}
                        </button>
                        <button onClick={() => handleDelete(t)} style={{ fontSize: 12, padding: '5px 10px', borderRadius: 6, border: 'none', background: 'rgba(255,77,77,0.1)', color: '#ff4d4d', cursor: 'pointer' }}>✕</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Create modal */}
        {showCreate && (
          <Modal title="New Tenant" onClose={() => setShowCreate(false)}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Input label="Company / Tenant Name" value={form.name} onChange={(e: any) => setForm({ ...form, name: e.target.value, slug: autoSlug(e.target.value) })} placeholder="Acme Radio" required/>
              <Input label="Slug (URL-safe)" value={form.slug} onChange={(e: any) => setForm({ ...form, slug: e.target.value })} placeholder="acme-radio" required/>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>Plan</label>
                <select value={form.plan} onChange={(e: any) => setForm({ ...form, plan: e.target.value })}
                  style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--r)', color: 'var(--text)', padding: '9px 12px', fontSize: 14 }}>
                  {Object.entries(plans).map(([key, val]: any) => (
                    <option key={key} value={key}>{val.label} — {val.max_channels} channels, {val.max_storage_gb}GB</option>
                  ))}
                </select>
              </div>
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)', marginBottom: 10 }}>Admin User</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <Input label="Admin Email" value={form.admin_email} onChange={(e: any) => setForm({ ...form, admin_email: e.target.value })} placeholder="admin@company.com" required/>
                  <Input label="Admin Password" type="password" value={form.admin_password} onChange={(e: any) => setForm({ ...form, admin_password: e.target.value })} placeholder="••••••••" required/>
                </div>
              </div>
              <Input label="Notes (optional)" value={form.notes} onChange={(e: any) => setForm({ ...form, notes: e.target.value })} placeholder="Internal notes about this tenant"/>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 6 }}>
                <button onClick={() => setShowCreate(false)} style={{ padding: '9px 18px', borderRadius: 'var(--r)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
                <button onClick={handleCreate} style={{ padding: '9px 18px', borderRadius: 'var(--r)', border: 'none', background: 'var(--amber)', color: '#000', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>Create Tenant</button>
              </div>
            </div>
          </Modal>
        )}

        {/* Edit modal */}
        {editTenant && (
          <Modal title={`Edit: ${editTenant.name}`} onClose={() => setEditTenant(null)}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Input label="Name" value={editForm.name} onChange={(e: any) => setEditForm({ ...editForm, name: e.target.value })}/>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>Plan</label>
                <select value={editForm.plan} onChange={(e: any) => {
                  const p = plans[e.target.value]
                  setEditForm({ ...editForm, plan: e.target.value, max_channels: p?.max_channels ?? editForm.max_channels, max_storage_gb: p?.max_storage_gb ?? editForm.max_storage_gb })
                }} style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--r)', color: 'var(--text)', padding: '9px 12px', fontSize: 14 }}>
                  {Object.entries(plans).map(([key, val]: any) => (
                    <option key={key} value={key}>{val.label} — {val.max_channels} channels, {val.max_storage_gb}GB</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Input label="Max Channels" type="number" value={String(editForm.max_channels)} onChange={(e: any) => setEditForm({ ...editForm, max_channels: parseInt(e.target.value) })}/>
                <Input label="Max Storage (GB)" type="number" value={String(editForm.max_storage_gb)} onChange={(e: any) => setEditForm({ ...editForm, max_storage_gb: parseInt(e.target.value) })}/>
              </div>

              {/* Feature flag overrides */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Feature Overrides</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {['live_channels', 'tv_channels', 'playlists', 'schedule'].map(feat => {
                    const planFeatures = plans[editForm.plan]?.features ?? []
                    const override = editForm.feature_flags[feat]
                    const fromPlan = planFeatures.includes(feat)
                    const effective = override !== undefined ? override : fromPlan
                    return (
                      <div key={feat} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--r)' }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 500 }}>{feat.replace(/_/g, ' ')}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{override !== undefined ? 'Override' : `Plan default (${fromPlan ? 'on' : 'off'})`}</div>
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {['on', 'off', 'default'].map(v => (
                            <button key={v} onClick={() => {
                              const flags = { ...editForm.feature_flags }
                              if (v === 'default') { delete flags[feat] }
                              else { flags[feat] = v === 'on' }
                              setEditForm({ ...editForm, feature_flags: flags })
                            }} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, border: 'none', cursor: 'pointer',
                              background: (v === 'default' && override === undefined) || (v === 'on' && override === true) || (v === 'off' && override === false)
                                ? 'var(--amber)' : 'rgba(255,255,255,0.07)',
                              color: (v === 'default' && override === undefined) || (v === 'on' && override === true) || (v === 'off' && override === false)
                                ? '#000' : 'var(--text-2)', fontWeight: 600 }}>
                              {v}
                            </button>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              <Input label="Notes" value={editForm.notes} onChange={(e: any) => setEditForm({ ...editForm, notes: e.target.value })} placeholder="Internal notes"/>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 6 }}>
                <button onClick={() => setEditTenant(null)} style={{ padding: '9px 18px', borderRadius: 'var(--r)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
                <button onClick={handleEdit} style={{ padding: '9px 18px', borderRadius: 'var(--r)', border: 'none', background: 'var(--amber)', color: '#000', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>Save Changes</button>
              </div>
            </div>
          </Modal>
        )}
      </div>
    </Layout>
  )
}
