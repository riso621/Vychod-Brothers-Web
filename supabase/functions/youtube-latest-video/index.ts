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

function decodeXml(value = '') {
  return value
    .replace(/^<!\[CDATA\[|\]\]>$/g, '')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .trim()
}

function tagValue(xml: string, tag: string) {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'))
  return decodeXml(match?.[1] || '')
}

async function thumbnailFor(videoId: string) {
  const maxres = `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`
  try {
    const result = await fetch(maxres, { method: 'HEAD' })
    if (result.ok) return maxres
  } catch {
    // A missing max-resolution image safely falls back to the standard thumbnail.
  }
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
}

async function fetchLatestPublicVideo() {
  const channelId = Deno.env.get('YOUTUBE_CHANNEL_ID')?.trim() || ''
  if (!/^UC[A-Za-z0-9_-]{20,}$/.test(channelId)) throw new Error('YouTube channel is not configured')

  const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`
  const result = await fetch(feedUrl, { headers: { Accept: 'application/atom+xml, application/xml, text/xml' } })
  if (!result.ok) throw new Error(`YouTube RSS request failed (${result.status})`)
  const xml = await result.text()
  const entry = xml.match(/<entry>[\s\S]*?<\/entry>/i)?.[0] || ''
  const videoId = tagValue(entry, 'yt:videoId')
  const title = tagValue(entry, 'title')
  const publishedAt = tagValue(entry, 'published')
  if (!videoId || !title || !publishedAt) throw new Error('YouTube RSS feed did not contain a video')

  return {
    videoId,
    title,
    description: tagValue(entry, 'media:description'),
    thumbnail: await thumbnailFor(videoId),
    publishedAt,
    youtubeUrl: `https://www.youtube.com/watch?v=${videoId}`,
  }
}

async function latestVideo() {
  if (cachedResult && cachedResult.expiresAt > Date.now()) return { video: cachedResult.video, source: 'cache' }
  if (!pendingRequest) pendingRequest = fetchLatestPublicVideo().finally(() => { pendingRequest = null })
  const video = await pendingRequest
  cachedResult = { video, expiresAt: Date.now() + CACHE_TTL_MS }
  return { video, source: 'youtube-rss' }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (!['GET', 'POST'].includes(request.method)) return response({ error: 'Method not allowed' }, 405)

  try {
    const result = await latestVideo()
    return response(result, 200, 'public, max-age=300, stale-while-revalidate=3600')
  } catch (error) {
    console.error('Latest YouTube RSS video could not be refreshed', error instanceof Error ? error.message : 'Unknown error')
    if (cachedResult?.video) return response({ video: cachedResult.video, source: 'stale' }, 200, 'public, max-age=60, stale-while-revalidate=3600')
    return response({ video: null, source: 'fallback', error: 'Najnovšie YouTube video momentálne nie je dostupné.' }, 503, 'public, max-age=30')
  }
})
