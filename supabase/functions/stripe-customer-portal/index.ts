import Stripe from 'npm:stripe@20.4.0'
import { bearerToken, corsHeaders, json } from '../_shared/http.ts'
import { createAdminClient, createUserClient } from '../_shared/supabase.ts'
import { planForPrice, stripe, stripeConfig } from '../_shared/stripe.ts'

function periodEnd(subscription: Stripe.Subscription) {
  const legacy = (subscription as Stripe.Subscription & { current_period_end?: number }).current_period_end
  return legacy || subscription.items.data[0]?.current_period_end || null
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)
  const token = bearerToken(request)
  if (!token) return json({ error: 'Najprv sa prihláste.' }, 401)
  const { data: { user }, error: authError } = await createUserClient(token).auth.getUser(token)
  if (authError || !user) return json({ error: 'Prihlásenie nie je platné.' }, 401)

  let body: { action?: string } = {}
  try { body = await request.json() } catch { /* Empty body creates a portal session. */ }

  const { siteUrl } = stripeConfig()
  if (!siteUrl || !Deno.env.get('STRIPE_SECRET_KEY')) return json({ error: 'Platby zatiaľ nie sú nakonfigurované.' }, 503)
  const admin = createAdminClient()
  const { data: profile, error } = await admin.from('profiles')
    .select('stripe_customer_id, stripe_subscription_id').eq('id', user.id).single()
  if (error || !profile?.stripe_customer_id) return json({ error: 'K účtu zatiaľ nie je priradené predplatné.' }, 404)

  if (body.action === 'sync') {
    if (!profile.stripe_subscription_id) return json({ error: 'Predplatné sa nenašlo.' }, 404)
    const subscription = await stripe.subscriptions.retrieve(profile.stripe_subscription_id)
    const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id
    if (customerId !== profile.stripe_customer_id) return json({ error: 'Predplatné nepatrí tomuto účtu.' }, 403)

    const priceId = subscription.items.data[0]?.price?.id || ''
    const paidPlan = planForPrice(priceId)
    if (!paidPlan) return json({ error: 'Predplatné používa neznámy plán.' }, 409)
    const end = periodEnd(subscription)
    const nowSeconds = Math.floor(Date.now() / 1000)
    let membership = 'free'
    let membershipStatus = 'expired'
    if (subscription.status === 'active' || subscription.status === 'trialing'
      || (subscription.status === 'past_due' && end && end > nowSeconds)) {
      membership = paidPlan
      membershipStatus = 'active'
    } else if (subscription.status === 'canceled') {
      membershipStatus = 'cancelled'
    }

    const { error: updateError } = await admin.from('profiles').update({
      stripe_price_id: priceId,
      stripe_subscription_status: subscription.status,
      stripe_cancel_at_period_end: subscription.cancel_at_period_end,
      stripe_last_event_created_at: new Date(nowSeconds * 1000).toISOString(),
      membership,
      membership_status: membershipStatus,
      membership_expires_at: end ? new Date(end * 1000).toISOString() : null,
    }).eq('id', user.id).eq('stripe_customer_id', customerId)
    if (updateError) return json({ error: 'Stav predplatného sa nepodarilo uložiť.' }, 500)
    return json({
      synced: true,
      membership,
      membershipStatus,
      subscriptionStatus: subscription.status,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      periodEnd: end ? new Date(end * 1000).toISOString() : null,
    })
  }

  const portal = await stripe.billingPortal.sessions.create({
    customer: profile.stripe_customer_id,
    return_url: `${siteUrl}/account?billing=portal`,
  })
  return json({ url: portal.url })
})
