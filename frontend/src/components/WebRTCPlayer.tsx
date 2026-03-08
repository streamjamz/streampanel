import { useEffect, useRef, useState } from 'react'
import { Spinner } from './UI'

interface Props { whepUrl: string; style?: React.CSSProperties }

export function WebRTCPlayer({ whepUrl, style }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const [status, setStatus] = useState<'connecting'|'live'|'error'|'offline'>('connecting')

  useEffect(() => {
    if (!whepUrl) { setStatus('offline'); return }
    let cancelled = false

    async function start() {
      setStatus('connecting')
      pcRef.current?.close()
      const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }], bundlePolicy: 'max-bundle' })
      pcRef.current = pc
      pc.addTransceiver('video', { direction: 'recvonly' })
      pc.addTransceiver('audio', { direction: 'recvonly' })
      pc.ontrack = (e) => { if (videoRef.current && e.streams[0]) { videoRef.current.srcObject = e.streams[0]; setStatus('live') } }
      pc.onconnectionstatechange = () => {
        if ((pc.connectionState === 'failed' || pc.connectionState === 'disconnected') && !cancelled) {
          setStatus('error'); setTimeout(() => { if (!cancelled) start() }, 4000)
        }
      }
      try {
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        await new Promise<void>(r => {
          if (pc.iceGatheringState === 'complete') { r(); return }
          pc.onicegatheringstatechange = () => { if (pc.iceGatheringState === 'complete') r() }
          setTimeout(r, 3000)
        })
        const resp = await fetch(whepUrl, { method: 'POST', headers: { 'Content-Type': 'application/sdp' }, body: pc.localDescription!.sdp })
        if (!resp.ok) throw new Error(`WHEP ${resp.status}`)
        await pc.setRemoteDescription({ type: 'answer', sdp: await resp.text() })
      } catch { if (!cancelled) { setStatus('error'); setTimeout(() => { if (!cancelled) start() }, 5000) } }
    }

    start()
    return () => { cancelled = true; pcRef.current?.close(); pcRef.current = null }
  }, [whepUrl])

  return (
    <div style={{ position:'relative', background:'#000', borderRadius:'var(--radius-lg)', overflow:'hidden', aspectRatio:'16/9', ...style }}>
      <video ref={videoRef} autoPlay playsInline muted style={{ width:'100%', height:'100%', display:'block', objectFit:'contain' }} />
      {status !== 'live' && (
        <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:12, background:'rgba(8,12,20,0.92)' }}>
          {status === 'connecting' && <><Spinner size={28}/><span style={{ fontSize:13, color:'var(--text-muted)', fontFamily:'var(--font-mono)' }}>CONNECTING...</span></>}
          {status === 'error' && <><span style={{ fontSize:28 }}>◌</span><span style={{ fontSize:13, color:'var(--text-muted)', fontFamily:'var(--font-mono)' }}>RECONNECTING...</span></>}
          {status === 'offline' && <><span style={{ fontSize:36, opacity:0.3 }}>⬡</span><span style={{ fontSize:13, color:'var(--text-muted)', fontFamily:'var(--font-mono)' }}>OFFLINE</span></>}
        </div>
      )}
      {status === 'live' && (
        <div style={{ position:'absolute', top:12, left:12, display:'flex', alignItems:'center', gap:6, background:'rgba(8,12,20,0.75)', backdropFilter:'blur(4px)', border:'1px solid rgba(255,59,92,0.3)', borderRadius:4, padding:'3px 8px' }}>
          <span style={{ width:6, height:6, borderRadius:'50%', background:'var(--live)', animation:'pulse-dot 1.5s ease-in-out infinite' }}/>
          <span style={{ fontSize:10, fontFamily:'var(--font-mono)', color:'var(--live)', fontWeight:700, letterSpacing:'0.08em' }}>LIVE</span>
        </div>
      )}
      <div style={{ position:'absolute', bottom:12, right:12, background:'rgba(8,12,20,0.75)', backdropFilter:'blur(4px)', border:'1px solid var(--border)', borderRadius:4, padding:'2px 6px', fontSize:9, fontFamily:'var(--font-mono)', color:'var(--text-muted)', letterSpacing:'0.08em' }}>WebRTC · Sub-second</div>
    </div>
  )
}
