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
  const action = body.action === 'confirm' ? 'confirm' : 'preview'
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
    const subscription = await stripe.subscriptions.retrieve(profile.stripe_subscription_id)
    if (!activeStatuses.has(subscription.status)) return json({ error: 'Predplatné nie je možné upgradovať.' }, 409)
    if (subscription.pending_update) return json({ error: 'Predchádzajúca zmena predplatného sa ešte spracúva.' }, 409)
    if (subscription.items.data.length !== 1) return json({ error: 'Predplatné má neočakávanú konfiguráciu.' }, 409)
    const item = subscription.items.data[0]
    if (item.price.id !== memberPrice) return json({ error: 'Upgrade je dostupný iba z MEMBER na VIP.' }, 409)

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
    }, { idempotencyKey: `vb-upgrade-vip-${subscription.id}-${prorationDate}` })

    return json({
      status: updated.pending_update ? 'pending_payment' : 'updated',
      subscriptionId: updated.id,
    })
  } catch (error) {
    const stripeError = error as { code?: string; message?: string }
    console.error('stripe-upgrade-subscription failed', { code: stripeError.code || 'unknown' })
    return json({ error: 'Prechod na VIP sa nepodarilo bezpečne dokončiť. Skúste to znova.' }, 502)
  }
})
