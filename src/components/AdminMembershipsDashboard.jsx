import { useEffect, useState } from 'react'
import { useProfile } from '../context/profile-context'
import { getMembershipUsers, updateMembership } from '../lib/admin-memberships'
import { membershipLabels, membershipStatusLabels } from '../lib/membership'

function toLocalInput(value) {
  if (!value) return ''
  const date = new Date(value)
  const offset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - offset).toISOString().slice(0, 10)
}

function MembershipUser({ user, onChanged }) {
  const [membership, setMembership] = useState(user.membership)
  const [status, setStatus] = useState(user.membership_status)
  const [expiresAt, setExpiresAt] = useState(toLocalInput(user.membership_expires_at))
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const save = async (nextStatus = status) => {
    setSaving(true); setMessage('')
    try {
      const updated = await updateMembership({ userId: user.id, membership, status: nextStatus, expiresAt: expiresAt ? new Date(`${expiresAt}T23:59:59.999`).toISOString() : null })
      setStatus(updated.membership_status); setExpiresAt(toLocalInput(updated.membership_expires_at)); setMessage('Uložené'); onChanged(updated)
    } catch (error) { setMessage(error.message) } finally { setSaving(false) }
  }
  return <article className="admin-member-row"><div className="admin-member-person"><span>{(user.username || user.email || 'VB').slice(0, 2).toUpperCase()}</span><div><strong>{user.username || 'Bez mena'}</strong><small>{user.email || user.id}</small></div></div><label>Plán<select value={membership} onChange={(e) => setMembership(e.target.value)}><option value="free">FREE</option><option value="member">MEMBER</option><option value="vip">VIP</option></select></label><label>Expirácia<input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} /></label><div className="admin-member-state"><span className={`is-${status}`}>{membershipLabels[membership]} · {membershipStatusLabels[status]}</span><div><button type="button" onClick={() => save('active')} disabled={saving}>Uložiť / obnoviť</button><button type="button" className="is-danger" onClick={() => save('cancelled')} disabled={saving}>Zrušiť</button></div>{message && <small role="status">{message}</small>}</div></article>
}

export default function AdminMembershipsDashboard() {
  const { session, authLoading } = useProfile()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const isAdmin = session?.user?.app_metadata?.role === 'admin'
  useEffect(() => {
    if (authLoading) return
    if (!isAdmin) { setLoading(false); return }
    getMembershipUsers().then(setUsers).catch((err) => setError(err.message)).finally(() => setLoading(false))
  }, [authLoading, isAdmin])
  if (authLoading || loading) return <section className="admin-videos"><p className="admin-videos-status">Načítavam členstvá…</p></section>
  if (!isAdmin) return <section className="admin-videos"><div className="admin-videos-status is-error" role="alert">Nemáte oprávnenie.</div></section>
  return <section className="admin-videos admin-memberships"><header className="admin-videos-heading"><div><span>ADMIN / ČLENSTVÁ</span><h1>Členstvá</h1><p>Správa úrovní, expirácie a stavu používateľských účtov.</p></div><a href="/admin/videos">Správa videí →</a></header>{error && <p className="admin-videos-status is-error" role="alert">{error}</p>}<div className="admin-members-list">{users.map((user) => <MembershipUser user={user} key={user.id} onChanged={(updated) => setUsers((current) => current.map((item) => item.id === updated.id ? { ...item, ...updated } : item))} />)}</div></section>
}
