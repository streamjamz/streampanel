import React, { useEffect, useState } from 'react'
import { api } from '../api/client'
import { Layout } from '../components/Layout'
import { Spinner } from '../components/UI'

export default function Settings() {
  const [settings, setSettings] = useState<any>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    try {
      const res = await api.get('/settings')
      setSettings(res.data)
    } finally {
      setLoading(false)
    }
  }

  const save = async (key: string, value: string, type: string) => {
    setSaving(true)
    try {
      await api.put(`/settings/${key}`, { value, value_type: type })
      await load()
      alert('Settings saved!')
    } catch (err: any) {
      alert('Error: ' + (err.response?.data?.detail || 'Failed to save'))
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
        <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 20 }}>System Settings</h1>

        <div style={{ maxWidth: 800 }}>
          {/* CDN Settings */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '20px 22px', marginBottom: 20 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>CDN Configuration</h2>

            {/* Enable Direct HLS */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={settings.ENABLE_DIRECT_HLS?.value === 'true'}
                  onChange={(e) => save('ENABLE_DIRECT_HLS', e.target.checked ? 'true' : 'false', 'bool')}
                  disabled={saving}
                />
                <span style={{ fontSize: 14, fontWeight: 600 }}>Enable Direct HLS</span>
              </label>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginLeft: 30 }}>
                Stream directly from your server (always recommended as fallback)
              </div>
            </div>

            {/* Enable CDN HLS */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={settings.ENABLE_CDN_HLS?.value === 'true'}
                  onChange={(e) => save('ENABLE_CDN_HLS', e.target.checked ? 'true' : 'false', 'bool')}
                  disabled={saving}
                />
                <span style={{ fontSize: 14, fontWeight: 600 }}>Enable CDN HLS</span>
              </label>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginLeft: 30 }}>
                Stream via CDN for better scalability and global reach
              </div>
            </div>

            {/* CDN URL */}
            <div>
              <label style={{ fontSize: 14, fontWeight: 600, display: 'block', marginBottom: 8 }}>
                CDN HLS URL
              </label>
              <input
                type="text"
                value={settings.CDN_HLS_URL?.value || ''}
                onChange={(e) => setSettings({...settings, CDN_HLS_URL: {...settings.CDN_HLS_URL, value: e.target.value}})}
                onBlur={(e) => save('CDN_HLS_URL', e.target.value, 'string')}
                placeholder="https://your-zone.b-cdn.net/hls"
                disabled={saving}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--r)',
                  color: 'var(--text)',
                  fontSize: 14,
                  fontFamily: 'var(--mono)'
                }}
              />
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 6 }}>
                Your BlazingCDN or other CDN base URL for HLS streams
              </div>
            </div>
          </div>

          {saving && (
            <div style={{ padding: 12, background: 'rgba(245,158,11,0.1)', border: '1px solid var(--amber)', borderRadius: 'var(--r)', color: 'var(--amber)', fontSize: 13 }}>
              ⏳ Saving settings...
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
