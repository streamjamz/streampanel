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
  const [channelType, setChannelType] = useState<string | null>(null)
  const [tvChannels, setTvChannels] = useState<any[]>([])
  const [devToolsOpen, setDevToolsOpen] = useState(false)
  const [expandedChannel, setExpandedChannel] = useState<string | null>(null)

  useEffect(() => {
    api.get('/channels').then(r => {
      if (r.data?.[0]) { setFirstChannelId(r.data[0].id); setChannelType(r.data[0].channel_type) }
      if (isSuperAdmin) setTvChannels(r.data.filter((c: any) => c.channel_type === 'tv'))
    }).catch(() => {})
  }, [isSuperAdmin])

  const nav = [
    { href:'/', icon:'◈', label:'Dashboard' },
    ...(!isSuperAdmin && firstChannelId && channelType === 'tv' ? [
      { href:`/channels/${firstChannelId}/assets`,   icon:'↑', label:'Upload Videos' },
      { href:'/playlists',                           icon:'♫', label:'Playlists' },
      { href:`/channels/${firstChannelId}/schedule`, icon:'📅', label:'Schedule' },
      { href:`/channels/${firstChannelId}/contributors`, icon:'🎙', label:'Contributors' },
    ] : []),
    ...(isSuperAdmin ? [
      { href:'/playlists',        icon:'♫', label:'Playlists' },
      { href:'/tenants',          icon:'🏢', label:'Tenants' },
      { href:'/system-settings',  icon:'🌐', label:'System Settings' },
    ] : []),
    { href:'/admin', icon:'⊙', label:'Admin' },
  ]

  return (
    <div style={{ display:'flex', height:'100vh', overflow:'hidden' }}>
      <aside style={{ width:220, flexShrink:0, background:'var(--bg-card)', borderRight:'1px solid var(--border)', display:'flex', flexDirection:'column', padding:'14px 0', gap:2, overflowY:'auto' }}>

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

        {/* Dev Tools - super admin only */}
        {isSuperAdmin && tvChannels.length > 0 && (
          <div style={{ margin:'8px 8px 0' }}>
            <button onClick={() => setDevToolsOpen(o => !o)}
              style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'9px 10px', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg-raised)', cursor:'pointer', transition:'all 0.12s' }}
              onMouseEnter={(e:any)=>e.currentTarget.style.borderColor='var(--amber)'}
              onMouseLeave={(e:any)=>e.currentTarget.style.borderColor='var(--border)'}
            >
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <span style={{ fontSize:14, width:20, textAlign:'center', color:'var(--text-3)' }}>⚙</span>
                <span style={{ fontSize:13, fontWeight:600, color:'var(--text-2)' }}>Dev Tools</span>
              </div>
              <span style={{ fontSize:10, color:'var(--text-3)', transition:'transform 0.15s', transform: devToolsOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>▾</span>
            </button>

            {devToolsOpen && (
              <div style={{ marginTop:4, display:'flex', flexDirection:'column', gap:2 }}>
                {tvChannels.map((ch: any) => (
                  <div key={ch.id}>
                    <button onClick={() => setExpandedChannel(expandedChannel === ch.id ? null : ch.id)}
                      style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'7px 10px 7px 14px', borderRadius:8, border:'none', background:'transparent', cursor:'pointer', transition:'all 0.12s' }}
                      onMouseEnter={(e:any)=>e.currentTarget.style.background='var(--bg-raised)'}
                      onMouseLeave={(e:any)=>e.currentTarget.style.background='transparent'}
                    >
                      <span style={{ fontSize:12, color:'var(--text-2)', fontWeight:600, textAlign:'left', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{ch.name}</span>
                      <span style={{ fontSize:10, color:'var(--text-3)', flexShrink:0 }}>{expandedChannel === ch.id ? '▾' : '▸'}</span>
                    </button>
                    {expandedChannel === ch.id && (
                      <div style={{ paddingLeft:14, display:'flex', flexDirection:'column', gap:2 }}>
                        <Link to={`/channels/${ch.id}/assets`} style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 10px', borderRadius:6, textDecoration:'none', color:'var(--text-2)', fontSize:12, transition:'all 0.1s' }}
                          onMouseEnter={(e:any)=>e.currentTarget.style.color='var(--amber)'}
                          onMouseLeave={(e:any)=>e.currentTarget.style.color='var(--text-2)'}
                        ><span>↑</span><span>Upload Videos</span></Link>
                        <Link to={`/channels/${ch.id}/schedule`} style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 10px', borderRadius:6, textDecoration:'none', color:'var(--text-2)', fontSize:12, transition:'all 0.1s' }}
                          onMouseEnter={(e:any)=>e.currentTarget.style.color='var(--amber)'}
                          onMouseLeave={(e:any)=>e.currentTarget.style.color='var(--text-2)'}
                        ><span>📅</span><span>Schedule</span></Link>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

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
