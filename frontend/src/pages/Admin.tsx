import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { Layout } from '../components/Layout'
import { Btn, Input, Select, Modal, Toast, Spinner } from '../components/UI'
import { useAuthStore } from '../store/auth'

function CopyableId({ label, value }: { label: string, value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 0', borderBottom:'1px solid var(--border)' }}>
      <span style={{ fontSize:11, color:'var(--text-3)', width:100, flexShrink:0 }}>{label}</span>
      <span style={{ fontSize:11, fontFamily:'var(--mono)', color:'var(--text-2)', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{value}</span>
      <button onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(()=>setCopied(false),2000) }}
        style={{ flexShrink:0, fontSize:10, padding:'3px 8px', borderRadius:4, border:'1px solid var(--border)', background: copied?'rgba(34,197,94,0.15)':'transparent', color:copied?'#22c55e':'var(--text-3)', cursor:'pointer' }}>
        {copied ? 'OK' : 'Copy'}
      </button>
    </div>
  )
}

export default function Admin() {
  const [users, setUsers] = useState<any[]>([])
  const [tenants, setTenants] = useState<any[]>([])
  const [channels, setChannels] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showUser, setShowUser] = useState(false)
  const [showResetPw, setShowResetPw] = useState(false)
  const [resetTarget, setResetTarget] = useState<any>(null)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [form, setForm] = useState({ email:'', password:'', role:'operator', tenant_id:'' })
  const [toast, setToast] = useState<any>(null)
  const role = useAuthStore(s => s.role)
  const isSuperAdmin = role === 'super_admin'

  const showToast = (msg: string, type='success') => { setToast({msg,type}); setTimeout(()=>setToast(null),3000) }

  const load = async () => {
    try {
      const [u, t, c] = await Promise.all([
        api.get('/users'),
        api.get('/tenants').catch(()=>({data:[]})),
        api.get('/channels'),
      ])
      setUsers(u.data); setTenants(t.data); setChannels(c.data)
    } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await api.post('/users', form)
      setShowUser(false); showToast('User created'); load()
    } catch(e: any) { showToast(e.response?.data?.detail??'Error','error') }
  }

  const deleteUser = async (id: string, email: string) => {
    if(!confirm(`Delete ${email}?`)) return
    try { await api.delete(`/users/${id}`); showToast('User deleted'); load() }
    catch { showToast('Delete failed','error') }
  }

  const openResetPw = (u: any) => {
    setResetTarget(u)
    setNewPassword('')
    setConfirmPassword('')
    setShowResetPw(true)
  }

  const resetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword.length < 8) { showToast('Password must be at least 8 characters', 'error'); return }
    if (newPassword !== confirmPassword) { showToast('Passwords do not match', 'error'); return }
    try {
      await api.put(`/users/${resetTarget.id}`, { password: newPassword })
      setShowResetPw(false)
      showToast(`Password updated for ${resetTarget.email}`)
    } catch(e: any) { showToast(e.response?.data?.detail??'Failed to update password','error') }
  }

  const roleColor: Record<string,string> = { super_admin:'var(--red)', tenant_admin:'var(--amber)', operator:'var(--blue)', viewer:'var(--text-3)' }

  return (
    <Layout>
      <div style={{ padding:'32px 36px', animation:'fadein 0.25s ease' }}>
        <h1 style={{ fontSize:26, fontWeight:800, marginBottom:32, letterSpacing:'-0.02em' }}>Admin</h1>

        {/* Users */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
          <h2 style={{ fontSize:16, fontWeight:700 }}>Users</h2>
          <Btn size="sm" icon="+" onClick={() => { setForm({email:'',password:'',role:'operator',tenant_id:tenants[0]?.id??''}); setShowUser(true) }}>Add User</Btn>
        </div>

        {loading ? <Spinner size={24}/> : (
          <div style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:'var(--r-lg)', overflow:'hidden', marginBottom:32 }}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 130px 80px 80px', gap:16, padding:'10px 20px', borderBottom:'1px solid var(--border)', fontSize:11, fontWeight:600, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.08em' }}>
              <span>Email</span><span>Role</span><span>Status</span><span/>
            </div>
            {users.map((u, i) => (
              <div key={u.id} style={{ display:'grid', gridTemplateColumns:'1fr 130px 80px 80px', gap:16, padding:'12px 20px', borderBottom:i<users.length-1?'1px solid var(--border)':'none', alignItems:'center', transition:'background 0.1s' }}
                onMouseEnter={(e:any)=>e.currentTarget.style.background='var(--bg-raised)'}
                onMouseLeave={(e:any)=>e.currentTarget.style.background='transparent'}
              >
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <div style={{ width:28, height:28, borderRadius:'50%', background:'var(--bg-raised)', border:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, flexShrink:0, fontWeight:700 }}>{u.email[0].toUpperCase()}</div>
                  <span style={{ fontSize:13 }}>{u.email}</span>
                </div>
                <span style={{ fontSize:11, fontFamily:'var(--mono)', color:roleColor[u.role]??'var(--text-2)', fontWeight:600 }}>{u.role}</span>
                <span style={{ fontSize:12, color:u.is_active?'var(--green)':'var(--text-3)' }}>{u.is_active?'Active':'Inactive'}</span>
                <div style={{ display:'flex', gap:4, justifyContent:'flex-end' }}>
                  {/* Reset password */}
                  <button
                    onClick={() => openResetPw(u)}
                    title="Reset password"
                    style={{ background:'none', border:'none', color:'var(--text-3)', cursor:'pointer', fontSize:14, padding:'2px 6px', borderRadius:4, transition:'color 0.12s' }}
                    onMouseEnter={(e:any)=>e.currentTarget.style.color='var(--amber)'}
                    onMouseLeave={(e:any)=>e.currentTarget.style.color='var(--text-3)'}
                  >🔑</button>
                  {/* Delete */}
                  <button
                    onClick={() => deleteUser(u.id, u.email)}
                    title="Delete user"
                    style={{ background:'none', border:'none', color:'var(--text-3)', cursor:'pointer', fontSize:14, padding:'2px 6px', borderRadius:4, transition:'color 0.12s' }}
                    onMouseEnter={(e:any)=>e.currentTarget.style.color='var(--red)'}
                    onMouseLeave={(e:any)=>e.currentTarget.style.color='var(--text-3)'}
                  >✕</button>
                </div>
              </div>
            ))}
            {users.length === 0 && <div style={{ padding:'24px 20px', color:'var(--text-3)', fontSize:13 }}>No users found</div>}
          </div>
        )}

        {/* Account & Channel IDs */}
        <h2 style={{ fontSize:16, fontWeight:700, marginBottom:14 }}>Account & Channel IDs</h2>
        <div style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:'var(--r-lg)', padding:'16px 20px', marginBottom:32 }}>
          <div style={{ fontSize:11, color:'var(--text-3)', marginBottom:12 }}>Use these IDs for API access, support tickets, or debugging.</div>
          {isSuperAdmin && tenants.map((t: any) => (
            <div key={t.id} style={{ marginBottom:16 }}>
              <div style={{ fontSize:12, fontWeight:700, color:'var(--amber)', marginBottom:6 }}>{t.name}</div>
              <CopyableId label="Tenant ID" value={t.id}/>
            </div>
          ))}
          {!isSuperAdmin && users[0]?.tenant_id && (
            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:12, fontWeight:700, color:'var(--amber)', marginBottom:6 }}>Your Account</div>
              <CopyableId label="Tenant ID" value={users[0].tenant_id}/>
            </div>
          )}
          {channels.length > 0 && (
            <div>
              <div style={{ fontSize:12, fontWeight:700, color:'var(--text-2)', marginBottom:6, marginTop:8 }}>Channels</div>
              {channels.map((c: any) => (
                <CopyableId key={c.id} label={c.name} value={c.id}/>
              ))}
            </div>
          )}
        </div>

        {/* System health */}
        <h2 style={{ fontSize:16, fontWeight:700, marginBottom:14 }}>System Health</h2>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:10 }}>
          {[
            { name:'SRS LTS',           detail:'v6.0-r0' },
            { name:'FastAPI Backend',   detail:'4 workers' },
            { name:'Switch Controller', detail:'polling 2s' },
            { name:'PostgreSQL',        detail:'panel db' },
            { name:'Redis',             detail:'127.0.0.1:6379' },
            { name:'Nginx',             detail:'TLS enabled' },
          ].map(s => (
            <div key={s.name} style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:'var(--r-lg)', padding:'14px 16px', display:'flex', flexDirection:'column', gap:6 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ fontSize:13, fontWeight:600 }}>{s.name}</span>
                <span style={{ width:7, height:7, borderRadius:'50%', background:'var(--green)', animation:'pulse 2s ease-in-out infinite' }}/>
              </div>
              <span style={{ fontSize:11, fontFamily:'var(--mono)', color:'var(--text-3)' }}>{s.detail}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Add User Modal */}
      {showUser && (
        <Modal title="Add User" onClose={() => setShowUser(false)} width={400}>
          <form onSubmit={createUser} style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <Input label="Email" type="email" value={form.email} onChange={(e:any)=>setForm({...form,email:e.target.value})} placeholder="user@station.tv" required/>
            <Input label="Password" type="password" value={form.password} onChange={(e:any)=>setForm({...form,password:e.target.value})} placeholder="••••••••" required/>
            <Select label="Role" value={form.role} onChange={(e:any)=>setForm({...form,role:e.target.value})}>
              <option value="viewer">Viewer</option>
              <option value="operator">Operator</option>
              <option value="tenant_admin">Tenant Admin</option>
              {isSuperAdmin && <option value="super_admin">Super Admin</option>}
            </Select>
            {tenants.length > 0 && (
              <Select label="Tenant" value={form.tenant_id} onChange={(e:any)=>setForm({...form,tenant_id:e.target.value})}>
                {tenants.map((t:any) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </Select>
            )}
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end', paddingTop:8 }}>
              <Btn variant="outline" type="button" onClick={() => setShowUser(false)}>Cancel</Btn>
              <Btn type="submit">Create User</Btn>
            </div>
          </form>
        </Modal>
      )}

      {/* Reset Password Modal */}
      {showResetPw && resetTarget && (
        <Modal title="Reset Password" onClose={() => setShowResetPw(false)} width={400}>
          <div style={{ marginBottom:16, fontSize:13, color:'var(--text-2)' }}>
            Setting new password for <span style={{ fontWeight:700, color:'var(--text-1)' }}>{resetTarget.email}</span>
          </div>
          <form onSubmit={resetPassword} style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <Input
              label="New Password"
              type="password"
              value={newPassword}
              onChange={(e:any) => setNewPassword(e.target.value)}
              placeholder="Min. 8 characters"
              required
            />
            <Input
              label="Confirm Password"
              type="password"
              value={confirmPassword}
              onChange={(e:any) => setConfirmPassword(e.target.value)}
              placeholder="Repeat new password"
              required
            />
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end', paddingTop:8 }}>
              <Btn variant="outline" type="button" onClick={() => setShowResetPw(false)}>Cancel</Btn>
              <Btn type="submit">Update Password</Btn>
            </div>
          </form>
        </Modal>
      )}

      {toast && <Toast message={toast.msg} type={toast.type}/>}
    </Layout>
  )
}
