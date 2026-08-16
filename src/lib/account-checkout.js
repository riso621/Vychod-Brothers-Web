import { getMembershipStatus } from './membership.js'

export const CHECKOUT_POLL_INTERVAL_MS = 1250
export const CHECKOUT_POLL_TIMEOUT_MS = 9000

export function isConfirmedPaidMembership(profile) {
  return ['member', 'vip'].includes(profile?.membership)
    && profile?.membership_status === 'active'
    && getMembershipStatus(profile) === 'active'
}

export function confirmedCheckoutMessage(profile) {
  return isConfirmedPaidMembership(profile)
    ? 'Platba úspešná. Východ Brothers Club je aktívny.'
    : ''
}

export function checkoutCleanPath(href) {
  const url = new URL(href)
  url.searchParams.delete('checkout')
  url.searchParams.delete('session_id')
  url.searchParams.delete('billing')
  return `${url.pathname}${url.search}${url.hash}`
}

function wait(delay, signal) {
  return new Promise((resolve) => {
    const timer = window.setTimeout(resolve, delay)
    signal?.addEventListener('abort', () => {
      window.clearTimeout(timer)
      resolve()
    }, { once: true })
  })
}

export async function pollConfirmedMembership(refreshProfile, {
  signal,
  intervalMs = CHECKOUT_POLL_INTERVAL_MS,
  timeoutMs = CHECKOUT_POLL_TIMEOUT_MS,
  now = Date.now,
  pause = wait,
} = {}) {
  const deadline = now() + timeoutMs
  do {
    if (signal?.aborted) return null
    let currentProfile = null
    try {
      currentProfile = await refreshProfile({ silent: true })
    } catch {
      // Krátky sieťový výpadok nesmie ukončiť obmedzené overovanie webhooku.
    }
    if (signal?.aborted) return null
    if (isConfirmedPaidMembership(currentProfile)) return currentProfile
    const remaining = deadline - now()
    if (remaining <= 0) return null
    await pause(Math.min(intervalMs, remaining), signal)
  } while (!signal?.aborted)
  return null
}
