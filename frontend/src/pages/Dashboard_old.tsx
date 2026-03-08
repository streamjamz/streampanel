import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { Layout } from '../components/Layout'
import { Btn, StateTag, TypeTag, Modal, Input, Select, Spinner } from '../components/UI'

interface Channel { id:string; name:string; slug:string; channel_type:string; state:string }

export default function Dashboard() {
  const [channels, setChannels] = useState<Channel[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ name:'', slug:'', channel_type:'live', timezone:'UTC' })
  const navigate = useNavigate()

  const load = () => api.get('/channels').then(r => { setChannels(r.data); setLoading(false) }).catch(()=>setLoading(false))
  useEffect(() => { load(); const iv = setInterval(load, 5000); return () => clearInterval(iv) }, [])

  const createChannel = async (e: React.FormEvent) => {
    e.preventDefault(); setCreating(true)
    try { await api.post('/channels', form); setShowCreate(false); load() }
    finally { setCreating(false) }
  }

  const live    = channels.filter(c => c.state==='LIVE_ONLY'||c.state==='TV_LIVE_RUNNING').length
  const playout = channels.filter(c => c.state==='TV_VOD_RUNNING').length

  return (
    <Layout>
      <div style={{ padding:'32px 36px', animation:'fadein 0.25s ease' }}>

        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:32 }}>
          <div>
            <h1 style={{ fontSize:26, fontWeight:800, marginBottom:6, letterSpacing:'-0.02em' }}>Channels</h1>
            <p style={{ fontSize:13, color:'var(--text-2)' }}>Broadcast operations control</p>
          </div>
          <Btn onClick={() => setShowCreate(true)} icon="+">New Channel</Btn>
        </div>

        {/* KPI row */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:1, background:'var(--border)', borderRadius:'var(--r-lg)', overflow:'hidden', marginBottom:28, border:'1px solid var(--border)' }}>
          {[
            { label:'Total',   val:channels.length,                      color:'var(--text)' },
            { label:'On Air',  val:live,                                  color:'var(--red)' },
            { label:'Playout', val:playout,                               color:'var(--green)' },
            { label:'Offline', val:channels.length-live-playout,          color:'var(--text-3)' },
          ].map(k => (
            <div key={k.label} style={{ background:'var(--bg-card)', padding:'18px 22px' }}>
              <div style={{ fontSize:11, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.08em', fontWeight:600, marginBottom:6 }}>{k.label}</div>
              <div style={{ fontSize:32, fontWeight:800, fontFamily:'var(--mono)', color:k.color, lineHeight:1 }}>{String(k.val).padStart(2,'0')}</div>
            </div>
          ))}
        </div>

        {loading ? (
          <div style={{ display:'flex', justifyContent:'center', padding:80 }}><Spinner size={32}/></div>
        ) : channels.length === 0 ? (
          <div style={{ textAlign:'center', padding:'80px 20px', border:'1px dashed var(--border)', borderRadius:'var(--r-xl)' }}>
            <div style={{ fontSize:40, marginBottom:16, opacity:0.2 }}>◈</div>
            <p style={{ color:'var(--text-2)', marginBottom:20 }}>No channels yet</p>
            <Btn onClick={() => setShowCreate(true)}>Create your first channel</Btn>
          </div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:10 }}>
            {channels.map((ch, i) => {
              const isLive = ch.state==='LIVE_ONLY'||ch.state==='TV_LIVE_RUNNING'
              return (
                <div key={ch.id} onClick={() => navigate(`/channels/${ch.id}`)}
                  style={{ background:'var(--bg-card)', border:`1px solid ${isLive?'rgba(255,77,106,0.25)':'var(--border)'}`, borderRadius:'var(--r-lg)', padding:20, cursor:'pointer', transition:'all 0.15s', position:'relative', overflow:'hidden', animation:`fadein 0.3s ease ${i*0.04}s both` }}
                  onMouseEnter={(e:any)=>{ e.currentTarget.style.borderColor=isLive?'rgba(255,77,106,0.5)':'var(--border-hi)'; e.currentTarget.style.transform='translateY(-1px)' }}
                  onMouseLeave={(e:any)=>{ e.currentTarget.style.borderColor=isLive?'rgba(255,77,106,0.25)':'var(--border)'; e.currentTarget.style.transform='none' }}
                >
                  {isLive && <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:'linear-gradient(90deg,transparent,var(--red),transparent)' }}/>}
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:14 }}>
                    <div style={{ fontSize:15, fontWeight:700, letterSpacing:'-0.01em' }}>{ch.name}</div>
                    <TypeTag type={ch.channel_type}/>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <StateTag state={ch.state}/>
                    <span style={{ fontSize:11, color:'var(--text-3)', fontFamily:'var(--mono)' }}>/{ch.slug}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {showCreate && (
        <Modal title="New Channel" onClose={() => setShowCreate(false)}>
          <form onSubmit={createChannel} style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <Input label="Channel Name" value={form.name} onChange={(e:any) => setForm({...form, name:e.target.value, slug:e.target.value.toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'')})} placeholder="My Channel" required/>
            <Input label="Slug" value={form.slug} onChange={(e:any) => setForm({...form, slug:e.target.value})} placeholder="my-channel" required/>
            <Select label="Channel Type" value={form.channel_type} onChange={(e:any) => setForm({...form, channel_type:e.target.value})}>
              <option value="live">LIVE — Real-time RTMP ingest</option>
              <option value="tv">TV — Scheduled VOD playout</option>
            </Select>
            <Select label="Timezone" value={form.timezone} onChange={(e:any) => setForm({...form, timezone:e.target.value})}>
              {['UTC','America/New_York','America/Los_Angeles','America/Chicago','Europe/London','Europe/Paris','Asia/Tokyo','Asia/Singapore'].map(tz => <option key={tz} value={tz}>{tz}</option>)}
            </Select>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end', paddingTop:8 }}>
              <Btn variant="outline" type="button" onClick={() => setShowCreate(false)}>Cancel</Btn>
              <Btn type="submit" loading={creating}>Create Channel</Btn>
            </div>
          </form>
        </Modal>
      )}
    </Layout>
  )
}
