import React, { useState } from 'react'

export function Btn({ variant = 'primary', size = 'md', loading, icon, children, style, disabled, ...props }: any) {
  const [hov, setHov] = useState(false)
  const v: any = {
    primary: { background: hov ? '#e09010' : 'var(--amber)', color: '#000', borderColor: 'transparent' },
    danger:  { background: hov ? 'rgba(255,77,106,0.2)' : 'var(--red-dim)', color: 'var(--red)', borderColor: 'rgba(255,77,106,0.3)' },
    ghost:   { background: hov ? 'var(--bg-raised)' : 'transparent', color: 'var(--text-2)', borderColor: 'transparent' },
    outline: { background: hov ? 'var(--bg-raised)' : 'transparent', color: 'var(--text)', borderColor: 'var(--border-hi)' },
    green:   { background: hov ? 'rgba(46,204,143,0.2)' : 'var(--green-dim)', color: 'var(--green)', borderColor: 'rgba(46,204,143,0.3)' },
    blue:    { background: hov ? 'rgba(77,159,255,0.2)' : 'var(--blue-dim)', color: 'var(--blue)', borderColor: 'rgba(77,159,255,0.3)' },
  }
  const pad = { sm: '5px 10px', md: '8px 16px', lg: '10px 22px' }[size as string]
  return (
    <button {...props} disabled={disabled || loading}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ display:'inline-flex', alignItems:'center', gap:6, padding:pad, borderRadius:'var(--r)', border:'1px solid', fontFamily:'var(--sans)', fontWeight:500, fontSize:size==='sm'?12:13, cursor:disabled?'not-allowed':'pointer', opacity:disabled?0.5:1, transition:'all 0.12s', whiteSpace:'nowrap', ...v[variant], ...style }}>
      {loading ? <Spinner size={12} color="currentColor"/> : icon}{children}
    </button>
  )
}

export function Input({ label, error, style, ...props }: any) {
  const [foc, setFoc] = useState(false)
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
      {label && <label style={{ fontSize:11, fontWeight:600, color:'var(--text-2)', textTransform:'uppercase', letterSpacing:'0.08em' }}>{label}</label>}
      <input {...props} onFocus={(e:any)=>{setFoc(true);props.onFocus?.(e)}} onBlur={(e:any)=>{setFoc(false);props.onBlur?.(e)}}
        style={{ background:'var(--bg-input)', border:`1px solid ${error?'var(--red)':foc?'var(--amber)':'var(--border)'}`, borderRadius:'var(--r)', padding:'9px 12px', color:'var(--text)', fontSize:14, fontFamily:'var(--sans)', outline:'none', transition:'border-color 0.12s', width:'100%', ...style }}/>
      {error && <span style={{ fontSize:12, color:'var(--red)' }}>{error}</span>}
    </div>
  )
}

export function Select({ label, children, style, ...props }: any) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
      {label && <label style={{ fontSize:11, fontWeight:600, color:'var(--text-2)', textTransform:'uppercase', letterSpacing:'0.08em' }}>{label}</label>}
      <select {...props} style={{ background:'var(--bg-input)', border:'1px solid var(--border)', borderRadius:'var(--r)', padding:'9px 12px', color:'var(--text)', fontSize:14, fontFamily:'var(--sans)', outline:'none', cursor:'pointer', width:'100%', ...style }}>{children}</select>
    </div>
  )
}

export function StateTag({ state }: { state: string }) {
  const map: any = {
    LIVE_ONLY:         { label:'LIVE',       color:'var(--red)',   bg:'var(--red-dim)',   dot:true },
    TV_LIVE_RUNNING:   { label:'LIVE',       color:'var(--red)',   bg:'var(--red-dim)',   dot:true },
    TV_VOD_RUNNING:    { label:'PLAYOUT',    color:'var(--green)', bg:'var(--green-dim)', dot:false },
    TV_LIVE_REQUESTED: { label:'TAKE LIVE…', color:'var(--amber)', bg:'var(--amber-dim)', dot:true },
    TV_VOD_RETURNING:  { label:'RETURNING',  color:'var(--blue)',  bg:'var(--blue-dim)',  dot:false },
    OFFLINE:           { label:'OFFLINE',    color:'var(--text-3)',bg:'transparent',      dot:false },
  }
  const t = map[state] ?? map['OFFLINE']
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'2px 8px', borderRadius:4, fontSize:10, fontWeight:600, fontFamily:'var(--mono)', letterSpacing:'0.07em', background:t.bg, color:t.color, border:`1px solid ${t.color}33` }}>
      {t.dot && <span style={{ width:5, height:5, borderRadius:'50%', background:t.color, animation:'pulse 1.4s ease-in-out infinite', flexShrink:0 }}/>}
      {t.label}
    </span>
  )
}

