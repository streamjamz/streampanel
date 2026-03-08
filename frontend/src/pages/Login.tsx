import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { useAuthStore } from '../store/auth'
import { Input, Spinner } from '../components/UI'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const login = useAuthStore(s => s.login)

  const handleLogin = async () => {
    if (!email || !password) { setError('Please enter email and password'); return }
    setLoading(true); setError('')
    try {
      const r = await api.post('/auth/login', { email, password })
      login(r.data.access_token, r.data.refresh_token)
      navigate('/')
    } catch {
      setError('Invalid email or password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center',
      background:'var(--bg)',
      backgroundImage:'radial-gradient(ellipse 70% 50% at 50% -10%, rgba(245,166,35,0.08) 0%, transparent 60%)',
      position:'relative', overflow:'hidden',
    }}>
      <div style={{ position:'absolute', inset:0, backgroundImage:'linear-gradient(var(--border) 1px,transparent 1px),linear-gradient(90deg,var(--border) 1px,transparent 1px)', backgroundSize:'52px 52px', opacity:0.4, pointerEvents:'none' }}/>

      <div style={{ position:'relative', width:400, animation:'fadein 0.4s ease' }}>
        <div style={{ textAlign:'center', marginBottom:36 }}>
          <div style={{ width:54, height:54, borderRadius:16, margin:'0 auto 18px', background:'linear-gradient(135deg, var(--amber) 0%, #c06000 100%)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:26, fontWeight:900, color:'#000', boxShadow:'0 0 48px var(--amber-glow)' }}>◈</div>
          <h1 style={{ fontSize:24, fontWeight:800, letterSpacing:'-0.03em', marginBottom:6 }}>Stream Control</h1>
          <p style={{ fontSize:13, color:'var(--text-2)' }}>Broadcast operations panel</p>
        </div>

        <div style={{ background:'var(--bg-card)', border:'1px solid var(--border-hi)', borderRadius:'var(--r-xl)', padding:32, boxShadow:'0 32px 80px rgba(0,0,0,0.5)' }}>
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            <Input label="Email" type="email" value={email} onChange={(e:any) => setEmail(e.target.value)} placeholder="admin@example.com"
              onKeyDown={(e:any) => { if (e.key === 'Enter') handleLogin() }} autoFocus />
            <Input label="Password" type="password" value={password} onChange={(e:any) => setPassword(e.target.value)} placeholder="••••••••"
              onKeyDown={(e:any) => { if (e.key === 'Enter') handleLogin() }} />

            {error && (
              <div style={{ padding:'10px 12px', borderRadius:'var(--r)', background:'var(--red-dim)', border:'1px solid rgba(255,77,106,0.2)', fontSize:13, color:'var(--red)' }}>{error}</div>
            )}

            <button onClick={handleLogin} disabled={loading} style={{
              marginTop:4, padding:'11px', borderRadius:'var(--r)',
              background:loading?'#9a6800':'var(--amber)', color:'#000',
              border:'none', fontFamily:'var(--sans)', fontWeight:700, fontSize:14,
              cursor:loading?'wait':'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8,
              transition:'background 0.15s',
            }}>
              {loading ? <><Spinner size={16} color="#000"/> Signing in…</> : 'Sign in →'}
            </button>
          </div>
          <div style={{ textAlign:'center', marginTop:18 }}>
            <a href="#" onClick={(e:any)=>e.preventDefault()} style={{ fontSize:12, color:'var(--text-3)', textDecoration:'none' }}>Forgot password?</a>
          </div>
        </div>

        <p style={{ textAlign:'center', marginTop:20, fontSize:11, color:'var(--text-3)' }}>
          Stream Control v1.0 · Low-latency broadcast platform
        </p>
      </div>
    </div>
  )
}
