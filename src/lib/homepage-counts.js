import { isSupabaseConfigured, supabase } from './supabase'

const CACHE_TTL = 60_000
let cachedCounts = null
let cachedAt = 0
let pendingRequest = null

function normalizeCount(value, label) {
  const count = Number(value)
  if (!Number.isSafeInteger(count) || count < 0) throw new Error(`${label} má neplatný formát.`)
  return count
}

export async function getHomepageCounts() {
  if (!isSupabaseConfigured || !supabase) throw new Error('Supabase nie je nakonfigurovaný.')

  if (cachedCounts && Date.now() - cachedAt < CACHE_TTL) return cachedCounts
  if (pendingRequest) return pendingRequest

  pendingRequest = supabase
    .rpc('get_homepage_counts')
    .then(({ data, error }) => {
      if (error) throw error
      cachedCounts = {
        memberCount: normalizeCount(data?.member_count, 'Počet členov'),
        videoCount: normalizeCount(data?.video_count, 'Počet videí'),
      }
      cachedAt = Date.now()
      return cachedCounts
    })
    .finally(() => { pendingRequest = null })

  return pendingRequest
}
