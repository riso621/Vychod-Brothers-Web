import { supabase } from './supabase'

async function invokeBillingFunction(name, body) {
  if (!supabase) throw new Error('Platby zatiaľ nie sú dostupné.')
  const { data, error } = await supabase.functions.invoke(name, { body })
  if (error) {
    let message = data?.error || error.message
    try {
      const context = await error.context?.json()
      message = context?.error || message
    } catch { /* Response body nemusí byť JSON. */ }
    throw new Error(message || 'Platobná služba momentálne nie je dostupná.')
  }
  if (!data?.url) throw new Error('Platobná služba nevrátila bezpečný odkaz.')
  return data.url
}

export function createCheckoutSession(plan) {
  return invokeBillingFunction('stripe-create-checkout', { plan })
}

export function createCustomerPortalSession() {
  return invokeBillingFunction('stripe-customer-portal', {})
}
