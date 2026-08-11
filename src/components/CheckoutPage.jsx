import { useCallback, useEffect, useRef, useState } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import { useProfile } from '../context/profile-context'
import { confirmVipUpgrade, createCheckoutSession, createCustomerPortalSession, getVipUpgradePreview, getVipUpgradeStatus } from '../lib/billing'
import { classifyVipUpgradeState, clearCheckoutMarker, readCheckoutMarker, writeCheckoutMarker } from '../lib/checkout-flow'
import { formatMembershipDate, getEffectiveMembership } from '../lib/membership'

const planDetails = {
  member: { name: 'MEMBER', price: '4,99 €', description: 'Mesačné členstvo Východ Brothers s prístupom k exkluzívnemu obsahu pre členov.' },
  vip: { name: 'VIP', price: '9,99 €', description: 'Najvyššie členstvo so všetkým MEMBER obsahom a exkluzívnymi VIP premiérami.' },
}

const appearance = {
  theme: 'night',
  variables: {
    colorPrimary: '#e3dc00', colorBackground: '#111212', colorText: '#f3f1e8',
    colorTextSecondary: '#aaa99f', colorDanger: '#ff8f86',
    fontFamily: 'Inter, system-ui, sans-serif', borderRadius: '12px', spacingUnit: '4px',
  },
  rules: {
    '.Input': { border: '1px solid rgba(255,255,255,.14)', boxShadow: 'none', padding: '14px' },
    '.Input:focus': { borderColor: '#e3dc00', boxShadow: '0 0 0 1px #e3dc00' },
    '.Tab': { border: '1px solid rgba(255,255,255,.14)', boxShadow: 'none' },
    '.Tab--selected': { borderColor: '#e3dc00', boxShadow: '0 0 0 1px #e3dc00' },
    '.Label': { fontWeight: '600' },
  },
}

const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY?.trim() || ''
const stripePromise = publishableKey ? loadStripe(publishableKey) : null
const pollingDelayMs = 1250
const pollingAttempts = 16

function initialCheckoutFlow() {
  const hasMarker = Boolean(sessionStorage.getItem('vb-checkout-payment-flow'))
  const isStripeReturn = new URLSearchParams(window.location.search).get('payment') === 'return'
  return hasMarker || isStripeReturn ? 'restoring' : 'payment'
}

function membershipConfirmed(profile, plan) {
  return profile?.membership === plan
    && profile?.membership_status === 'active'
    && ['active', 'trialing', 'past_due'].includes(profile?.stripe_subscription_status || '')
}

function friendlyPaymentError(error) {
  if (error?.type === 'card_error' || error?.type === 'validation_error') {
    return error.message || 'Platobné údaje nie sú platné. Skontroluj ich a skús to znova.'
  }
  return 'Platbu sa nepodarilo dokončiť. Skús to prosím znova.'
}

