const CACHE_TTL_MS = 5 * 60 * 1000

type LatestVideo = {
  videoId: string
  title: string
  description: string
  thumbnail: string
  publishedAt: string
  youtubeUrl: string
}

let cachedResult: { video: LatestVideo; expiresAt: number } | null = null
let pendingRequest: Promise<LatestVideo> | null = null

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

function response(body: unknown, status = 200, cacheControl = 'no-store') {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': cacheControl },
  })
}

async function youtubeRequest(path: string, params: Record<string, string>, apiKey: string) {
  const url = new URL(`https://www.googleapis.com/youtube/v3/${path}`)
  Object.entries({ ...params, key: apiKey }).forEach(([key, value]) => url.searchParams.set(key, value))
  const result = await fetch(url)
  if (!result.ok) throw new Error(`YouTube API request failed (${result.status})`)
  return result.json()
}

async function resolveUploadsPlaylist(apiKey: string) {
  const configuredPlaylist = Deno.env.get('YOUTUBE_UPLOADS_PLAYLIST_ID')?.trim()
  if (configuredPlaylist) return configuredPlaylist

  const channelId = Deno.env.get('YOUTUBE_CHANNEL_ID')?.trim()
  if (!channelId) throw new Error('YouTube channel is not configured')
  const channels = await youtubeRequest('channels', { part: 'contentDetails', id: channelId }, apiKey)
  const playlistId = channels?.items?.[0]?.contentDetails?.relatedPlaylists?.uploads
  if (!playlistId) throw new Error('YouTube uploads playlist was not found')
  return String(playlistId)
}

function bestThumbnail(thumbnails: Record<string, { url?: string }> | undefined) {
  return thumbnails?.maxres?.url || thumbnails?.standard?.url || thumbnails?.high?.url || thumbnails?.medium?.url || thumbnails?.default?.url || ''
}

async function fetchLatestPublicVideo() {
  const apiKey = Deno.env.get('YOUTUBE_API_KEY')?.trim()
  if (!apiKey) throw new Error('YouTube API is not configured')
  const playlistId = await resolveUploadsPlaylist(apiKey)
  const playlist = await youtubeRequest('playlistItems', { part: 'contentDetails', playlistId, maxResults: '5' }, apiKey)
  const ids = (playlist?.items || []).map((item: { contentDetails?: { videoId?: string } }) => item.contentDetails?.videoId).filter(Boolean).join(',')
  if (!ids) throw new Error('YouTube uploads playlist is empty')

  const videos = await youtubeRequest('videos', { part: 'snippet,status', id: ids }, apiKey)
  const latest = (videos?.items || []).find((item: { status?: { privacyStatus?: string } }) => item.status?.privacyStatus === 'public')
  if (!latest?.id || !latest?.snippet) throw new Error('No public YouTube video was found')
  const snippet = latest.snippet
  return {
    videoId: String(latest.id),
    title: String(snippet.title || ''),
    description: String(snippet.description || ''),
    thumbnail: bestThumbnail(snippet.thumbnails),
    publishedAt: String(snippet.publishedAt || ''),
    youtubeUrl: `https://www.youtube.com/watch?v=${latest.id}`,
  }
}

async function latestVideo() {
  if (cachedResult && cachedResult.expiresAt > Date.now()) return { video: cachedResult.video, source: 'cache' }
  if (!pendingRequest) pendingRequest = fetchLatestPublicVideo().finally(() => { pendingRequest = null })
  const video = await pendingRequest
  cachedResult = { video, expiresAt: Date.now() + CACHE_TTL_MS }
  return { video, source: 'youtube' }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (!['GET', 'POST'].includes(request.method)) return response({ error: 'Method not allowed' }, 405)

  try {
    const result = await latestVideo()
    return response(result, 200, 'public, max-age=300, stale-while-revalidate=3600')
  } catch (error) {
    console.error('Latest YouTube video could not be refreshed', error instanceof Error ? error.message : 'Unknown error')
    if (cachedResult?.video) return response({ video: cachedResult.video, source: 'stale' }, 200, 'public, max-age=60, stale-while-revalidate=3600')
    return response({ video: null, source: 'fallback', error: 'Najnovšie YouTube video momentálne nie je dostupné.' }, 503, 'public, max-age=30')
  }
})
