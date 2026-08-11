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
  const action = ['confirm', 'status', 'diagnose'].includes(body.action || '') ? body.action! : 'preview'
  const { memberPrice, vipPrice } = stripeConfig()
  if (!memberPrice || !vipPrice || !Deno.env.get('STRIPE_SECRET_KEY')) {
    return json({ error: 'Upgrade momentálne nie je nakonfigurovaný.' }, 503)
  }

  const admin = createAdminClient()
  const { data: profile, error: profileError } = await admin.from('profiles')
    .select('membership, membership_status, membership_expires_at, stripe_subscription_id, stripe_subscription_status, stripe_price_id, stripe_cancel_at_period_end')
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

    if (action === 'diagnose') {
      const recentEvents = await stripe.events.list({ limit: 100 })
      const relatedEvents = recentEvents.data.filter((event) => {
        const serialized = JSON.stringify(event.data.object)
        return serialized.includes(subscription.id)
          || Boolean(invoice?.id && serialized.includes(invoice.id))
          || Boolean(paymentIntentId && serialized.includes(paymentIntentId))
      })
      const eventIds = relatedEvents.map((event) => event.id)
      const { data: recordedEvents } = eventIds.length
        ? await admin.from('stripe_webhook_events').select('event_id').in('event_id', eventIds)
        : { data: [] }
      const recorded = new Set((recordedEvents || []).map((event) => event.event_id))
      const webhookEndpoints = await stripe.webhookEndpoints.list({ limit: 100 })
      const webhook = webhookEndpoints.data.find((endpoint) => endpoint.url.includes('stripe-webhook'))
      const enabledEvents = webhook?.enabled_events || []
      return json({
        subscription: {
          id: subscription.id,
          status: subscription.status,
          currentPriceId: item.price.id,
          currentPlan: item.price.id === vipPrice ? 'vip' : item.price.id === memberPrice ? 'member' : 'unknown',
          pendingUpdate: subscription.pending_update ? {
            expiresAt: subscription.pending_update.expires_at,
          } : null,
          currentPeriodEnd: item.current_period_end || null,
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
        },
        invoice: invoice ? {
          id: invoice.id,
          status: invoice.status,
          amountDue: invoice.amount_due,
          amountPaid: invoice.amount_paid,
          paid: invoice.status === 'paid',
          billingReason: invoice.billing_reason,
        } : null,
        paymentIntent: paymentIntent ? {
          id: paymentIntent.id,
          status: paymentIntent.status,
          lastPaymentError: paymentIntent.last_payment_error ? {
            code: paymentIntent.last_payment_error.code || null,
            declineCode: paymentIntent.last_payment_error.decline_code || null,
            message: paymentIntent.last_payment_error.message || null,
          } : null,
        } : null,
        profile,
        events: relatedEvents
          .map((event) => ({ id: event.id, type: event.type, created: event.created, webhookRecorded: recorded.has(event.id) }))
          .sort((a, b) => a.created - b.created),
        webhookDestination: webhook ? {
          status: webhook.status,
          enabledEvents,
        } : null,
      })
    }

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
