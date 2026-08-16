import { supabase } from './supabase'

const videoColumns = 'id, title, slug, description, thumbnail_url, provider, provider_video_id, trailer_provider_video_id, access_level, published, featured, duration, created_at, updated_at'
let publishedVideosPromise = null
let publishedVideosCache = null
let publishedVideosCachedAt = 0
const PUBLISHED_VIDEOS_TTL_MS = 30_000

function mapVideo(row) {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    shortDescription: row.description || '',
    description: row.description || '',
    thumbnail: row.thumbnail_url || '',
    poster: row.thumbnail_url || '',
    previewImage: row.thumbnail_url || '',
    duration: row.duration || '—',
    publishedAt: row.created_at,
    category: row.provider,
    accessLevel: row.access_level,
    provider: row.provider,
    featured: row.featured,
    status: row.published ? 'published' : 'draft',
    youtubeUrl: row.provider === 'youtube' && row.provider_video_id
      ? `https://www.youtube.com/watch?v=${row.provider_video_id}`
      : '',
    streamVideoId: ['stream', 'cloudflare_stream'].includes(row.provider) ? row.provider_video_id || '' : '',
    trailerStreamVideoId: row.trailer_provider_video_id || '',
    tags: [],
  }
}

export function invalidateVideoCache() {
  publishedVideosPromise = null
  publishedVideosCache = null
  publishedVideosCachedAt = 0
}

export async function getPublishedVideos({ force = false } = {}) {
  if (!supabase) throw new Error('Supabase nie je nakonfigurovaný.')
  if (!force && publishedVideosCache && Date.now() - publishedVideosCachedAt < PUBLISHED_VIDEOS_TTL_MS) {
    return publishedVideosCache
  }
  if (!publishedVideosPromise) {
    publishedVideosPromise = supabase
      .from('videos')
      .select(videoColumns)
      .eq('published', true)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) throw error
        publishedVideosCache = (data || []).map(mapVideo)
        publishedVideosCachedAt = Date.now()
        return publishedVideosCache
      })
      .finally(() => { publishedVideosPromise = null })
      .catch((error) => {
        throw error
      })
  }
  return publishedVideosPromise
}

export async function getPublishedVideoBySlug(slug) {
  if (!supabase) throw new Error('Supabase nie je nakonfigurovaný.')
  if (publishedVideosCache && Date.now() - publishedVideosCachedAt < PUBLISHED_VIDEOS_TTL_MS) {
    return publishedVideosCache.find((video) => video.slug === slug) || null
  }
  if (publishedVideosPromise) {
    const videos = await publishedVideosPromise
    return videos.find((video) => video.slug === slug) || null
  }

  const { data, error } = await supabase
    .from('videos')
    .select(videoColumns)
    .eq('published', true)
    .eq('slug', slug)
    .maybeSingle()
  if (error) throw error
  return data ? mapVideo(data) : null
}
