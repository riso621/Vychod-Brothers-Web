import { isSupabaseConfigured, supabase } from './supabase'

const CACHE_TTL = 5 * 60_000
let cachedStats = null
let cachedAt = 0
let pendingRequest = null

export function formatSocialCount(value) {
  if (!Number.isSafeInteger(value) || value < 0) return null
  const format = (number) => new Intl.NumberFormat('sk-SK', { maximumFractionDigits: 1 }).format(number)
  if (value >= 1_000_000) return `${format(value / 1_000_000)} mil.`
  if (value >= 1_000) return `${format(value / 1_000)} tis.`
  return format(value)
}

export async function getSocialStats({ force = false } = {}) {
  if (!isSupabaseConfigured || !supabase) throw new Error('Supabase nie je nakonfigurovaný.')
  if (!force && cachedStats && Date.now() - cachedAt < CACHE_TTL) return cachedStats
  if (pendingRequest) return pendingRequest

  pendingRequest = supabase.rpc('get_public_social_stats').then(({ data, error }) => {
    if (error) throw error
    cachedStats = Object.fromEntries((data || []).map((row) => [row.platform, {
      platform: row.platform,
      followers: Number.isSafeInteger(Number(row.followers)) ? Number(row.followers) : null,
      syncedAt: row.synced_at || null,
    }]))
    cachedAt = Date.now()
    return cachedStats
  }).finally(() => { pendingRequest = null })

  return pendingRequest
}

export function invalidateSocialStatsCache() {
  cachedStats = null
  cachedAt = 0
}