export function TypeTag({ type }: { type: string }) {
  const isTV = type === 'tv'
  return (
    <span style={{ padding:'2px 7px', borderRadius:4, fontSize:10, fontWeight:700, fontFamily:'var(--mono)', letterSpacing:'0.07em', background:isTV?'var(--blue-dim)':'var(--amber-dim)', color:isTV?'var(--blue)':'var(--amber)', border:`1px solid ${isTV?'rgba(77,159,255,0.25)':'rgba(245,166,35,0.25)'}` }}>
      {isTV ? '⏱ TV' : '◉ LIVE'}
    </span>
  )
}

export function Modal({ title, onClose, children, width = 480 }: any) {
  return (
    <div onClick={(e:any)=>{if(e.target===e.currentTarget)onClose()}} style={{ position:'fixed', inset:0, background:'rgba(6,9,15,0.85)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, backdropFilter:'blur(6px)', animation:'fadein 0.15s ease' }}>
      <div style={{ background:'var(--bg-card)', border:'1px solid var(--border-hi)', borderRadius:'var(--r-xl)', width, maxWidth:'calc(100vw - 32px)', boxShadow:'0 32px 80px rgba(0,0,0,0.7)', animation:'fadein 0.2s ease' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'18px 24px', borderBottom:'1px solid var(--border)' }}>
          <h2 style={{ fontSize:15, fontWeight:700 }}>{title}</h2>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'var(--text-3)', fontSize:22, cursor:'pointer', lineHeight:1 }}>×</button>
        </div>
        <div style={{ padding:24 }}>{children}</div>
      </div>
    </div>
  )
}

export function Toast({ message, type = 'success' }: { message: string; type?: string }) {
  const col = ({ success:'var(--green)', error:'var(--red)', info:'var(--amber)' } as any)[type] ?? 'var(--amber)'
  return (
    <div style={{ position:'fixed', bottom:24, right:24, zIndex:2000, background:'var(--bg-raised)', border:`1px solid ${col}33`, borderLeft:`3px solid ${col}`, borderRadius:'var(--r)', padding:'12px 16px', fontSize:13, boxShadow:'0 8px 32px rgba(0,0,0,0.5)', animation:'slideright 0.2s ease', maxWidth:300 }}>{message}</div>
  )
}

export function Spinner({ size = 20, color = 'var(--amber)' }: { size?: number; color?: string }) {
  return <div style={{ width:size, height:size, border:`2px solid rgba(255,255,255,0.1)`, borderTopColor:color, borderRadius:'50%', animation:'spin 0.7s linear infinite', flexShrink:0 }}/>
}

export function CopyField({ label, value, secret = false }: { label: string; value: string; secret?: boolean }) {
  const [shown, setShown] = useState(!secret)
  const [copied, setCopied] = useState(false)
  const copy = () => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(()=>setCopied(false),2000) }
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
      <label style={{ fontSize:11, fontWeight:600, color:'var(--text-2)', textTransform:'uppercase', letterSpacing:'0.08em' }}>{label}</label>
      <div style={{ display:'flex', background:'var(--bg-input)', border:'1px solid var(--border)', borderRadius:'var(--r)', overflow:'hidden' }}>
        <code style={{ flex:1, padding:'8px 12px', fontSize:12, fontFamily:'var(--mono)', color:'var(--text-2)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{shown?value:'••••••••••••••••••••••••'}</code>
        <div style={{ display:'flex', borderLeft:'1px solid var(--border)' }}>
          {secret && <button onClick={()=>setShown(!shown)} style={{ padding:'0 10px', background:'none', border:'none', color:'var(--text-3)', cursor:'pointer', fontSize:12, fontFamily:'var(--sans)' }}>{shown?'Hide':'Show'}</button>}
          <button onClick={copy} style={{ padding:'0 12px', background:'none', border:'none', color:copied?'var(--green)':'var(--text-3)', cursor:'pointer', fontSize:12, fontFamily:'var(--sans)', transition:'color 0.15s' }}>{copied?'✓ Copied':'Copy'}</button>
        </div>
      </div>
    </div>
  )
}
