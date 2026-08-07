import { useEffect, useState } from 'react'
import { useProfile } from '../context/profile-context'
import { formatMembershipDate, getEffectiveMembership, getMembershipStatus, membershipLabels, membershipPlans, membershipStatusLabels } from '../lib/membership'
import { createCustomerPortalSession } from '../lib/billing'

const accountCards = [
  { icon: '◆', title: 'Moje členstvo', text: 'Prehľad aktuálneho plánu, stavu a platnosti.' },
  { icon: '▶', title: 'Moje videá', text: 'Obsah dostupný pre tvoju úroveň účtu.' },
  { icon: '◉', title: 'Nastavenia účtu', text: 'Údaje a zabezpečenie účtu.' },
  { icon: '↗', title: 'História členstva', text: 'Prehľad budúcich zmien členstva.' },
]

export default function AccountDashboard() {
  const [signingOut, setSigningOut] = useState(false)
  const [portalLoading, setPortalLoading] = useState(false)
  const [billingMessage, setBillingMessage] = useState('')
  const { session, profile, authLoading, profileLoading, profileError, refreshProfile, signOut } = useProfile()
  const checkoutState = new URLSearchParams(window.location.search).get('checkout')
  useEffect(() => { if (!authLoading && !session && !signingOut) window.location.replace('/?auth=login&next=/account') }, [authLoading, session, signingOut])
  useEffect(() => {
    if (checkoutState !== 'success' || !session) return undefined
    refreshProfile()
    const timer = window.setInterval(refreshProfile, 2500)
    const stop = window.setTimeout(() => window.clearInterval(timer), 20000)
    return () => { window.clearInterval(timer); window.clearTimeout(stop) }
  }, [checkoutState, session, refreshProfile])
  if (signingOut) return <section className="account-state" aria-live="polite">Bezpečne ťa odhlasujem…</section>
  if (authLoading || (!session && !authLoading)) return <section className="account-state" aria-live="polite">Overujem prihlásenie…</section>
  if (profileLoading) return <section className="account-state" aria-live="polite">Načítavam tvoj profil…</section>
  if (profileError || !profile) return <section className="account-state account-state-error" role="alert"><h1>Profil nie je dostupný</h1><p>{profileError || 'Profil sa zatiaľ nenašiel.'}</p><button className="account-retry" type="button" onClick={refreshProfile}>Skúsiť znova</button></section>

  const displayName = profile.username || session.user.email?.split('@')[0] || 'Člen'
  const initials = displayName.slice(0, 2).toUpperCase()
  const effectiveMembership = getEffectiveMembership(profile)
  const storedMembership = membershipLabels[profile.membership] || membershipLabels.free
  const membershipStatus = getMembershipStatus(profile)
  const plan = membershipPlans.find((item) => item.id === effectiveMembership) || membershipPlans[0]
  const emailStatus = session.user.email_confirmed_at ? 'Overený' : 'Čaká na overenie'

  const handleSignOut = async () => {
    if (signingOut) return
    setSigningOut(true)
    await signOut()
    window.location.replace('/')
  }

  const handlePortal = async () => {
    if (portalLoading) return
    setPortalLoading(true)
    setBillingMessage('')
    try {
      window.location.assign(await createCustomerPortalSession())
    } catch (error) {
      setBillingMessage(error.message || 'Správa predplatného momentálne nie je dostupná.')
      setPortalLoading(false)
    }
  }

  return (
    <section className="account-dashboard" aria-labelledby="account-heading">
      <div className="account-heading"><div><span className="account-eyebrow">VÝCHOD BROTHERS / ÚČET</span><h1 id="account-heading">Môj účet</h1><p>Tvoj prístup k videám, benefitom a svetu Východ Brothers.</p></div><button className="account-signout" type="button" onClick={handleSignOut} disabled={signingOut}>{signingOut ? 'Odhlasujem…' : 'Odhlásiť sa'}</button></div>
      {checkoutState === 'success' && <p className="account-billing-notice" role="status">Platba bola odoslaná. Čakáme na bezpečné potvrdenie zo Stripe; členstvo sa po webhooku automaticky synchronizuje.</p>}
      {billingMessage && <p className="account-billing-notice is-error" role="alert">{billingMessage}</p>}
      <article className="account-profile">
        <div className="account-avatar" aria-label={`Avatar používateľa ${displayName}`}>{profile.avatar_url ? <img src={profile.avatar_url} alt="" /> : <span aria-hidden="true">{initials}</span>}</div>
        <div className="account-identity"><span>Profil</span><h2>{displayName}</h2><p>{session.user.email}</p><strong className={`membership-account-badge is-${profile.membership}`}>{storedMembership}</strong></div>
        <dl className="account-details"><div><dt>Stav účtu</dt><dd>Aktívny</dd></div><div><dt>E-mail</dt><dd>{emailStatus}</dd></div><div><dt>Typ členstva</dt><dd>{storedMembership}</dd></div><div><dt>Stav členstva</dt><dd>{membershipStatusLabels[membershipStatus]}</dd></div><div><dt>Aktívny prístup</dt><dd>{membershipLabels[effectiveMembership]}</dd></div><div><dt>Platnosť</dt><dd>{formatMembershipDate(profile.membership_expires_at)}</dd></div><div><dt>Začiatok členstva</dt><dd>{formatMembershipDate(profile.membership_started_at)}</dd></div><div><dt>Registrácia</dt><dd>{formatMembershipDate(profile.created_at)}</dd></div></dl>
      </article>
      <section className="account-membership-benefits" aria-labelledby="account-benefits-heading"><div><span>AKTUÁLNY PLÁN</span><h2 id="account-benefits-heading">{plan.name}</h2><p>{plan.description}</p></div><ul>{plan.perks.map((perk) => <li key={perk}>✓ {perk}</li>)}</ul>{effectiveMembership === 'free' ? <a href="/clenstvo">Staň sa členom <span aria-hidden="true">→</span></a> : <button className="account-portal-button" type="button" onClick={handlePortal} disabled={portalLoading}>{portalLoading ? 'Otváram…' : 'Spravovať predplatné'}</button>}</section>
      <div className="account-grid" aria-label="Možnosti účtu">{accountCards.map((card) => <article className="account-card" key={card.title}><span className="account-card-icon" aria-hidden="true">{card.icon}</span><div><h2>{card.title}</h2><p>{card.text}</p></div><span className="account-card-status">Pripravujeme</span></article>)}</div>
    </section>
  )
}
