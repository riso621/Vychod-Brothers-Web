import Stripe from 'npm:stripe@20.4.0'
import { json } from '../_shared/http.ts'
import { createAdminClient } from '../_shared/supabase.ts'
import { membershipForPrice, planForPrice, stripe, stripeConfig } from '../_shared/stripe.ts'
import { notifyAdmin } from '../_shared/notifications.ts'
import { sendWelcomeOnce } from '../_shared/club-emails.ts'

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

function money(amount: number, currency: string) {
  try { return new Intl.NumberFormat('sk-SK', { style: 'currency', currency: currency.toUpperCase() }).format(amount / 100) }
  catch { return `${(amount / 100).toFixed(2)} ${currency.toUpperCase()}` }
}

async function createEventNotifications(admin: ReturnType<typeof createAdminClient>, event: Stripe.Event, subscription: Stripe.Subscription, userId: string, plan: string) {
  const { data: { user } } = await admin.auth.admin.getUserById(userId)
  const email = user?.email || 'používateľ'
  const targetUrl = `/admin/users/${userId}`
  const jobs: Promise<void>[] = []
  const add = (suffix: string, input: Parameters<typeof notifyAdmin>[1], dedupeKey = `stripe:${event.id}:${suffix}`) => jobs.push(notifyAdmin(admin, { ...input, dedupeKey }))

  if (event.type === 'invoice.paid' || event.type === 'invoice.payment_failed') {
    const invoice = event.data.object as Stripe.Invoice
    const paid = event.type === 'invoice.paid'
    const amount = paid ? invoice.amount_paid : invoice.amount_due
    add(paid ? 'invoice-paid' : 'invoice-failed', {
      type: paid ? 'stripe.payment_paid' : 'stripe.payment_failed', title: paid ? 'Nová platba' : 'Neúspešná platba',
      message: paid ? `Prijatá platba ${money(amount, invoice.currency)} od ${email}.` : `Platba ${money(amount, invoice.currency)} od ${email} zlyhala.`,
      entityType: 'invoice', entityId: invoice.id, targetUrl: '/admin/invoices', metadata: { invoiceId: invoice.id, userId, plan }, dedupeKey: '',
    }, `stripe:invoice:${invoice.id}:${paid ? 'paid' : 'failed'}`)
  }
  if ((event.type === 'customer.subscription.created' || event.type === 'checkout.session.completed') && ['active', 'trialing'].includes(subscription.status)) {
    add('membership-created', { type: 'membership.activated', title: 'Nový člen', message: `${email} si aktivoval Východ Brothers Club.`, entityType: 'user', entityId: userId, targetUrl, metadata: { plan, subscriptionId: subscription.id }, dedupeKey: '' }, `membership:activated:${subscription.id}:${plan}`)
  }
  if (event.type === 'customer.subscription.pending_update_applied') {
    add('membership-upgraded', { type: 'membership.upgraded', title: `Prechod na ${plan.toUpperCase()}`, message: `${email} prešiel na ${plan.toUpperCase()}.`, entityType: 'user', entityId: userId, targetUrl, metadata: { plan, subscriptionId: subscription.id }, dedupeKey: '' }, `membership:plan:${subscription.id}:${subscription.items.data[0]?.price.id || plan}:${periodEnd(subscription) || 'current'}`)
  }
  if (event.type === 'customer.subscription.updated') {
    const previous = event.data.previous_attributes as Record<string, unknown> | undefined
    const previousPriceId = ((previous?.items as { data?: Array<{ price?: { id?: string } }> } | undefined)?.data?.[0]?.price?.id) || ''
    const currentPriceId = subscription.items.data[0]?.price.id || ''
    if (previousPriceId && currentPriceId && previousPriceId !== currentPriceId && ['active', 'trialing'].includes(subscription.status)) {
      add('membership-plan-changed', { type: 'membership.upgraded', title: `Prechod na ${plan.toUpperCase()}`, message: `${email} prešiel na ${plan.toUpperCase()}.`, entityType: 'user', entityId: userId, targetUrl, metadata: { plan, subscriptionId: subscription.id }, dedupeKey: '' }, `membership:plan:${subscription.id}:${currentPriceId}:${periodEnd(subscription) || 'current'}`)
    }
    if (previous && Object.prototype.hasOwnProperty.call(previous, 'cancel_at_period_end')) {
      if (subscription.cancel_at_period_end) add('cancel-scheduled', { type: 'membership.cancel_scheduled', title: 'Zrušenie predplatného', message: `${email} naplánoval zrušenie členstva ${plan.toUpperCase()}.`, entityType: 'user', entityId: userId, targetUrl, metadata: { plan, subscriptionId: subscription.id }, dedupeKey: '' })
      else add('reactivated', { type: 'membership.reactivated', title: 'Obnovené predplatné', message: `${email} obnovil automatické predplatné ${plan.toUpperCase()}.`, entityType: 'user', entityId: userId, targetUrl, metadata: { plan, subscriptionId: subscription.id }, dedupeKey: '' })
    }
  }
  if (event.type === 'customer.subscription.deleted') {
    add('cancelled', { type: 'membership.cancelled', title: 'Ukončené predplatné', message: `Predplatné ${plan.toUpperCase()} používateľa ${email} bolo ukončené.`, entityType: 'user', entityId: userId, targetUrl, metadata: { plan, subscriptionId: subscription.id }, dedupeKey: '' })
  }
  const results = await Promise.allSettled(jobs)
  results.forEach((result) => { if (result.status === 'rejected') console.error('Admin notification failed', result.reason instanceof Error ? result.reason.message : 'unknown') })
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
  const paidMembership = membershipForPrice(priceId)
  if (!paidPlan || !paidMembership) return json({ error: 'Subscription používa neznámy Price ID.' }, 400)

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
    membership = paidMembership
    membershipStatus = 'active'
  } else if (subscription.status === 'past_due' && end && end > nowSeconds) {
    membership = paidMembership
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
  if (data === true) {
    await admin.from('profiles').update({ membership_plan: paidPlan }).eq('id', userId)
    await createEventNotifications(admin, event, subscription, userId, paidPlan)
    if (membershipStatus === 'active' && ['checkout.session.completed','customer.subscription.created'].includes(event.type)) {
      EdgeRuntime.waitUntil(sendWelcomeOnce(admin,userId,subscription.id).catch((error)=>console.error('Welcome email failed',error instanceof Error?error.message:'unknown')))
    }
  }
  return json({ received: true, handled: true, applied: data })
})
