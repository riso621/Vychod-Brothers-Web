import { useEffect, useState } from 'react'
import { useProfile } from '../context/profile-context'
import { getMembershipUsers } from '../lib/admin-memberships'
import { membershipLabels, membershipStatusLabels } from '../lib/membership'

function date(value) { return value ? new Intl.DateTimeFormat('sk-SK',{dateStyle:'medium'}).format(new Date(value)) : 'Bez expirácie' }

function MembershipUser({ user }) {
  const stripeManaged = Boolean(user.stripe_subscription_id)
  const identity = user.username || user.email || user.id
  const status = user.stripe_cancel_at_period_end ? 'Cancel scheduled' : user.stripe_subscription_status || membershipStatusLabels[user.membership_status]
  return <article className="admin-member-row"><div className="admin-member-person"><span>{identity.slice(0,2).toUpperCase()}</span><div><strong>{identity}</strong><small>{user.username ? user.email : user.id}</small></div></div><div><small>PLÁN</small><strong>{membershipLabels[user.membership]}</strong></div><div><small>PLATNOSŤ</small><strong>{date(user.membership_expires_at)}</strong></div><div className="admin-member-state"><span className={`is-${user.membership_status}`}>{status}</span><small>{stripeManaged ? 'Riadené Stripe · zmena plánu iba cez billing flow' : 'Manuálne členstvo nie je v admin UI povolené'}</small></div></article>
}

export default function AdminMembershipsDashboard() {
  const { session, authLoading } = useProfile()
  const [users,setUsers]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState('')
  const isAdmin=session?.user?.app_metadata?.role==='admin'
  useEffect(()=>{if(authLoading)return;if(!isAdmin){setLoading(false);return}getMembershipUsers().then(setUsers).catch((e)=>setError(e.message)).finally(()=>setLoading(false))},[authLoading,isAdmin])
  if(authLoading||loading)return <section className="admin-videos"><p className="admin-videos-status">Načítavam členstvá…</p></section>
  if(!isAdmin)return <section className="admin-videos"><div className="admin-videos-status is-error">Nemáte oprávnenie.</div></section>
  return <section className="admin-videos admin-memberships"><header className="admin-videos-heading"><div><span>ADMIN / ČLENSTVÁ</span><h1>Členstvá</h1><p>Stripe členstvá sú read-only. Autoritou zostáva Stripe webhook.</p></div></header>{error&&<p className="admin-videos-status is-error">{error}</p>}<div className="admin-members-list">{users.map((u)=><MembershipUser user={u} key={u.id}/>)}</div></section>
}
