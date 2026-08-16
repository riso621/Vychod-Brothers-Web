import Stripe from 'npm:stripe@20.4.0'

export const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  httpClient: Stripe.createFetchHttpClient(),
})

export function stripeConfig() {
  const memberPrice = Deno.env.get('STRIPE_MEMBER_PRICE_ID') || ''
  const vipPrice = Deno.env.get('STRIPE_VIP_PRICE_ID') || ''
  const clubPrice = Deno.env.get('STRIPE_CLUB_PRICE_ID') || ''
  return {
    memberPrice,
    vipPrice,
    clubPrice,
    siteUrl: (Deno.env.get('SITE_URL') || '').replace(/\/$/, ''),
    webhookSecret: Deno.env.get('STRIPE_WEBHOOK_SECRET') || '',
  }
}

export function planForPrice(priceId: string) {
  const { memberPrice, vipPrice, clubPrice } = stripeConfig()
  if (priceId && priceId === clubPrice) return 'club'
  if (priceId && priceId === memberPrice) return 'member'
  if (priceId && priceId === vipPrice) return 'vip'
  return null
}

export function membershipForPrice(priceId: string) {
  const plan = planForPrice(priceId)
  if (plan === 'club' || plan === 'member') return 'member'
  if (plan === 'vip') return 'vip'
  return null
}

export function priceForPlan(plan: string) {
  const { memberPrice, vipPrice, clubPrice } = stripeConfig()
  if (plan === 'club') return clubPrice
  if (plan === 'member') return memberPrice
  if (plan === 'vip') return vipPrice
  return ''
}
