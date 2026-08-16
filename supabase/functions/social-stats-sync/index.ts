import { createAdminClient } from '../_shared/supabase.ts'

const MIN_SYNC_INTERVAL_MS = 14 * 60 * 1000
const platforms = ['youtube', 'instagram', 'tiktok'] as const
type Platform = typeof platforms[number]

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}

function requiredSecret(name: string) {
  const value = Deno.env.get(name)?.trim() || ''
  if (!value) throw new Error(`${name} is not configured`)
  return value
}

function validCount(value: unknown) {
  const count = Number(value)
  if (!Number.isSafeInteger(count) || count < 0) throw new Error('Provider returned an invalid follower count')
  return count
}

async function fetchYouTube() {
  const channelId = requiredSecret('YOUTUBE_CHANNEL_ID')
  const apiKey = requiredSecret('YOUTUBE_API_KEY')
  const url = new URL('https://www.googleapis.com/youtube/v3/channels')
  url.searchParams.set('part', 'statistics')
  url.searchParams.set('id', channelId)
  url.searchParams.set('key', apiKey)
  const result = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!result.ok) throw new Error(`YouTube API request failed (${result.status})`)
  const payload = await result.json()
  return validCount(payload?.items?.[0]?.statistics?.subscriberCount)
}

async function fetchInstagram() {
  const userId = requiredSecret('INSTAGRAM_USER_ID')
  const accessToken = requiredSecret('INSTAGRAM_ACCESS_TOKEN')
  const apiVersion = Deno.env.get('INSTAGRAM_GRAPH_API_VERSION')?.trim() || 'v23.0'
  const url = new URL(`https://graph.facebook.com/${apiVersion}/${encodeURIComponent(userId)}`)
  url.searchParams.set('fields', 'followers_count')
  url.searchParams.set('access_token', accessToken)
  const result = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!result.ok) throw new Error(`Instagram API request failed (${result.status})`)
  const payload = await result.json()
  return validCount(payload?.followers_count)
}

async function fetchTikTok() {
  const tokenBody = new URLSearchParams({
    client_key: requiredSecret('TIKTOK_CLIENT_KEY'),
    client_secret: requiredSecret('TIKTOK_CLIENT_SECRET'),
    grant_type: 'refresh_token',
    refresh_token: requiredSecret('TIKTOK_REFRESH_TOKEN'),
  })
  const tokenResult = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Cache-Control': 'no-cache' },
    body: tokenBody,
  })
  if (!tokenResult.ok) throw new Error(`TikTok OAuth refresh failed (${tokenResult.status})`)
  const tokenPayload = await tokenResult.json()
  const accessToken = String(tokenPayload?.access_token || '')
  if (!accessToken) throw new Error('TikTok OAuth refresh returned no access token')
  const result = await fetch('https://open.tiktokapis.com/v2/user/info/?fields=follower_count', {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  })
  if (!result.ok) throw new Error(`TikTok API request failed (${result.status})`)
  const payload = await result.json()
  if (payload?.error?.code && payload.error.code !== 'ok') throw new Error('TikTok API rejected the user info request')
  return validCount(payload?.data?.user?.follower_count)
}

const fetchers: Record<Platform, () => Promise<number>> = {
  youtube: fetchYouTube,
  instagram: fetchInstagram,
  tiktok: fetchTikTok,
}

function safeError(error: unknown) {
  const message = error instanceof Error ? error.message : 'Unknown provider error'
  return message.replace(/[?&](?:access_token|key)=[^&\s]+/gi, '').slice(0, 300)
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  const expectedSecret = Deno.env.get('SOCIAL_STATS_SYNC_SECRET')?.trim() || ''
  const suppliedSecret = request.headers.get('x-social-sync-secret')?.trim() || ''
  if (!expectedSecret || !suppliedSecret || suppliedSecret !== expectedSecret) return json({ error: 'Unauthorized' }, 401)

  const admin = createAdminClient()
  const { data: stored, error: readError } = await admin
    .from('social_stats')
    .select('platform,synced_at')
    .in('platform', [...platforms])
  if (readError) return json({ error: 'Social statistics storage is unavailable.' }, 500)

  const previous = new Map((stored || []).map((row) => [row.platform, row.synced_at]))
  const results = await Promise.all(platforms.map(async (platform) => {
    const syncedAt = previous.get(platform)
    if (syncedAt && Date.now() - new Date(syncedAt).getTime() < MIN_SYNC_INTERVAL_MS) {
      return { platform, status: 'cached' }
    }
    try {
      const followers = await fetchers[platform]()
      const now = new Date().toISOString()
      const { error } = await admin.from('social_stats').upsert({
        platform, followers, synced_at: now, updated_at: now, status: 'ok', last_error: null,
      }, { onConflict: 'platform' })
      if (error) throw new Error('The synchronized value could not be stored')
      return { platform, status: 'updated' }
    } catch (error) {
      const message = safeError(error)
      await admin.from('social_stats').upsert({
        platform, status: 'error', last_error: message, updated_at: new Date().toISOString(),
      }, { onConflict: 'platform' })
      console.error(`Social stats sync failed for ${platform}: ${message}`)
      return { platform, status: 'error' }
    }
  }))

  return json({ results })
})
