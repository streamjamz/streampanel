import { Link, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { useAuthStore } from '../store/auth'

export function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const logout = useAuthStore(s => s.logout)
  const role = useAuthStore(s => s.role)
  const isSuperAdmin = role === 'super_admin'
  const [firstChannelId, setFirstChannelId] = useState<string | null>(null)

  useEffect(() => {
    if (!isSuperAdmin) {
      api.get('/channels').then(r => { if (r.data?.[0]) setFirstChannelId(r.data[0].id) }).catch(() => {})
    }
  }, [isSuperAdmin])

  const nav = [
    { href:'/',          icon:'◈', label:'Dashboard' },
    ...((!isSuperAdmin) && firstChannelId ? [
      { href:`/channels/${firstChannelId}/assets`,   icon:'↑', label:'Upload Videos' },
      { href:'/playlists',                           icon:'♫', label:'Playlists' },
      { href:`/channels/${firstChannelId}/schedule`, icon:'📅', label:'Schedule' },
    ] : []),
    ...(isSuperAdmin ? [
      { href:'/playlists', icon:'♫', label:'Playlists' },
      { href:'/tenants',   icon:'🏢', label:'Tenants' },
    ] : []),
    { href:'/admin', icon:'⊙', label:'Admin' },
  ]

  return (
    <div style={{ display:'flex', height:'100vh', overflow:'hidden' }}>
      <aside style={{ width:220, flexShrink:0, background:'var(--bg-card)', borderRight:'1px solid var(--border)', display:'flex', flexDirection:'column', padding:'14px 0', gap:2 }}>

        {/* Logo */}
        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'0 16px', marginBottom:24 }}>
          <div style={{ width:34, height:34, borderRadius:9, flexShrink:0, background:'linear-gradient(135deg, var(--amber) 0%, #c06000 100%)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, color:'#000', fontWeight:900, boxShadow:'0 0 18px var(--amber-glow)' }}>◈</div>
          <span style={{ fontSize:13, fontWeight:800, color:'var(--text)', letterSpacing:'-0.01em' }}>StreamPanel</span>
        </div>

        {/* Nav items */}
        {nav.map(item => {
          const active = location.pathname === item.href || (item.href !== '/' && location.pathname.startsWith(item.href))
          return (
            <Link key={item.href} to={item.href}
              style={{ display:'flex', alignItems:'center', gap:10, margin:'0 8px', padding:'9px 10px', borderRadius:8, textDecoration:'none',
                background: active ? 'var(--amber-dim)' : 'transparent',
                border: `1px solid ${active ? 'rgba(245,166,35,0.25)' : 'transparent'}`,
                transition:'all 0.12s' }}
              onMouseEnter={(e:any)=>{ if(!active){ e.currentTarget.style.background='var(--bg-raised)' } }}
              onMouseLeave={(e:any)=>{ if(!active){ e.currentTarget.style.background='transparent' } }}
            >
              <span style={{ fontSize: item.icon.length > 1 ? 14 : 16, width:20, textAlign:'center', flexShrink:0, color: active ? 'var(--amber)' : 'var(--text-3)' }}>{item.icon}</span>
              <span style={{ fontSize:13, fontWeight:600, color: active ? 'var(--amber)' : 'var(--text-2)' }}>{item.label}</span>
            </Link>
          )
        })}

        <div style={{ flex:1 }}/>

        {/* User + logout */}
        <div style={{ margin:'0 8px', padding:'10px', borderRadius:8, background:'var(--bg-raised)', border:'1px solid var(--border)', display:'flex', alignItems:'center', gap:8 }}>
          <div style={{ width:28, height:28, borderRadius:'50%', background:'var(--amber-dim)', border:'1px solid rgba(245,166,35,0.3)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, color:'var(--amber)', fontWeight:700, flexShrink:0 }}>
            {isSuperAdmin ? 'SA' : 'A'}
          </div>
          <span style={{ fontSize:11, color:'var(--text-2)', fontWeight:600, flex:1 }}>{isSuperAdmin ? 'Super Admin' : 'Admin'}</span>
          <button title="Logout" onClick={logout}
            style={{ width:24, height:24, borderRadius:6, display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, background:'none', border:'none', color:'var(--text-3)', cursor:'pointer', transition:'all 0.12s', flexShrink:0 }}
            onMouseEnter={(e:any)=>{ e.currentTarget.style.color='var(--red)' }}
            onMouseLeave={(e:any)=>{ e.currentTarget.style.color='var(--text-3)' }}
          >⏻</button>
        </div>
      </aside>

      <main style={{ flex:1, overflow:'auto', background:'var(--bg)' }}>{children}</main>
    </div>
  )
}
