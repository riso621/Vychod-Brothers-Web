import { bearerToken, corsHeaders, json } from '../_shared/http.ts'
import { createAdminClient, createUserClient } from '../_shared/supabase.ts'
import { priceForPlan, stripe, stripeConfig } from '../_shared/stripe.ts'

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)

  const token = bearerToken(request)
  if (!token) return json({ error: 'Najprv sa prihláste.' }, 401)

  const userClient = createUserClient(token)
  const { data: { user }, error: authError } = await userClient.auth.getUser(token)
  if (authError || !user?.email) return json({ error: 'Prihlásenie nie je platné.' }, 401)

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
    .eq('id', user.id).single()
  if (profileError) return json({ error: 'Profil sa nepodarilo načítať.' }, 500)
  if (profile.stripe_subscription_id && ['active', 'trialing', 'past_due'].includes(profile.stripe_subscription_status || '')) {
    return json({ error: 'Predplatné už máte aktívne. Spravujte ho v Mojom účte.' }, 409)
  }

  let customerId = profile.stripe_customer_id
  if (!customerId) {
    const customer = await stripe.customers.create({ email: user.email, metadata: { supabase_user_id: user.id } })
    customerId = customer.id
    const { error } = await admin.from('profiles').update({ stripe_customer_id: customerId }).eq('id', user.id)
    if (error) return json({ error: 'Platobný profil sa nepodarilo priradiť.' }, 500)
  }

  const checkout = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    client_reference_id: user.id,
    line_items: [{ price: priceId, quantity: 1 }],
    metadata: { supabase_user_id: user.id, plan },
    subscription_data: { metadata: { supabase_user_id: user.id, plan } },
    success_url: `${siteUrl}/account?checkout=success`,
    cancel_url: `${siteUrl}/clenstvo?checkout=cancelled`,
  })
  return json({ url: checkout.url })
})
