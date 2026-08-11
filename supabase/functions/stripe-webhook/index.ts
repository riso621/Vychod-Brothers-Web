import Stripe from 'npm:stripe@20.4.0'
import { json } from '../_shared/http.ts'
import { createAdminClient } from '../_shared/supabase.ts'
import { planForPrice, stripe, stripeConfig } from '../_shared/stripe.ts'

const handledEvents = new Set([
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.pending_update_applied',
  'customer.subscription.pending_update_expired',
  'customer.subscription.deleted',
  'invoice.paid',
  'invoice.payment_failed',
])

function idOf(value: string | { id: string } | null | undefined) {
  return typeof value === 'string' ? value : value?.id || ''
}

function subscriptionFromInvoice(invoice: Stripe.Invoice) {
  const legacy = (invoice as Stripe.Invoice & { subscription?: string | Stripe.Subscription | null }).subscription
  const current = invoice.parent?.subscription_details?.subscription
  return idOf(current || legacy)
}

function periodEnd(subscription: Stripe.Subscription) {
  const legacy = (subscription as Stripe.Subscription & { current_period_end?: number }).current_period_end
  return legacy || subscription.items.data[0]?.current_period_end || null
}

async function subscriptionForEvent(event: Stripe.Event) {
  if (event.type === 'customer.subscription.pending_update_applied'
    || event.type === 'customer.subscription.pending_update_expired') {
    const eventSubscription = event.data.object as Stripe.Subscription
    return stripe.subscriptions.retrieve(eventSubscription.id)
  }
  if (event.type.startsWith('customer.subscription.')) return event.data.object as Stripe.Subscription
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const id = idOf(session.subscription)
    return id ? stripe.subscriptions.retrieve(id) : null
  }
  if (event.type === 'invoice.paid' || event.type === 'invoice.payment_failed') {
    const id = subscriptionFromInvoice(event.data.object as Stripe.Invoice)
    return id ? stripe.subscriptions.retrieve(id) : null
  }
  return null
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)
  const signature = request.headers.get('stripe-signature') || ''
  const { webhookSecret } = stripeConfig()
  if (!signature || !webhookSecret) return json({ error: 'Webhook nie je nakonfigurovaný.' }, 400)

  let event: Stripe.Event
  try {
    const rawBody = await request.text()
    event = await stripe.webhooks.constructEventAsync(
      rawBody, signature, webhookSecret, undefined, Stripe.createSubtleCryptoProvider(),
    )
  } catch {
    return json({ error: 'Neplatný webhook podpis.' }, 400)
  }
  if (!handledEvents.has(event.type)) return json({ received: true, handled: false })

  const subscription = await subscriptionForEvent(event)
  if (!subscription) return json({ received: true, handled: false })
  const priceId = subscription.items.data[0]?.price?.id || ''
  const paidPlan = planForPrice(priceId)
  if (!paidPlan) return json({ error: 'Subscription používa neznámy Price ID.' }, 400)

  const customerId = idOf(subscription.customer)
  const admin = createAdminClient()
  let userId = subscription.metadata.supabase_user_id || ''
  if (!userId && customerId) {
    const { data } = await admin.from('profiles').select('id').eq('stripe_customer_id', customerId).maybeSingle()
    userId = data?.id || ''
  }
  if (!/^[0-9a-f-]{36}$/i.test(userId)) return json({ error: 'Subscription nie je priradené používateľovi.' }, 400)

  const end = periodEnd(subscription)
  const endIso = end ? new Date(end * 1000).toISOString() : null
  const cancellationScheduled = subscription.cancel_at_period_end || subscription.cancel_at !== null
  const nowSeconds = Math.floor(Date.now() / 1000)
  let membership = 'free'
  let membershipStatus = 'expired'
  if (['active', 'trialing'].includes(subscription.status)) {
    membership = paidPlan
    membershipStatus = 'active'
  } else if (subscription.status === 'past_due' && end && end > nowSeconds) {
    membership = paidPlan
    membershipStatus = 'active'
  } else if (subscription.status === 'canceled') {
    membershipStatus = 'cancelled'
  }

  const { data, error } = await admin.rpc('apply_stripe_subscription_event', {
    p_event_id: event.id,
    p_event_type: event.type,
    p_stripe_created_at: new Date(event.created * 1000).toISOString(),
    p_user_id: userId,
    p_customer_id: customerId,
    p_subscription_id: subscription.id,
    p_price_id: priceId,
    p_subscription_status: subscription.status,
    p_membership: membership,
    p_membership_status: membershipStatus,
    p_period_end: endIso,
    p_cancel_at_period_end: cancellationScheduled,
  })
  if (error) return json({ error: 'Synchronizácia členstva zlyhala.' }, 500)
  return json({ received: true, handled: true, applied: data })
})
