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

export async function syncCustomerPortalSubscription() {
  if (!supabase) throw new Error('Platby zatiaľ nie sú dostupné.')
  const { data, error } = await supabase.functions.invoke('stripe-customer-portal', {
    body: { action: 'sync' },
  })
  if (error) {
    let message = data?.error || error.message
    try { message = (await error.context?.json())?.error || message } catch { /* Response body nemusí byť JSON. */ }
    throw new Error(message || 'Stav predplatného sa nepodarilo synchronizovať.')
  }
  return data
}

export async function confirmVipUpgrade(prorationDate) {
  if (!supabase) throw new Error('Platby zatiaľ nie sú dostupné.')
  const { data, error } = await supabase.functions.invoke('stripe-upgrade-subscription', {
    body: { action: 'confirm', prorationDate },
  })
  if (error) {
    let message = data?.error || error.message
    try { message = (await error.context?.json())?.error || message } catch { /* response nemusí byť JSON */ }
    throw new Error(message || 'Prechod na VIP sa nepodarilo dokončiť.')
  }
  return data
}

export async function getVipUpgradePreview() {
  if (!supabase) throw new Error('Platby zatiaľ nie sú dostupné.')
  const { data, error } = await supabase.functions.invoke('stripe-upgrade-subscription', { body: { action: 'preview' } })
  if (error) {
    let message = data?.error || error.message
    try { message = (await error.context?.json())?.error || message } catch { /* response nemusí byť JSON */ }
    throw new Error(message || 'Náhľad upgradu sa nepodarilo načítať.')
  }
  return data
}

export async function getVipUpgradeStatus() {
  if (!supabase) throw new Error('Platby zatiaľ nie sú dostupné.')
  const { data, error } = await supabase.functions.invoke('stripe-upgrade-subscription', { body: { action: 'status' } })
  if (error) {
    let message = data?.error || error.message
    try { message = (await error.context?.json())?.error || message } catch { /* response nemusí byť JSON */ }
    throw new Error(message || 'Stav prechodu na VIP sa nepodarilo načítať.')
  }
  return data
}
