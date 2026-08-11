export const checkoutFlowTtlMs = 5 * 60 * 1000

export function readCheckoutMarker(storage, plan, userId, now = Date.now()) {
  try {
    const marker = JSON.parse(storage.getItem('vb-checkout-payment-flow') || 'null')
    const valid = marker?.version === 2
      && marker.plan === plan
      && marker.userId === userId
      && ['subscription-payment', 'vip-upgrade'].includes(marker.kind)
      && ['verifying', 'success'].includes(marker.status)
      && Number.isFinite(marker.createdAt)
      && now - marker.createdAt >= 0
      && now - marker.createdAt < checkoutFlowTtlMs
    if (valid) return marker
  } catch { /* Invalid data is removed below. */ }
  storage.removeItem('vb-checkout-payment-flow')
  return null
}

export function writeCheckoutMarker(storage, { plan, userId, kind, status = 'verifying' }, now = Date.now()) {
  storage.setItem('vb-checkout-payment-flow', JSON.stringify({
    version: 2,
    plan,
    userId,
    kind,
    status,
    createdAt: now,
  }))
}

export function clearCheckoutMarker(storage) {
  storage.removeItem('vb-checkout-payment-flow')
}

export function classifyVipUpgradeState({ vipActive = false, status = '', hasClientSecret = false }) {
  if (vipActive) return 'success'
  if (status === 'requires_payment' && hasClientSecret) return 'payment'
  if (['processing', 'waiting_for_subscription', 'updated'].includes(status)) return 'verifying'
  return 'idle'
}
