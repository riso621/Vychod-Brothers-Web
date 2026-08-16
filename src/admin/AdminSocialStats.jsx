import { useEffect, useMemo, useState } from 'react'
import { adminRequest } from '../lib/admin-control-center'
import { cachedAdminLoad } from '../lib/admin-cache'
import { formatSocialCount } from '../lib/social-stats'

const platforms = [
  { id: 'youtube', name: 'YOUTUBE', metric: 'Odberatelia' },
  { id: 'instagram', name: 'INSTAGRAM', metric: 'Sledovatelia' },
  { id: 'tiktok', name: 'TIKTOK', metric: 'Sledovatelia' },
]

function PlatformIcon({ platform }) {
  if (platform === 'youtube') return <svg viewBox="0 0 32 32" aria-hidden="true"><rect x="3" y="7" width="26" height="18" rx="6"/><path d="m13 11 8 5-8 5V11Z"/></svg>
  if (platform === 'instagram') return <svg viewBox="0 0 32 32" aria-hidden="true"><rect x="4" y="4" width="24" height="24" rx="7"/><circle cx="16" cy="16" r="5.5"/><circle cx="23.5" cy="8.7" r="1.2"/></svg>
  return <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M18.5 5v15.2a6.2 6.2 0 1 1-5.3-6.1"/><path d="M18.5 5c.8 4.4 3.4 6.8 7.5 7"/></svg>
}

function relativeTime(value) {
  if (!value) return 'Zatiaľ neaktualizované'
  const seconds = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 1000))
  if (seconds < 60) return 'Aktualizované práve teraz'
  const formatter = new Intl.RelativeTimeFormat('sk-SK', { numeric: 'always' })
  if (seconds < 3600) return `Aktualizované ${formatter.format(-Math.round(seconds / 60), 'minute')}`
  if (seconds < 86400) return `Aktualizované ${formatter.format(-Math.round(seconds / 3600), 'hour')}`
  return `Aktualizované ${formatter.format(-Math.round(seconds / 86400), 'day')}`
}

export default function AdminSocialStats() {
  const [rows, setRows] = useState([])
  const [values, setValues] = useState({ youtube: '', instagram: '', tiktok: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const load = async (force = false) => {
    setLoading(true); setError('')
    try {
      const result = await cachedAdminLoad('admin-social-stats', () => adminRequest({ action: 'social-stats' }), { force })
      const nextRows = result.stats || []
      setRows(nextRows)
      setValues(Object.fromEntries(platforms.map(({ id }) => [id, nextRows.find((row) => row.platform === id)?.followers ?? ''])))
    } catch (loadError) { setError(loadError.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])
  const rowsByPlatform = useMemo(() => new Map(rows.map((row) => [row.platform, row])), [rows])

  const submit = async (event) => {
    event.preventDefault(); if (saving) return
    const normalized = Object.fromEntries(platforms.map(({ id }) => [id, Number(values[id])]))
    if (Object.values(normalized).some((value) => !Number.isSafeInteger(value) || value < 0)) {
      setError('Zadajte pre všetky platformy celé nezáporné čísla.'); setMessage(''); return
    }
    setSaving(true); setError(''); setMessage('')
    try {
      await adminRequest({ action: 'save-social-stats', stats: normalized })
      await load(true)
      setMessage('Sociálne štatistiky boli uložené.')
    } catch (saveError) { setError(saveError.message) }
    finally { setSaving(false) }
  }

  return <section className="admin-social-stats"><div className="admin-page-heading"><div><span>ADMIN / SOCIAL</span><h1>Sociálne štatistiky</h1><p>Manuálne spravované reálne hodnoty zobrazené na verejnej homepage.</p></div></div>
    {loading ? <div className="admin-loading" aria-live="polite"><i/>Načítavam aktuálne dáta…</div> : <form onSubmit={submit} noValidate>
      <div className="admin-social-grid">{platforms.map((platform) => { const raw = Number(values[platform.id]); const preview = formatSocialCount(raw); const row = rowsByPlatform.get(platform.id); return <article className="admin-social-card" key={platform.id}><header><span><PlatformIcon platform={platform.id}/></span><div><strong>{platform.name}</strong><small>{platform.metric}</small></div></header><label htmlFor={`social-${platform.id}`}>Celkový počet<input id={`social-${platform.id}`} type="number" min="0" step="1" inputMode="numeric" value={values[platform.id]} onChange={(event) => setValues((current) => ({ ...current, [platform.id]: event.target.value }))} required /></label><dl><div><dt>Na webe</dt><dd>{preview || '—'}</dd></div><div><dt>Posledná zmena</dt><dd>{relativeTime(row?.synced_at)}</dd></div></dl></article> })}</div>
      <div className="admin-social-actions"><button type="submit" disabled={saving}>{saving ? 'UKLADÁM…' : 'ULOŽIŤ ŠTATISTIKY'}</button><p role="status" aria-live="polite" className={error ? 'is-error' : ''}>{error || message}</p></div>
    </form>}
  </section>
}
