import React, { useEffect, useState } from 'react'
import { api } from '../api/client'
import { Layout } from '../components/Layout'
import { Spinner } from '../components/UI'

export default function SystemSettings() {
  const [settings, setSettings] = useState<any>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const load = async () => {
    try {
      const res = await api.get('/system-settings')
      setSettings(res.data)
    } catch (err) {
      console.error('Failed to load settings:', err)
    } finally {
      setLoading(false)
    }
  }

  const save = async (key: string, value: string) => {
    setSaving(true)
    setMessage('')
    try {
      await api.put(`/system-settings/${key}`, { value })
      setMessage('✅ Settings saved successfully!')
      setTimeout(() => setMessage(''), 3000)
      await load()
    } catch (err: any) {
      setMessage('❌ Error: ' + (err.response?.data?.detail || 'Failed to save'))
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => { load() }, [])

  if (loading) return (
    <Layout>
      <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
        <Spinner size={32} />
      </div>
    </Layout>
  )

  return (
    <Layout>
      <div style={{ padding: '28px 32px' }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8, letterSpacing: '-0.02em' }}>System Settings</h1>
        <p style={{ fontSize: 14, color: 'var(--text-3)', marginBottom: 24 }}>Configure global system settings (Super Admin only)</p>

        <div style={{ maxWidth: 700 }}>
          {/* CDN Settings Card */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '20px 24px', marginBottom: 20 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>🌐 CDN Configuration</h2>
            <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 20 }}>
              Configure Content Delivery Network for HLS streaming. Leave empty to stream directly from your server.
            </p>

            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 8, color: 'var(--text-2)' }}>
                CDN HLS Base URL
              </label>
              <input
                type="text"
                value={settings.cdn_hls_url?.value || ''}
                onChange={(e) => setSettings({
                  ...settings,
                  cdn_hls_url: { ...settings.cdn_hls_url, value: e.target.value }
                })}
                onBlur={(e) => save('cdn_hls_url', e.target.value)}
                placeholder="https://your-zone.b-cdn.net/hls"
                disabled={saving}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--r)',
                  color: 'var(--text)',
                  fontSize: 14,
                  fontFamily: 'var(--mono)',
                  transition: 'border-color 0.2s'
                }}
                onFocus={(e) => e.target.style.borderColor = 'var(--amber)'}
                onBlurCapture={(e: any) => e.target.style.borderColor = 'var(--border)'}
              />
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 8, lineHeight: 1.5 }}>
                {settings.cdn_hls_url?.description}
              </div>

              {settings.cdn_hls_url?.value && (
                <div style={{ marginTop: 12, padding: '10px 12px', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 'var(--r)', fontSize: 12 }}>
                  <div style={{ color: '#22c55e', fontWeight: 600, marginBottom: 4 }}>✓ CDN Enabled</div>
                  <div style={{ color: 'var(--text-3)' }}>All HLS streams will be delivered via: <span style={{ fontFamily: 'var(--mono)', color: 'var(--text-2)' }}>{settings.cdn_hls_url.value}</span></div>
                </div>
              )}

              {!settings.cdn_hls_url?.value && (
                <div style={{ marginTop: 12, padding: '10px 12px', background: 'rgba(59,158,255,0.1)', border: '1px solid rgba(59,158,255,0.3)', borderRadius: 'var(--r)', fontSize: 12 }}>
                  <div style={{ color: '#3b9eff', fontWeight: 600, marginBottom: 4 }}>ℹ Direct Streaming</div>
                  <div style={{ color: 'var(--text-3)' }}>HLS streams are served directly from your server. Add a CDN URL to enable CDN delivery.</div>
                </div>
              )}
            </div>
          </div>

          {/* Status Message */}
          {message && (
            <div style={{
              padding: '12px 16px',
              background: message.includes('✅') ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
              border: `1px solid ${message.includes('✅') ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
              borderRadius: 'var(--r)',
              color: message.includes('✅') ? '#22c55e' : '#ef4444',
              fontSize: 13,
              fontWeight: 500
            }}>
              {message}
            </div>
          )}

          {saving && (
            <div style={{ padding: '12px 16px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 'var(--r)', color: 'var(--amber)', fontSize: 13 }}>
              💾 Saving settings...
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