export default function CheckoutPage({ plan }) {
  const { session, profile, authLoading, profileLoading, refreshProfile } = useProfile()
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [portalLoading, setPortalLoading] = useState(false)
  const [upgradePreview, setUpgradePreview] = useState(null)
  const [upgradeLoading, setUpgradeLoading] = useState(false)
  const [upgradeAttempt, setUpgradeAttempt] = useState(0)
  const [upgradeClientSecret, setUpgradeClientSecret] = useState('')
  const [upgradePaymentStatus, setUpgradePaymentStatus] = useState('')
  const [upgradePaymentReady, setUpgradePaymentReady] = useState(false)
  const [upgradeBackendStatus, setUpgradeBackendStatus] = useState('')
  const [flow, setFlow] = useState(initialCheckoutFlow)
  const elementsRef = useRef(null)
  const requestRef = useRef(null)
  const mountRef = useRef(null)
  const upgradePreviewRequestedRef = useRef(false)
  const upgradeElementsRef = useRef(null)
  const upgradeMountRef = useRef(null)
  const upgradeSubmitRef = useRef(false)
  const details = planDetails[plan]
  const activeSubscription = Boolean(profile?.stripe_subscription_id)
    && ['active', 'trialing', 'past_due'].includes(profile?.stripe_subscription_status || '')
  const currentMembership = getEffectiveMembership(profile)
  const isVipUpgrade = plan === 'vip' && currentMembership === 'member' && activeSubscription
  const markerKind = isVipUpgrade ? 'vip-upgrade' : 'subscription-payment'

  const clearFlowMarker = useCallback(() => clearCheckoutMarker(sessionStorage), [])
  const storeFlowMarker = useCallback((status = 'verifying') => {
    if (!session?.user?.id) return
    writeCheckoutMarker(sessionStorage, { plan, userId: session.user.id, kind: markerKind, status })
  }, [markerKind, plan, session?.user?.id])

  useEffect(() => {
    if (!authLoading && !session) window.location.replace(`/?auth=login&next=${encodeURIComponent(`/checkout/${plan}`)}`)
  }, [authLoading, session, plan])

  useEffect(() => {
    if (flow !== 'restoring' || !session || profileLoading) return undefined
    let active = true
    const restoreServerState = async () => {
      const marker = readCheckoutMarker(sessionStorage, plan, session.user.id)
      const isStripeReturn = new URLSearchParams(window.location.search).get('payment') === 'return'
      if (!marker && !isStripeReturn) {
        if (active) setFlow('payment')
        return
      }
      if (membershipConfirmed(profile, plan)) {
        storeFlowMarker('success')
        if (active) setFlow('success')
        return
      }
      if (plan !== 'vip') {
        if (active) setFlow('verifying')
        return
      }
      try {
        const status = await getVipUpgradeStatus()
        if (!active) return
        setUpgradeBackendStatus(status.status || '')
        const restoredState = classifyVipUpgradeState({
          vipActive: membershipConfirmed(profile, plan),
          status: status.status,
          hasClientSecret: Boolean(status.clientSecret),
        })
        if (restoredState === 'payment') {
          clearFlowMarker()
          setUpgradeClientSecret(status.clientSecret)
          setUpgradePaymentStatus(status.paymentStatus || 'requires_action')
          setFlow('payment')
        } else if (restoredState === 'verifying') {
          storeFlowMarker()
          setFlow('verifying')
        } else if (restoredState === 'success') {
          storeFlowMarker('success')
          setFlow('success')
        } else {
          clearFlowMarker()
          setFlow('payment')
        }
      } catch (restoreError) {
        if (!active) return
        clearFlowMarker()
        setError(restoreError.message || 'Stav prechodu na VIP sa nepodarilo overiť.')
        setFlow('retry')
      }
    }
    restoreServerState()
    return () => { active = false }
  }, [flow, session, profileLoading, profile, plan, clearFlowMarker, storeFlowMarker])

  useEffect(() => {
    if (flow !== 'payment' || !stripePromise || !session || profileLoading || activeSubscription || !details) return undefined
    let cancelled = false
    let paymentElement

    const mountPaymentElement = async () => {
      setError('')
      setReady(false)
      try {
        const stripe = await stripePromise
        if (!stripe) throw new Error('Stripe.js sa nepodarilo načítať.')
        if (!requestRef.current) requestRef.current = createCheckoutSession(plan)
        const clientSecret = await requestRef.current
        if (!/^pi_[A-Za-z0-9_]+_secret_/.test(clientSecret)) throw new Error('Stripe vrátil neplatný platobný token.')
        if (cancelled || !mountRef.current) return
        const elements = stripe.elements({ clientSecret, appearance, loader: 'auto' })
        paymentElement = elements.create('payment', { layout: { type: 'tabs', defaultCollapsed: false } })
        paymentElement.on('ready', () => !cancelled && setReady(true))
        paymentElement.on('loaderror', () => !cancelled && setError('Platobný formulár sa nepodarilo načítať. Skús to prosím znova.'))
        paymentElement.mount(mountRef.current)
        elementsRef.current = elements
      } catch (checkoutError) {
        requestRef.current = null
        if (!cancelled) {
          console.error('Payment Element initialization failed', { name: checkoutError?.name || 'Error', message: checkoutError?.message || 'unknown' })
          setError(checkoutError?.message || 'Stripe platobný formulár sa nepodarilo načítať.')
        }
      }
    }

    mountPaymentElement()
    return () => {
      cancelled = true
      paymentElement?.destroy()
      elementsRef.current = null
    }
  }, [plan, session, profileLoading, activeSubscription, details, attempt, flow])

  useEffect(() => {
    if (flow !== 'verifying' || !session || !details) return undefined
    const controller = new AbortController()

    const verifyMembership = async () => {
      for (let attemptIndex = 0; attemptIndex < pollingAttempts && !controller.signal.aborted; attemptIndex += 1) {
        const [latestProfile, latestUpgrade] = await Promise.all([
          refreshProfile({ silent: true }),
          plan === 'vip' ? getVipUpgradeStatus().catch(() => null) : Promise.resolve(null),
        ])
        if (controller.signal.aborted) return
        if (latestUpgrade?.status) setUpgradeBackendStatus(latestUpgrade.status)
        if (latestUpgrade?.status === 'requires_payment' && latestUpgrade.clientSecret) {
          clearFlowMarker()
          setUpgradeClientSecret(latestUpgrade.clientSecret)
          setUpgradePaymentStatus(latestUpgrade.paymentStatus || 'requires_action')
          setFlow('payment')
          return
        }
        if (membershipConfirmed(latestProfile, plan)) {
          storeFlowMarker('success')
          window.history.replaceState(window.history.state, '', `/checkout/${plan}`)
          setFlow('success')
          return
        }
        if (plan === 'vip' && latestUpgrade?.status === 'ready') {
          clearFlowMarker()
          setFlow('retry')
          return
        }
        if (attemptIndex < pollingAttempts - 1) {
          await new Promise((resolve) => {
            const timer = window.setTimeout(resolve, pollingDelayMs)
            controller.signal.addEventListener('abort', () => {
              window.clearTimeout(timer)
              resolve()
            }, { once: true })
          })
        }
      }
      if (!controller.signal.aborted) {
        if (plan === 'vip') {
          const finalStatus = await getVipUpgradeStatus().catch(() => null)
          if (controller.signal.aborted) return
          if (!finalStatus || finalStatus.status === 'ready') {
            clearFlowMarker()
            setFlow('retry')
            return
          }
          if (finalStatus.status === 'requires_payment' && finalStatus.clientSecret) {
            clearFlowMarker()
            setUpgradeClientSecret(finalStatus.clientSecret)
            setUpgradePaymentStatus(finalStatus.paymentStatus || 'requires_action')
            setFlow('payment')
            return
          }
        }
        setFlow('pending')
      }
    }

    verifyMembership()
    return () => controller.abort()
  }, [flow, session, details, plan, refreshProfile, clearFlowMarker, storeFlowMarker])

  useEffect(() => {
    if (flow === 'success' && !profileLoading && !membershipConfirmed(profile, plan)) setFlow('verifying')
  }, [flow, profileLoading, profile, plan])

  const submitPayment = async (event) => {
    event.preventDefault()
    if (submitting || !elementsRef.current || !stripePromise) return
    setSubmitting(true)
    setError('')
    storeFlowMarker()
    try {
      const stripe = await stripePromise
      const { error: paymentError } = await stripe.confirmPayment({
        elements: elementsRef.current,
        confirmParams: { return_url: `${window.location.origin}/checkout/${plan}?payment=return` },
        redirect: 'if_required',
      })
      if (paymentError) throw paymentError
      setFlow('verifying')
    } catch (paymentError) {
      clearFlowMarker()
      setError(friendlyPaymentError(paymentError))
      setSubmitting(false)
    }
  }

  const retry = () => { requestRef.current = null; setError(''); setAttempt((value) => value + 1) }
  const openPortal = async () => {
    if (portalLoading) return
    setPortalLoading(true)
    setError('')
    try { window.location.assign(await createCustomerPortalSession()) }
    catch (portalError) { setError(portalError.message || 'Správa predplatného momentálne nie je dostupná.'); setPortalLoading(false) }
  }

  useEffect(() => {
    if (!isVipUpgrade || flow !== 'payment' || upgradePreviewRequestedRef.current) return undefined
    upgradePreviewRequestedRef.current = true
    let active = true
    setUpgradeLoading(true)
    setError('')
    getVipUpgradePreview()
      .then((preview) => {
        if (!active) return
        if (preview.status === 'requires_payment' && preview.clientSecret) {
          clearFlowMarker()
          setFlow('payment')
          setUpgradeClientSecret(preview.clientSecret)
          setUpgradePaymentStatus(preview.paymentStatus || 'requires_action')
          return
        }
        if (['processing', 'waiting_for_subscription', 'updated'].includes(preview.status)) {
          setUpgradeBackendStatus(preview.status)
          storeFlowMarker()
          setFlow('verifying')
          return
        }
        setUpgradePreview(preview)
      })
      .catch((previewError) => {
        if (active) {
          upgradePreviewRequestedRef.current = false
          setError(previewError.message || 'Náhľad upgradu sa nepodarilo načítať.')
        }
      })
      .finally(() => active && setUpgradeLoading(false))
    return () => { active = false }
  }, [isVipUpgrade, upgradeAttempt, flow, clearFlowMarker, storeFlowMarker])

  useEffect(() => {
    if (!upgradeClientSecret || !stripePromise) return undefined
    if (upgradePaymentStatus !== 'requires_payment_method') {
      setUpgradePaymentReady(true)
      return undefined
    }
    if (!upgradeMountRef.current) return undefined
    let cancelled = false
    let paymentElement
    const mountUpgradePayment = async () => {
      setUpgradePaymentReady(false)
      const stripe = await stripePromise
      if (!stripe || cancelled || !upgradeMountRef.current) return
      const elements = stripe.elements({ clientSecret: upgradeClientSecret, appearance, loader: 'auto' })
      paymentElement = elements.create('payment', { layout: { type: 'tabs', defaultCollapsed: false } })
      paymentElement.on('ready', () => !cancelled && setUpgradePaymentReady(true))
      paymentElement.on('loaderror', () => !cancelled && setError('Platobný formulár upgradu sa nepodarilo načítať.'))
      paymentElement.mount(upgradeMountRef.current)
      upgradeElementsRef.current = elements
    }
    mountUpgradePayment()
    return () => {
      cancelled = true
      paymentElement?.destroy()
      upgradeElementsRef.current = null
    }
  }, [upgradeClientSecret, upgradePaymentStatus])

  const submitUpgrade = async () => {
    if (upgradeSubmitRef.current || upgradeLoading || !upgradePreview?.prorationDate) return
    upgradeSubmitRef.current = true
    setUpgradeLoading(true)
    setError('')
    try {
      const result = await confirmVipUpgrade(upgradePreview.prorationDate)
      if (result.status === 'requires_payment' && result.clientSecret) {
        setUpgradeClientSecret(result.clientSecret)
        setUpgradePaymentStatus(result.paymentStatus || 'requires_action')
        setUpgradePreview(null)
      } else {
        if (!['processing', 'waiting_for_subscription', 'updated'].includes(result.status)) {
          throw new Error('Stripe nepotvrdil začatie prechodu na VIP.')
        }
        setUpgradeBackendStatus(result.status || '')
        storeFlowMarker()
        setFlow('verifying')
      }
    } catch (upgradeError) {
      setError(upgradeError.message || 'Prechod na VIP sa nepodarilo dokončiť.')
      setUpgradePreview(null)
      upgradePreviewRequestedRef.current = false
    } finally { upgradeSubmitRef.current = false; setUpgradeLoading(false) }
  }
  const retryUpgradePreview = () => {
    upgradePreviewRequestedRef.current = false
    setUpgradeAttempt((value) => value + 1)
  }
  const submitUpgradePayment = async () => {
    if (!upgradePaymentReady || !stripePromise || upgradeLoading) return
    setUpgradeLoading(true)
    setError('')
    try {
      const stripe = await stripePromise
      const confirmation = {
        clientSecret: upgradeClientSecret,
        confirmParams: { return_url: `${window.location.origin}/checkout/vip?payment=return` },
        redirect: 'if_required',
      }
      if (upgradeElementsRef.current) confirmation.elements = upgradeElementsRef.current
      const { error: paymentError } = await stripe.confirmPayment(confirmation)
      if (paymentError) throw paymentError
      storeFlowMarker()
      setFlow('verifying')
    } catch (paymentError) {
      setError(friendlyPaymentError(paymentError))
    } finally { setUpgradeLoading(false) }
  }

  if (!details) return <section className="checkout-state"><h1>Neplatný plán</h1><a href="/clenstvo">Späť na členstvo</a></section>
  if (authLoading || profileLoading || !session || flow === 'restoring') return <section className="checkout-state" aria-live="polite">Overujem bezpečný stav platby…</section>

  const confirmedMembership = membershipConfirmed(profile, plan)
  const formattedUpgradeAmount = upgradePreview
    ? new Intl.NumberFormat('sk-SK', { style: 'currency', currency: upgradePreview.currency || 'eur' }).format((upgradePreview.amountDue || 0) / 100)
    : ''

  if (flow === 'retry') {
    const retryVipUpgrade = () => {
      clearFlowMarker()
      setError('')
      setUpgradeBackendStatus('')
      setUpgradePreview(null)
      upgradePreviewRequestedRef.current = false
      setFlow('payment')
      setUpgradeAttempt((value) => value + 1)
    }
    return (
      <section className="checkout-result-shell is-verifying" aria-live="polite">
        <span>PRECHOD NEBOL DOKONČENÝ</span>
        <h1>Prechod na VIP nebol dokončený.</h1>
        <p>Stripe neeviduje rozpracovanú VIP platbu ani pending upgrade. Nový pokus sa spustí iba po tvojom potvrdení.</p>
        {error && <p className="payment-checkout-error" role="alert">{error}</p>}
        <button className="checkout-result-primary" type="button" onClick={retryVipUpgrade}>SKÚSIŤ PRECHOD NA VIP ZNOVA</button>
      </section>
    )
  }

  if (flow === 'verifying' || flow === 'pending' || (flow === 'success' && !confirmedMembership)) {
    return (
      <section className="checkout-result-shell is-verifying" aria-live="polite">
        <div className="checkout-result-spinner" aria-hidden="true" />
        <span>BEZPEČNÉ POTVRDENIE PLATBY</span>
        <h1>{flow !== 'pending' ? 'Overujeme platbu…' : 'Aktivácia ešte prebieha'}</h1>
        <p>{plan === 'vip' && upgradeBackendStatus === 'waiting_for_subscription'
          ? 'Platba je potvrdená. Dokončujeme aktiváciu VIP.'
          : flow !== 'pending'
            ? (plan === 'vip' ? 'Spracovávame prechod na VIP a čakáme na autoritatívne potvrdenie zo Stripe.' : 'Platba bola prijatá. Aktivujeme tvoje členstvo a čakáme na bezpečné potvrdenie zo Stripe.')
            : (plan === 'vip' ? 'Prechod na VIP ešte čaká na potvrdenie zo Stripe. Skontroluj stav účtu alebo sa vráť o chvíľu.' : 'Platba bola prijatá, aktivácia členstva ešte prebieha. Nemusíš platiť znova.')}</p>
        {flow === 'pending' && <a className="checkout-result-primary" href="/account">Skontrolovať môj účet</a>}
      </section>
    )
  }

  if (flow === 'success' && confirmedMembership) {
    const renewalDate = profile.membership_expires_at ? formatMembershipDate(profile.membership_expires_at) : null
    const leaveSuccess = clearFlowMarker
    return (
      <section className={`checkout-result-shell is-success is-${plan}`} aria-labelledby="checkout-success-heading">
        <div className="checkout-result-panel">
          <div className="checkout-result-check" aria-hidden="true">✓</div>
          <span className="checkout-result-eyebrow">PLATBA PREBEHLA ÚSPEŠNE</span>
          <h1 id="checkout-success-heading">{plan === 'vip' ? 'Vitaj medzi VIP členmi' : 'Vitaj medzi členmi'}</h1>
          <strong className="checkout-result-brand">VÝCHOD BROTHERS</strong>
          <p>Tvoje členstvo <strong>{details.name}</strong> je teraz aktívne.</p>
          <div className="checkout-result-membership-card">
            <div className="checkout-result-plan"><strong>{details.name}</strong><b>{details.price} <small>/ mesiac</small></b></div>
            <ul><li>Platba bola úspešne spracovaná</li><li>Členstvo je aktívne</li><li>Exkluzívny obsah je odomknutý</li><li>Predplatné sa obnovuje automaticky</li></ul>
            {renewalDate && <p className="checkout-result-renewal"><span>Ďalšie obnovenie</span><strong>{renewalDate}</strong></p>}
          </div>
          <div className="checkout-result-actions"><a className="checkout-result-primary" href="/videos" onClick={leaveSuccess}>Pozrieť členské videá</a><a className="checkout-result-secondary" href="/account" onClick={leaveSuccess}>Prejsť na môj účet</a></div>
        </div>
      </section>
    )
  }

  return (
    <section className={`payment-checkout-shell is-${plan}`} aria-labelledby="checkout-heading">
      <header className="payment-checkout-intro">
        <a href="/clenstvo" aria-label="Späť na členstvo">← Späť na členstvo</a>
        <span>VÝCHOD BROTHERS · {details.name}</span>
        <h1 id="checkout-heading">Aktivuj svoje členstvo</h1>
        <p>{details.description}</p>
        <div className="payment-checkout-price"><strong>{details.name}</strong><b>{details.price} <small>/ mesiac</small></b></div>
        <ul><li>Okamžitý prístup po potvrdení platby</li><li>Bezpečné spracovanie cez Stripe</li><li>Zrušenie kedykoľvek v Mojom účte</li></ul>
      </header>

      <div className="payment-checkout-card">
        {isVipUpgrade ? (
          <div className="checkout-upgrade" role="status">
            <span>BEZPEČNÝ UPGRADE</span><h2>Prejsť na VIP</h2>
            <div className="checkout-upgrade-plans"><p><small>Aktuálny plán</small><strong>MEMBER</strong><b>4,99 € / mesiac</b></p><i aria-hidden="true">→</i><p><small>Nový plán</small><strong>VIP</strong><b>9,99 € / mesiac</b></p></div>
            {upgradeClientSecret ? <><p>{upgradePaymentStatus === 'requires_payment_method' ? 'Prorata platba potrebuje platnú platobnú metódu.' : 'Stripe vyžaduje dodatočné bezpečnostné potvrdenie platby.'} VIP zostane zamknuté, kým platba nebude úspešná.</p>{upgradePaymentStatus === 'requires_payment_method' && <div className="checkout-upgrade-payment"><div ref={upgradeMountRef} /></div>}</> : upgradeLoading && !upgradePreview ? <p>Kontrolujeme stav a počítame presnú cenu prechodu…</p> : <p>Stripe zohľadní už zaplatenú časť MEMBER obdobia. Pri potvrdení sa pokúsi ihneď uhradiť pomerný rozdiel <strong>{formattedUpgradeAmount}</strong>. VIP sa aktivuje až po potvrdení platby webhookom.</p>}
            {error && <p className="payment-checkout-error" role="alert">{error}</p>}
            {error && !upgradePreview && !upgradeLoading && <button className="checkout-upgrade-retry" type="button" onClick={retryUpgradePreview}>OBNOVIŤ NÁHĽAD</button>}
            {upgradeClientSecret ? <button type="button" onClick={submitUpgradePayment} disabled={upgradeLoading || !upgradePaymentReady}>{upgradeLoading ? 'SPRACÚVAM PLATBU…' : 'DOKONČIŤ VIP PLATBU'}</button> : <button type="button" onClick={submitUpgrade} disabled={upgradeLoading || !upgradePreview}>{upgradeLoading ? 'SPRACÚVAM…' : 'POTVRDIŤ PRECHOD NA VIP'}</button>}
          </div>
        ) : activeSubscription ? (
          <div className="checkout-existing" role="status"><h2>{currentMembership === 'vip' ? 'VIP už máš aktívne.' : 'MEMBER už máš aktívne.'}</h2><p>Svoje predplatné, platobnú metódu a faktúry môžeš bezpečne spravovať v zákazníckom portáli.</p><div className="checkout-existing-actions"><a href="/account">Môj účet</a><button type="button" onClick={openPortal} disabled={portalLoading}>{portalLoading ? 'Otváram…' : 'Spravovať predplatné'}</button></div></div>
        ) : !stripePromise ? (
          <div className="checkout-existing is-error" role="alert"><h2>Platbu zatiaľ nemožno načítať</h2><p>Chýba verejná Stripe konfigurácia. Skús to prosím neskôr.</p></div>
        ) : (
          <form onSubmit={submitPayment} className="payment-checkout-form">
            <section className="payment-checkout-section">
              <span className="payment-checkout-step">01</span><div><h2>Kontaktné údaje</h2><p>Potvrdenie platby pošleme na tvoj účet.</p></div>
              <strong className="payment-checkout-email">{session.user.email}</strong>
            </section>
            <section className="payment-checkout-section is-payment">
              <span className="payment-checkout-step">02</span><div><h2>Spôsob platby</h2><p>Karta a dostupné peňaženky sa zobrazia bezpečne podľa zariadenia.</p></div>
              <div className="payment-element-wrap">{!ready && !error && <p className="payment-element-loading" aria-live="polite">Načítavam bezpečné platobné údaje…</p>}<div ref={mountRef} className="payment-element-mount" /></div>
            </section>
            <section className="payment-checkout-summary"><div><span>Súhrn</span><strong>{details.name}</strong></div><b>{details.price} <small>/ mesiac</small></b></section>
            <p className="payment-checkout-renewal">Predplatné sa automaticky obnovuje každý mesiac, kým ho nezrušíš.</p>
            {error && <div className="payment-checkout-error" role="alert"><p>{error}</p>{!ready && <button type="button" onClick={retry}>Skúsiť znova</button>}</div>}
            <button className="payment-checkout-submit" type="submit" disabled={!ready || submitting || Boolean(error && !ready)}>{submitting ? 'SPRACÚVAM PLATBU…' : `AKTIVOVAŤ ${details.name} – ${details.price} / MESIAC`}</button>
            <p className="payment-checkout-security">Platobné údaje spracúva Stripe. Východ Brothers neukladá číslo karty ani CVC.</p>
          </form>
        )}
      </div>
    </section>
  )
}
