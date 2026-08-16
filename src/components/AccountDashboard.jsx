import { useEffect, useRef, useState } from 'react'
import { useProfile } from '../context/profile-context'
import { clubPlan, customerMembershipLabel, formatMembershipDate, getEffectiveMembership, getMembershipStatus, membershipStatusLabels } from '../lib/membership'
import { createCustomerPortalSession, syncCustomerPortalSubscription } from '../lib/billing'
import { checkoutCleanPath, confirmedCheckoutMessage, pollConfirmedMembership } from '../lib/account-checkout'
import { readPortalMarker, reconcilePortalProfile, writePortalMarker } from '../lib/account-portal'

const accountCards = [
  { icon: '◆', title: 'Moje členstvo', text: 'Prehľad aktuálneho plánu, stavu a platnosti.' },
  { icon: '▶', title: 'Moje videá', text: 'Obsah dostupný pre tvoju úroveň účtu.' },
  { icon: '◉', title: 'Nastavenia účtu', text: 'Údaje a zabezpečenie účtu.' },
  { icon: '↗', title: 'História členstva', text: 'Prehľad budúcich zmien členstva.' },
]

const portalReturnKey = 'vb-billing-portal-return'

export default function AccountDashboard() {
  const [signingOut, setSigningOut] = useState(false)
  const [portalLoading, setPortalLoading] = useState(false)
  const [billingMessage, setBillingMessage] = useState('')
  const [checkoutNotice, setCheckoutNotice] = useState('')
  const subscriptionSyncRef = useRef('')
  const { session, profile, authLoading, profileLoading, profileError, refreshProfile, signOut } = useProfile()
  const checkoutState = useRef(new URLSearchParams(window.location.search).get('checkout')).current
  const portalReturn = useRef(new URLSearchParams(window.location.search).get('billing') === 'portal').current
  useEffect(() => { if (!authLoading && !session && !signingOut) window.location.replace('/?auth=login&next=/account') }, [authLoading, session, signingOut])
  useEffect(() => {
    if (checkoutState !== 'success' || !session) return undefined
    const controller = new AbortController()
    let hideTimer
    setCheckoutNotice('Platbu overujeme…')

    pollConfirmedMembership(refreshProfile, { signal: controller.signal }).then((confirmedProfile) => {
      if (controller.signal.aborted) return
      if (confirmedProfile) {
        setCheckoutNotice(confirmedCheckoutMessage(confirmedProfile))
        window.history.replaceState(window.history.state, '', checkoutCleanPath(window.location.href))
        hideTimer = window.setTimeout(() => setCheckoutNotice(''), 5000)
        return
      }
      setCheckoutNotice('Platba bola prijatá. Potvrdenie členstva ešte spracúvame. Skús účet o chvíľu obnoviť.')
    })

    return () => {
      controller.abort()
      window.clearTimeout(hideTimer)
    }
  }, [checkoutState, session, refreshProfile])
  useEffect(() => {
    if (!session?.user?.id || !profile?.stripe_subscription_id) return undefined
    const syncKey = `${session.user.id}:${profile.stripe_subscription_id}`
    if (subscriptionSyncRef.current === syncKey) return undefined
    subscriptionSyncRef.current = syncKey
    let active = true
    syncCustomerPortalSubscription()
      .then(() => active && refreshProfile({ silent: true }))
      .catch(() => undefined)
    return () => { active = false }
  }, [session?.user?.id, profile?.stripe_subscription_id, refreshProfile])
  useEffect(() => {
    if (!session || (!portalReturn && !sessionStorage.getItem(portalReturnKey))) return undefined
    const marker = readPortalMarker(sessionStorage, session.user.id)
    sessionStorage.removeItem(portalReturnKey)
    if (portalReturn) window.history.replaceState(window.history.state, '', checkoutCleanPath(window.location.href))
    const controller = new AbortController()
    let hideTimer
    setBillingMessage('Aktualizujem stav predplatného…')

    const reconcilePortalChange = async () => {
      const result = await reconcilePortalProfile(refreshProfile, marker?.profileSignature || '', { signal: controller.signal })
      if (controller.signal.aborted) return
      setBillingMessage(result.changed
        ? 'Stav predplatného bol aktualizovaný.'
        : 'Stav predplatného sme obnovili. Zmena zo Stripe sa môže ešte krátko spracúvať.')
      hideTimer = window.setTimeout(() => setBillingMessage(''), 5000)
    }

    reconcilePortalChange()
    return () => { controller.abort(); window.clearTimeout(hideTimer) }
  }, [session, refreshProfile, portalReturn])
  if (signingOut) return <section className="account-state" aria-live="polite">Bezpečne ťa odhlasujem…</section>
  if (authLoading || (!session && !authLoading)) return <section className="account-state" aria-live="polite">Overujem prihlásenie…</section>
  if (profileLoading) return <section className="account-state" aria-live="polite">Načítavam tvoj profil…</section>
  if (profileError || !profile) return <section className="account-state account-state-error" role="alert"><h1>Profil nie je dostupný</h1><p>{profileError || 'Profil sa zatiaľ nenašiel.'}</p><button className="account-retry" type="button" onClick={refreshProfile}>Skúsiť znova</button></section>

  const displayName = profile.username || session.user.email?.split('@')[0] || 'Člen'
  const initials = displayName.slice(0, 2).toUpperCase()
  const effectiveMembership = getEffectiveMembership(profile)
  const storedMembership = customerMembershipLabel(profile)
  const membershipStatus = getMembershipStatus(profile)
  const hasPaidAccess = ['member', 'vip'].includes(effectiveMembership)
  const plan = hasPaidAccess ? { ...clubPlan, description: 'Všetky členské videá a funkcie v jednom predplatnom.' } : { name: 'BEZ ČLENSTVA', description: 'Účet je pripravený na aktiváciu členstva.', perks: ['Verejný obsah a trailery bez predplatného'] }
  const planPrice = hasPaidAccess
    ? profile.membership_plan === 'club' ? '5,99 € / mesiac' : profile.membership_plan === 'vip' ? '9,99 € / mesiac (historický plán)' : '4,99 € / mesiac (historický plán)'
    : '—'
  const emailStatus = session.user.email_confirmed_at ? 'Overený' : 'Čaká na overenie'
  const cancellationScheduled = hasPaidAccess && profile.stripe_cancel_at_period_end === true

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
      const portalUrl = await createCustomerPortalSession()
      writePortalMarker(sessionStorage, profile, session.user.id)
      window.location.assign(portalUrl)
    } catch (error) {
      setBillingMessage(error.message || 'Správa predplatného momentálne nie je dostupná.')
      setPortalLoading(false)
    }
  }

  return (
    <section className="account-dashboard" aria-labelledby="account-heading">
      <div className="account-heading"><div><span className="account-eyebrow">VÝCHOD BROTHERS / ÚČET</span><h1 id="account-heading">Môj účet</h1><p>Tvoj prístup k videám, benefitom a svetu Východ Brothers.</p></div><button className="account-signout" type="button" onClick={handleSignOut} disabled={signingOut}>{signingOut ? 'Odhlasujem…' : 'Odhlásiť sa'}</button></div>
      {checkoutNotice && <p className="account-billing-notice" role="status" aria-live="polite">{checkoutNotice}</p>}
      {billingMessage && <p className="account-billing-notice is-error" role="alert">{billingMessage}</p>}
      {cancellationScheduled && <aside className="account-cancellation-notice" aria-labelledby="account-cancellation-heading"><div><span>AUTOMATICKÉ OBNOVENIE · ZRUŠENÉ</span><h2 id="account-cancellation-heading">Predplatné je zrušené</h2></div><p>Tvoj prístup do Východ Brothers Club zostáva aktívny do <strong>{formatMembershipDate(profile.membership_expires_at)}</strong>. Po tomto dátume sa predplatné automaticky neobnoví.</p></aside>}
      <article className="account-profile">
        <div className="account-avatar" aria-label={`Avatar používateľa ${displayName}`}>{profile.avatar_url ? <img src={profile.avatar_url} alt="" /> : <span aria-hidden="true">{initials}</span>}</div>
        <div className="account-identity"><span>Profil</span><h2>{displayName}</h2><p>{session.user.email}</p><strong className={`membership-account-badge is-${profile.membership}`}>{storedMembership}</strong></div>
        <dl className="account-details"><div><dt>Stav účtu</dt><dd>Aktívny</dd></div><div><dt>E-mail</dt><dd>{emailStatus}</dd></div><div><dt>Členstvo</dt><dd>{storedMembership}</dd></div><div><dt>Cena plánu</dt><dd>{planPrice}</dd></div><div><dt>Stav členstva</dt><dd>{membershipStatusLabels[membershipStatus]}</dd></div><div><dt>Aktívny prístup</dt><dd>{hasPaidAccess ? 'Všetok členský obsah' : 'Verejný obsah a trailery'}</dd></div><div><dt>{hasPaidAccess ? (cancellationScheduled ? 'Členstvo aktívne do' : 'Ďalšie obnovenie') : 'Platnosť'}</dt><dd>{hasPaidAccess ? formatMembershipDate(profile.membership_expires_at) : '—'}</dd></div>{hasPaidAccess && <div><dt>Automatické obnovenie</dt><dd className={cancellationScheduled ? 'is-cancelled' : ''}>{cancellationScheduled ? 'Zrušené' : 'Aktívne'}</dd></div>}<div><dt>Začiatok členstva</dt><dd>{formatMembershipDate(profile.membership_started_at)}</dd></div><div><dt>Registrácia</dt><dd>{formatMembershipDate(profile.created_at)}</dd></div></dl>
      </article>
      <section className="account-membership-benefits" aria-labelledby="account-benefits-heading"><div><span>{hasPaidAccess ? 'AKTÍVNE ČLENSTVO' : 'ÚČET BEZ ČLENSTVA'}</span><h2 id="account-benefits-heading">{plan.name}</h2><p>{plan.description}</p></div><ul>{plan.perks.map((perk) => <li key={perk}>✓ {perk}</li>)}</ul>{!hasPaidAccess ? <a href="/clenstvo">Stať sa členom – 5,99 € / mesiac <span aria-hidden="true">→</span></a> : <div className="account-membership-actions"><a href="/videos">Pozrieť členské videá</a><button className="account-portal-button" type="button" onClick={handlePortal} disabled={portalLoading}>{portalLoading ? 'Otváram…' : 'Spravovať predplatné'}</button></div>}</section>
      <div className="account-grid" aria-label="Možnosti účtu">{accountCards.map((card) => <article className="account-card" key={card.title}><span className="account-card-icon" aria-hidden="true">{card.icon}</span><div><h2>{card.title}</h2><p>{card.text}</p></div><span className="account-card-status">Pripravujeme</span></article>)}</div>
    </section>
  )
}
