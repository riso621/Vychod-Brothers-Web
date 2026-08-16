import { isSupabaseConfigured, supabase } from './supabase'

const CACHE_TTL = 60_000
let cachedCount = null
let cachedAt = 0
let pendingRequest = null

export async function getClubMemberCount() {
  if (!isSupabaseConfigured || !supabase) throw new Error('Supabase nie je nakonfigurovaný.')

  if (cachedCount !== null && Date.now() - cachedAt < CACHE_TTL) return cachedCount
  if (pendingRequest) return pendingRequest

  pendingRequest = supabase
    .rpc('get_active_club_member_count')
    .then(({ data, error }) => {
      if (error) throw error
      const count = Number(data)
      if (!Number.isSafeInteger(count) || count < 0) throw new Error('Počet členov má neplatný formát.')
      cachedCount = count
      cachedAt = Date.now()
      return count
    })
    .finally(() => { pendingRequest = null })

  return pendingRequest
}
