import { useEffect } from 'react'
import { useProfile } from '../context/profile-context'
import { formatMembershipDate, getEffectiveMembership, getMembershipStatus, membershipLabels, membershipPlans, membershipStatusLabels } from '../lib/membership'

const accountCards = [
  { icon: '◆', title: 'Moje členstvo', text: 'Prehľad aktuálneho plánu, stavu a platnosti.' },
  { icon: '▶', title: 'Moje videá', text: 'Obsah dostupný pre tvoju úroveň účtu.' },
  { icon: '◉', title: 'Nastavenia účtu', text: 'Údaje a zabezpečenie účtu.' },
  { icon: '↗', title: 'História členstva', text: 'Prehľad budúcich zmien členstva.' },
]

export default function AccountDashboard() {
  const { session, profile, authLoading, profileLoading, profileError } = useProfile()
  useEffect(() => { if (!authLoading && !session) window.location.replace('/?auth=login&next=/account') }, [authLoading, session])
  if (authLoading || (!session && !authLoading)) return <section className="account-state" aria-live="polite">Overujem prihlásenie…</section>
  if (profileLoading) return <section className="account-state" aria-live="polite">Načítavam tvoj profil…</section>
  if (profileError || !profile) return <section className="account-state account-state-error" role="alert"><h1>Profil nie je dostupný</h1><p>{profileError || 'Profil sa zatiaľ nenašiel.'}</p></section>

  const displayName = profile.username || session.user.email?.split('@')[0] || 'Člen'
  const initials = displayName.slice(0, 2).toUpperCase()
  const effectiveMembership = getEffectiveMembership(profile)
  const membershipStatus = getMembershipStatus(profile)
  const plan = membershipPlans.find((item) => item.id === effectiveMembership) || membershipPlans[0]

  return (
    <section className="account-dashboard" aria-labelledby="account-heading">
      <div className="account-heading"><span className="account-eyebrow">VÝCHOD BROTHERS / ÚČET</span><h1 id="account-heading">Môj účet</h1><p>Tvoj prístup k videám, benefitom a svetu Východ Brothers.</p></div>
      <article className="account-profile">
        <div className="account-avatar" aria-label={`Avatar používateľa ${displayName}`}>{profile.avatar_url ? <img src={profile.avatar_url} alt="" /> : <span aria-hidden="true">{initials}</span>}</div>
        <div className="account-identity"><span>Profil</span><h2>{displayName}</h2><strong className={`membership-account-badge is-${effectiveMembership}`}>{membershipLabels[effectiveMembership]}</strong></div>
        <dl className="account-details"><div><dt>Stav členstva</dt><dd>{membershipStatusLabels[membershipStatus]}</dd></div><div><dt>Platnosť</dt><dd>{formatMembershipDate(profile.membership_expires_at)}</dd></div><div><dt>Začiatok</dt><dd>{formatMembershipDate(profile.membership_started_at)}</dd></div></dl>
      </article>
      <section className="account-membership-benefits" aria-labelledby="account-benefits-heading"><div><span>AKTUÁLNY PLÁN</span><h2 id="account-benefits-heading">{plan.name}</h2><p>{plan.description}</p></div><ul>{plan.perks.map((perk) => <li key={perk}>✓ {perk}</li>)}</ul>{effectiveMembership === 'free' && <a href="/clenstvo">Staň sa členom <span aria-hidden="true">→</span></a>}</section>
      <div className="account-grid" aria-label="Možnosti účtu">{accountCards.map((card) => <article className="account-card" key={card.title}><span className="account-card-icon" aria-hidden="true">{card.icon}</span><div><h2>{card.title}</h2><p>{card.text}</p></div><span className="account-card-status">Pripravujeme</span></article>)}</div>
    </section>
  )
}
