import { bearerToken, corsHeaders, json } from '../_shared/http.ts'
import { createAdminClient, createUserClient } from '../_shared/supabase.ts'

type VideoRow = {
  id: string
  provider: 'youtube' | 'stream' | 'cloudflare_stream'
  provider_video_id: string | null
  thumbnail_url: string | null
}

function thumbnailPath(value: string | null) {
  const path = String(value || '').trim().replace(/\\/g, '/')
  if (!path || /^https?:\/\//i.test(path) || path.startsWith('/') || path.includes('..')) return null
  return path.startsWith('thumbnails/') ? path.slice('thumbnails/'.length) : path
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const token = bearerToken(request)
  if (!token) return json({ error: 'Prihlásenie je povinné.' }, 401)

  const supabase = createUserClient(token)
  const { data: { user }, error: userError } = await supabase.auth.getUser(token)
  if (userError || !user) return json({ error: 'Prihlásenie nie je platné.' }, 401)
  if (user.app_metadata?.role !== 'admin') return json({ error: 'Nemáte oprávnenie.' }, 403)

  let body: { id?: string; slug?: string }
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Neplatná požiadavka.' }, 400)
  }

  const id = String(body.id || '').trim()
  const slug = String(body.slug || '').trim()
  if (!id && !slug) return json({ error: 'Chýba identifikátor videa.' }, 400)

  let query = supabase.from('videos').select('id, provider, provider_video_id, thumbnail_url')
  query = id ? query.eq('id', id) : query.eq('slug', slug)
  const { data, error: videoError } = await query.maybeSingle()
  const video = data as VideoRow | null

  if (videoError) return json({ error: 'Video sa nepodarilo načítať.' }, 500)
  if (!video) return json({ deleted: true, alreadyDeleted: true })

  if (video.provider === 'stream') {
    return json({ error: 'Legacy Stream video vyžaduje manuálne overenie a nebolo odstránené.' }, 409)
  }

  if (video.provider === 'cloudflare_stream') {
    const videoUid = String(video.provider_video_id || '').trim()
    if (!/^[a-zA-Z0-9]+$/.test(videoUid)) {
      return json({ error: 'Cloudflare video nemá platný identifikátor a nebolo odstránené.' }, 409)
    }

    const accountId = Deno.env.get('CLOUDFLARE_ACCOUNT_ID')
    const apiToken = Deno.env.get('CLOUDFLARE_STREAM_API_TOKEN')
    if (!accountId || !apiToken) return json({ error: 'Cloudflare Stream nie je nakonfigurovaný.' }, 503)

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${videoUid}`,
      { method: 'DELETE', headers: { Authorization: `Bearer ${apiToken}` } },
    )
    if (!response.ok && response.status !== 404) {
      console.error('Cloudflare Stream delete failed', response.status)
      return json({ error: 'Cloudflare video sa nepodarilo odstrániť. Databázový záznam zostal zachovaný.' }, 502)
    }
  }

  const path = thumbnailPath(video.thumbnail_url)
  if (path) {
    const { error: thumbnailError } = await supabase.storage.from('thumbnails').remove([path])
    if (thumbnailError) {
      console.error('Thumbnail cleanup failed after provider deletion')
      return json({ error: 'Thumbnail sa nepodarilo odstrániť. Databázový záznam zostal zachovaný a operáciu môžete zopakovať.' }, 502)
    }
  }

  const { error: deleteError } = await supabase.from('videos').delete().eq('id', video.id)
  if (deleteError) {
    return json({ error: 'Video bolo odstránené z poskytovateľa, ale databázový záznam sa nepodarilo odstrániť. Operáciu môžete bezpečne zopakovať.' }, 500)
  }

  const admin = createAdminClient()
  await admin.from('admin_audit_logs').insert({
    admin_user_id: user.id, admin_email: user.email, action_type: 'video.delete',
    entity_type: 'video', entity_id: video.id, description: `Odstránené video ${video.id}`,
    before_data: { provider: video.provider, thumbnail_url: video.thumbnail_url ? 'stored' : null },
  })

  return json({ deleted: true, thumbnailRemoved: Boolean(path) })
})
