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
  if (!['member', 'vip'].includes(plan)) return json({ error: 'Neplatný plán.' }, 400)
  if (!priceId || !siteUrl || !Deno.env.get('STRIPE_SECRET_KEY')) {
    return json({ error: 'Platby zatiaľ nie sú nakonfigurované.' }, 503)
  }

  const admin = createAdminClient()
  const { data: profile, error: profileError } = await admin.from('profiles')
    .select('stripe_customer_id, stripe_subscription_id, stripe_subscription_status')
    .eq('id', user.id).maybeSingle()
  if (profileError) {
    console.error('stripe-create-checkout profile query failed', {
      code: profileError.code,
      message: profileError.message,
      details: profileError.details,
      hint: profileError.hint,
    })
    return json({ error: 'Profil sa nepodarilo načítať.' }, 500)
  }
  if (!profile) return json({ error: 'Profil používateľa neexistuje.' }, 409)
  const profileCompletedAt = performance.now()
  if (profile.stripe_subscription_id && ['active', 'trialing', 'past_due'].includes(profile.stripe_subscription_status || '')) {
    return json({ error: 'Predplatné už máte aktívne. Spravujte ho v Mojom účte.' }, 409)
  }

  let checkout
  try {
    checkout = await stripe.checkout.sessions.create({
      mode: 'subscription',
      ...(profile.stripe_customer_id
        ? { customer: profile.stripe_customer_id }
        : { customer_email: user.email }),
      client_reference_id: user.id,
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: { supabase_user_id: user.id, plan },
      subscription_data: { metadata: { supabase_user_id: user.id, plan } },
      success_url: `${siteUrl}/account?checkout=success`,
      cancel_url: `${siteUrl}/clenstvo?checkout=cancelled`,
    })
  } catch (error) {
    const stripeError = error as { type?: string; code?: string; statusCode?: number }
    console.error('stripe-create-checkout Stripe request failed', {
      plan,
      type: stripeError.type || 'unknown',
      code: stripeError.code || 'unknown',
      status: stripeError.statusCode || 500,
    })
    const message = stripeError.code === 'resource_missing'
      ? `Platobný plán ${plan.toUpperCase()} nie je v Stripe Sandboxe dostupný.`
      : 'Stripe Checkout momentálne nie je dostupný. Skúste to znova.'
    return json({ error: message, code: stripeError.code || 'stripe_request_failed' }, 502)
  }
  console.info('stripe-create-checkout completed', {
    plan,
    reusedCustomer: Boolean(profile.stripe_customer_id),
    authMs: Math.round(authCompletedAt - startedAt),
    profileMs: Math.round(profileCompletedAt - authCompletedAt),
    stripeMs: Math.round(performance.now() - profileCompletedAt),
    totalMs: Math.round(performance.now() - startedAt),
  })
  return json({ url: checkout.url })
})
