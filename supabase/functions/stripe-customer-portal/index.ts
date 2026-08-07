import { bearerToken, corsHeaders, json } from '../_shared/http.ts'
import { createAdminClient, createUserClient } from '../_shared/supabase.ts'
import { stripe, stripeConfig } from '../_shared/stripe.ts'

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)
  const token = bearerToken(request)
  if (!token) return json({ error: 'Najprv sa prihláste.' }, 401)
  const { data: { user }, error: authError } = await createUserClient(token).auth.getUser(token)
  if (authError || !user) return json({ error: 'Prihlásenie nie je platné.' }, 401)

  const { siteUrl } = stripeConfig()
  if (!siteUrl || !Deno.env.get('STRIPE_SECRET_KEY')) return json({ error: 'Platby zatiaľ nie sú nakonfigurované.' }, 503)
  const { data: profile, error } = await createAdminClient().from('profiles')
    .select('stripe_customer_id').eq('id', user.id).single()
  if (error || !profile?.stripe_customer_id) return json({ error: 'K účtu zatiaľ nie je priradené predplatné.' }, 404)

  const portal = await stripe.billingPortal.sessions.create({
    customer: profile.stripe_customer_id,
    return_url: `${siteUrl}/account`,
  })
  return json({ url: portal.url })
})
