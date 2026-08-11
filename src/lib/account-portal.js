export const PORTAL_POLL_INTERVAL_MS = 1200
export const PORTAL_POLL_TIMEOUT_MS = 10000
export const PORTAL_MARKER_TTL_MS = 2 * 60 * 60 * 1000

export function billingProfileSignature(profile) {
  if (!profile) return ''
  return [
    profile.membership,
    profile.membership_status,
    profile.membership_expires_at || '',
    profile.stripe_subscription_status || '',
    profile.stripe_cancel_at_period_end === true ? 'cancelled' : 'renewing',
  ].join('|')
}

export function writePortalMarker(storage, profile, userId, now = Date.now()) {
  storage.setItem('vb-billing-portal-return', JSON.stringify({
    version: 2,
    userId,
    profileSignature: billingProfileSignature(profile),
    createdAt: now,
  }))
}

export function readPortalMarker(storage, userId, now = Date.now()) {
  try {
    const marker = JSON.parse(storage.getItem('vb-billing-portal-return') || 'null')
    if (marker?.version === 2
      && marker.userId === userId
      && Number.isFinite(marker.createdAt)
      && now - marker.createdAt >= 0
      && now - marker.createdAt < PORTAL_MARKER_TTL_MS) return marker
  } catch { /* Invalid markers are removed below. */ }
  storage.removeItem('vb-billing-portal-return')
  return null
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

export async function reconcilePortalProfile(refreshProfile, baselineSignature, {
  signal,
  intervalMs = PORTAL_POLL_INTERVAL_MS,
  timeoutMs = PORTAL_POLL_TIMEOUT_MS,
  now = Date.now,
  pause = wait,
} = {}) {
  const deadline = now() + timeoutMs
  let latestProfile = null
  do {
    if (signal?.aborted) return { profile: null, changed: false }
    try { latestProfile = await refreshProfile({ silent: true }) } catch { /* Retry until the bounded deadline. */ }
    if (signal?.aborted) return { profile: null, changed: false }
    if (latestProfile && !baselineSignature) return { profile: latestProfile, changed: false }
    if (latestProfile && baselineSignature && billingProfileSignature(latestProfile) !== baselineSignature) {
      return { profile: latestProfile, changed: true }
    }
    const remaining = deadline - now()
    if (remaining <= 0) return { profile: latestProfile, changed: false }
    await pause(Math.min(intervalMs, remaining), signal)
  } while (!signal?.aborted)
  return { profile: latestProfile, changed: false }
}
