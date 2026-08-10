import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/stripe-js'
import { useProfile } from '../context/profile-context'
import { createCheckoutSession, createCustomerPortalSession } from '../lib/billing'

const planDetails = {
  member: { name: 'MEMBER', price: '4,99 €' },
  vip: { name: 'VIP', price: '9,99 €' },
}

const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY?.trim() || ''
const stripePromise = publishableKey ? loadStripe(publishableKey) : null

export default function CheckoutPage({ plan }) {
  const { session, profile, authLoading, profileLoading } = useProfile()
  const [error, setError] = useState('')
  const [portalLoading, setPortalLoading] = useState(false)
  const requestRef = useRef(null)
  const details = planDetails[plan]
  const activeSubscription = Boolean(profile?.stripe_subscription_id)
    && ['active', 'trialing', 'past_due'].includes(profile?.stripe_subscription_status || '')

  useEffect(() => {
    if (!authLoading && !session) {
      window.location.replace(`/?auth=login&next=${encodeURIComponent(`/checkout/${plan}`)}`)
    }
  }, [authLoading, session, plan])

  const fetchClientSecret = useCallback(() => {
    if (!requestRef.current) {
      requestRef.current = createCheckoutSession(plan).catch((checkoutError) => {
        requestRef.current = null
        setError(checkoutError.message || 'Bezpečnú platbu sa nepodarilo pripraviť.')
        throw checkoutError
      })
    }
    return requestRef.current
  }, [plan])

  const options = useMemo(() => ({ fetchClientSecret }), [fetchClientSecret])

  const openPortal = async () => {
    if (portalLoading) return
    setPortalLoading(true)
    setError('')
    try {
      window.location.assign(await createCustomerPortalSession())
    } catch (portalError) {
      setError(portalError.message || 'Správa predplatného momentálne nie je dostupná.')
      setPortalLoading(false)
    }
  }

  if (!details) return <section className="checkout-state"><h1>Neplatný plán</h1><a href="/clenstvo">Späť na členstvo</a></section>
  if (authLoading || profileLoading || !session) return <section className="checkout-state" aria-live="polite">Pripravujem bezpečnú platbu…</section>

  return (
    <section className="embedded-checkout-shell" aria-labelledby="checkout-heading">
      <header className="embedded-checkout-heading">
        <a href="/clenstvo" aria-label="Späť na členstvo">← Späť</a>
        <span>VÝCHOD BROTHERS · BEZPEČNÁ PLATBA</span>
        <h1 id="checkout-heading">Dokonči svoje členstvo</h1>
        <div className="embedded-checkout-plan"><strong>{details.name}</strong><b>{details.price} <small>/ mesiac</small></b></div>
        <ul><li>Mesačné predplatné</li><li>Platbu bezpečne spracuje Stripe</li><li>Zrušenie pred ďalším obdobím</li></ul>
      </header>

      <div className="embedded-checkout-frame">
        {activeSubscription ? (
          <div className="checkout-existing" role="status">
            <h2>Predplatné už máš aktívne</h2>
            <p>Aby nevzniklo druhé paralelné predplatné, zmenu plánu dokonči cez bezpečnú správu predplatného.</p>
            <button type="button" onClick={openPortal} disabled={portalLoading}>{portalLoading ? 'Otváram…' : 'Spravovať predplatné'}</button>
          </div>
        ) : !stripePromise ? (
          <div className="checkout-existing is-error" role="alert"><h2>Platbu zatiaľ nemožno načítať</h2><p>Chýba verejná Stripe konfigurácia. Skús to prosím neskôr.</p></div>
        ) : (
          <EmbeddedCheckoutProvider stripe={stripePromise} options={options}>
            <EmbeddedCheckout />
          </EmbeddedCheckoutProvider>
        )}
        {error && <p className="embedded-checkout-error" role="alert">{error}</p>}
      </div>
    </section>
  )
}
