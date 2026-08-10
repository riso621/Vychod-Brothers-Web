import { supabase } from './supabase'

async function invokeBillingFunction(name, body, responseField = 'url') {
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
  if (!data?.[responseField]) throw new Error('Platobná služba nevrátila bezpečné údaje.')
  return data[responseField]
}

export function createCheckoutSession(plan) {
  return invokeBillingFunction('stripe-create-checkout', { plan }, 'clientSecret')
}

export function createCustomerPortalSession() {
  return invokeBillingFunction('stripe-customer-portal', {})
}
