import { bearerToken, corsHeaders, json } from '../_shared/http.ts'
import { createAdminClient, createUserClient } from '../_shared/supabase.ts'
import { stripe, stripeConfig } from '../_shared/stripe.ts'

const activeStatuses = new Set(['active', 'trialing', 'past_due'])

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)

  const token = bearerToken(request)
  if (!token) return json({ error: 'Najprv sa prihláste.' }, 401)
  const userClient = createUserClient(token)
  const { data: { user }, error: authError } = await userClient.auth.getUser(token)
  if (authError || !user) return json({ error: 'Prihlásenie nie je platné.' }, 401)

  let body: { action?: string; prorationDate?: number }
  try { body = await request.json() } catch { return json({ error: 'Neplatná požiadavka.' }, 400) }
  const action = ['confirm', 'status'].includes(body.action || '') ? body.action! : 'preview'
  const { memberPrice, vipPrice } = stripeConfig()
  if (!memberPrice || !vipPrice || !Deno.env.get('STRIPE_SECRET_KEY')) {
    return json({ error: 'Upgrade momentálne nie je nakonfigurovaný.' }, 503)
  }

  const admin = createAdminClient()
  const { data: profile, error: profileError } = await admin.from('profiles')
    .select('stripe_subscription_id, stripe_subscription_status')
    .eq('id', user.id).maybeSingle()
  if (profileError || !profile) return json({ error: 'Profil sa nepodarilo načítať.' }, 500)
  if (!profile.stripe_subscription_id || !activeStatuses.has(profile.stripe_subscription_status || '')) {
    return json({ error: 'Aktívne MEMBER predplatné sa nenašlo.' }, 409)
  }

  try {
    const subscription = await stripe.subscriptions.retrieve(profile.stripe_subscription_id, {
      expand: ['latest_invoice.confirmation_secret'],
    })
    if (!activeStatuses.has(subscription.status)) return json({ error: 'Predplatné nie je možné upgradovať.' }, 409)
    if (subscription.items.data.length !== 1) return json({ error: 'Predplatné má neočakávanú konfiguráciu.' }, 409)
    const item = subscription.items.data[0]
    const invoice = typeof subscription.latest_invoice === 'string' ? null : subscription.latest_invoice
    const clientSecret = invoice?.confirmation_secret?.client_secret || ''
    const paymentIntentId = clientSecret.startsWith('pi_') ? clientSecret.split('_secret_')[0] : ''
    const paymentIntent = paymentIntentId ? await stripe.paymentIntents.retrieve(paymentIntentId) : null
    const paymentStatus = paymentIntent?.status || ''

    if (subscription.pending_update) {
      if (paymentStatus === 'canceled') {
        return json({ error: 'Prorata platba bola zrušená. MEMBER zostáva aktívny.' }, 402)
      }
      const requiresPayment = ['requires_action', 'requires_confirmation', 'requires_payment_method'].includes(paymentStatus)
      return json({
        status: requiresPayment
          ? 'requires_payment'
          : paymentStatus === 'succeeded' || invoice?.status === 'paid'
            ? 'waiting_for_subscription'
            : 'processing',
        clientSecret: requiresPayment ? clientSecret : '',
        paymentStatus,
        invoiceStatus: invoice?.status || null,
      })
    }
    if (item.price.id === vipPrice) return json({ status: 'updated', paymentStatus, invoiceStatus: invoice?.status || null })
    if (item.price.id !== memberPrice) return json({ error: 'Upgrade je dostupný iba z MEMBER na VIP.' }, 409)

    if (action === 'status') return json({ status: 'ready' })

    if (action === 'preview') {
      const prorationDate = Math.floor(Date.now() / 1000)
      const preview = await stripe.invoices.createPreview({
        subscription: subscription.id,
        subscription_details: {
          items: [{ id: item.id, price: vipPrice, quantity: 1 }],
          proration_behavior: 'always_invoice',
          proration_date: prorationDate,
        },
      })
      const prorationAmount = preview.lines.data
        .filter((line) => line.parent?.subscription_item_details?.proration === true)
        .reduce((total, line) => total + line.amount, 0)
      return json({
        prorationDate,
        amountDue: Math.max(0, prorationAmount),
        currency: preview.currency,
      })
    }

    const prorationDate = Number(body.prorationDate)
    const now = Math.floor(Date.now() / 1000)
    if (!Number.isInteger(prorationDate) || Math.abs(now - prorationDate) > 10 * 60) {
      return json({ error: 'Náhľad ceny expiroval. Obnovte ho a skúste znova.' }, 409)
    }
    const updated = await stripe.subscriptions.update(subscription.id, {
      items: [{ id: item.id, price: vipPrice, quantity: 1 }],
      payment_behavior: 'pending_if_incomplete',
      proration_behavior: 'always_invoice',
      proration_date: prorationDate,
      metadata: { ...subscription.metadata, supabase_user_id: user.id, plan: 'vip' },
      expand: ['latest_invoice.confirmation_secret'],
    }, { idempotencyKey: `vb-upgrade-vip-${subscription.id}-${prorationDate}` })

    const updatedInvoice = typeof updated.latest_invoice === 'string' ? null : updated.latest_invoice
    const updatedClientSecret = updatedInvoice?.confirmation_secret?.client_secret || ''
    const updatedPaymentIntentId = updatedClientSecret.startsWith('pi_') ? updatedClientSecret.split('_secret_')[0] : ''
    const updatedPaymentIntent = updatedPaymentIntentId
      ? await stripe.paymentIntents.retrieve(updatedPaymentIntentId)
      : null
    const updatedPaymentStatus = updatedPaymentIntent?.status || ''
    const requiresPayment = ['requires_action', 'requires_confirmation', 'requires_payment_method'].includes(updatedPaymentStatus)

    return json({
      status: updated.pending_update
        ? requiresPayment
          ? 'requires_payment'
          : updatedPaymentStatus === 'succeeded' || updatedInvoice?.status === 'paid'
            ? 'waiting_for_subscription'
            : 'processing'
        : 'updated',
      clientSecret: requiresPayment ? updatedClientSecret : '',
      paymentStatus: updatedPaymentStatus,
      invoiceStatus: updatedInvoice?.status || null,
    })
  } catch (error) {
    const stripeError = error as { code?: string; message?: string }
    console.error('stripe-upgrade-subscription failed', { code: stripeError.code || 'unknown' })
    return json({ error: 'Prechod na VIP sa nepodarilo bezpečne dokončiť. Skúste to znova.' }, 502)
  }
})
