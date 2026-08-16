import { bearerToken, corsHeaders, json } from '../_shared/http.ts'
import { createAdminClient, createUserClient } from '../_shared/supabase.ts'
import { priceForPlan, stripe, stripeConfig } from '../_shared/stripe.ts'

Deno.serve(async (request) => {
  const startedAt = performance.now()
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)

  const token = bearerToken(request)
  if (!token) return json({ error: 'Najprv sa prihláste.' }, 401)
  const userClient = createUserClient(token)
  const { data: { user }, error: authError } = await userClient.auth.getUser(token)
  if (authError || !user?.email) return json({ error: 'Prihlásenie nie je platné.' }, 401)
  const authCompletedAt = performance.now()

  let body: { plan?: string }
  try { body = await request.json() } catch { return json({ error: 'Neplatná požiadavka.' }, 400) }
  const plan = String(body.plan || '').toLowerCase()
  const priceId = priceForPlan(plan)
  const { siteUrl } = stripeConfig()
  if (plan !== 'club') return json({ error: 'Neplatný plán.' }, 400)
  if (!priceId || !siteUrl || !Deno.env.get('STRIPE_SECRET_KEY')) return json({ error: 'Platby zatiaľ nie sú nakonfigurované.' }, 503)

  const admin = createAdminClient()
  const { data: profile, error: profileError } = await admin.from('profiles')
    .select('stripe_customer_id, stripe_subscription_id, stripe_subscription_status')
    .eq('id', user.id).maybeSingle()
  if (profileError) {
    console.error('stripe-create-checkout profile query failed', { code: profileError.code, message: profileError.message })
    return json({ error: 'Profil sa nepodarilo načítať.' }, 500)
  }
  if (!profile) return json({ error: 'Profil používateľa neexistuje.' }, 409)
  const profileCompletedAt = performance.now()
  if (profile.stripe_subscription_id && ['active', 'trialing', 'past_due'].includes(profile.stripe_subscription_status || '')) {
    return json({ error: 'Predplatné už máte aktívne. Spravujte ho v Mojom účte.' }, 409)
  }

  try {
    let customerId = profile.stripe_customer_id || ''
    if (!customerId) {
      const customer = await stripe.customers.create({ email: user.email, metadata: { supabase_user_id: user.id } }, { idempotencyKey: `vb-customer-${user.id}` })
      customerId = customer.id
      const { error } = await admin.from('profiles').update({ stripe_customer_id: customerId }).eq('id', user.id)
      if (error) throw new Error('Stripe zákazníka sa nepodarilo bezpečne priradiť k profilu.')
    }

    const subscriptions = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 10 })
    if (subscriptions.data.some((item) => ['active', 'trialing', 'past_due'].includes(item.status))) {
      return json({ error: 'Predplatné už máte aktívne. Spravujte ho v Mojom účte.' }, 409)
    }
    const incomplete = subscriptions.data.find((item) => item.status === 'incomplete' && item.metadata.supabase_user_id === user.id)
    if (incomplete && incomplete.metadata.plan !== plan) {
      return json({ error: 'Máte rozpracovanú platbu iného plánu. Dokončite ju alebo skúste neskôr.' }, 409)
    }

    const subscription = incomplete
      ? await stripe.subscriptions.retrieve(incomplete.id, { expand: ['latest_invoice.confirmation_secret'] })
      : await stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: priceId }],
        payment_behavior: 'default_incomplete',
        payment_settings: { save_default_payment_method: 'on_subscription' },
        metadata: { supabase_user_id: user.id, plan },
        expand: ['latest_invoice.confirmation_secret'],
      }, { idempotencyKey: `vb-subscription-${user.id}-${Math.floor(Date.now() / 600000)}` })

    const invoice = typeof subscription.latest_invoice === 'string' ? null : subscription.latest_invoice
    const clientSecret = invoice?.confirmation_secret?.client_secret || ''
    if (!clientSecret) return json({ error: 'Stripe nevrátil bezpečný platobný token.' }, 502)
    console.info('stripe-create-checkout completed', {
      plan, reusedCustomer: Boolean(profile.stripe_customer_id), reusedSubscription: Boolean(incomplete),
      authMs: Math.round(authCompletedAt - startedAt), profileMs: Math.round(profileCompletedAt - authCompletedAt),
      stripeMs: Math.round(performance.now() - profileCompletedAt), totalMs: Math.round(performance.now() - startedAt),
    })
    return json({ clientSecret })
  } catch (error) {
    const stripeError = error as { type?: string; code?: string; statusCode?: number; message?: string }
    console.error('stripe-create-checkout Stripe request failed', {
      plan, type: stripeError.type || 'unknown', code: stripeError.code || 'unknown',
      status: stripeError.statusCode || 500, message: stripeError.message || 'unknown',
    })
    const message = stripeError.code === 'resource_missing'
      ? 'Platobný plán Východ Brothers Club nie je v Stripe Sandboxe dostupný.'
      : 'Platobný formulár momentálne nie je dostupný. Skúste to znova.'
    return json({ error: message, code: stripeError.code || 'stripe_request_failed' }, 502)
  }
})
