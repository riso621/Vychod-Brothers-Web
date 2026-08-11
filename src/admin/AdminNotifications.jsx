import { useCallback, useEffect, useRef, useState } from 'react'
import { adminNotificationsRequest } from '../lib/admin-notifications'
import { supabase } from '../lib/supabase'

const iconFor = (type) => type.startsWith('stripe.') ? '€' : type.startsWith('membership.') ? '◆' : type === 'video.comment' ? '▤' : type.startsWith('video.') ? '♥' : type.startsWith('collaboration.') ? '✦' : type.startsWith('analytics.') ? '↗' : '●'

function relativeTime(value) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000))
  if (seconds < 60) return 'práve teraz'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `pred ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `pred ${hours} h`
  const days = Math.floor(hours / 24)
  return days < 7 ? `pred ${days} d` : new Intl.DateTimeFormat('sk-SK', { day: 'numeric', month: 'short' }).format(new Date(value))
}

function go(path) {
  window.history.pushState({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

export default function AdminNotifications() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState([])
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const rootRef = useRef(null)

  const load = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setLoading(true)
    try {
      const data = await adminNotificationsRequest({ action: 'list', limit: 20 })
      setItems(data.notifications || [])
      setUnread(data.unreadCount || 0)
      setError('')
    } catch {
      setError('Notifikácie sa nepodarilo načítať.')
    } finally {
      if (!quiet) setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const poll = window.setInterval(() => load({ quiet: true }), 45_000)
    const channel = supabase?.channel('admin-notifications-live').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'admin_notifications' }, () => load({ quiet: true })).subscribe()
    return () => {
      window.clearInterval(poll)
      if (channel) supabase.removeChannel(channel)
    }
  }, [load])

  useEffect(() => {
    if (!open) return undefined
    const close = (event) => { if (!rootRef.current?.contains(event.target)) setOpen(false) }
    const escape = (event) => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', escape) }
  }, [open])

  const openItem = async (item) => {
    if (!item.read_at) {
      setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, read_at: new Date().toISOString() } : entry))
      setUnread((value) => Math.max(0, value - 1))
      try { await adminNotificationsRequest({ action: 'read', id: item.id }) } catch { load({ quiet: true }) }
    }
    setOpen(false)
    go(item.target_url)
  }

  const readAll = async () => {
    setItems((current) => current.map((item) => ({ ...item, read_at: item.read_at || new Date().toISOString() })))
    setUnread(0)
    try { await adminNotificationsRequest({ action: 'read-all' }) } catch { load({ quiet: true }) }
  }

  return <div className="admin-notifications" ref={rootRef}>
    <button className="admin-notification-trigger" type="button" aria-label={`Notifikácie${unread ? `, ${unread} neprečítaných` : ''}`} aria-expanded={open} onClick={() => setOpen((value) => !value)}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg>
      {unread > 0 && <span>{unread > 99 ? '99+' : unread}</span>}
    </button>
    {open && <section className="admin-notification-panel" aria-label="Admin notifikácie">
      <header><div><span>AKTIVITY</span><h2>Notifikácie</h2></div>{unread > 0 && <button type="button" onClick={readAll}>Označiť všetko</button>}</header>
      <div className="admin-notification-list">
        {loading ? <p className="admin-notification-state">Načítavam…</p> : error ? <p className="admin-notification-state is-error">{error}<button type="button" onClick={() => load()}>Skúsiť znova</button></p> : items.length === 0 ? <p className="admin-notification-state">Zatiaľ tu nie sú žiadne aktivity.</p> : items.map((item) => <button type="button" className={item.read_at ? 'admin-notification-item' : 'admin-notification-item is-unread'} onClick={() => openItem(item)} key={item.id}>
          <i>{iconFor(item.type)}</i><span><strong>{item.title}</strong><small>{item.message}</small><time>{relativeTime(item.created_at)}</time></span>{!item.read_at && <em aria-label="Neprečítané" />}
        </button>)}
      </div>
    </section>}
  </div>
}
