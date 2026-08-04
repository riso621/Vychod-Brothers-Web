import { bearerToken, corsHeaders, json } from '../_shared/http.ts'
import { createUserClient } from '../_shared/supabase.ts'

const TOKEN_TTL_SECONDS = 15 * 60

function base64Url(value: Uint8Array) {
  let binary = ''
  value.forEach((byte) => { binary += String.fromCharCode(byte) })
  return btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

function encodeJson(value: unknown) {
  return base64Url(new TextEncoder().encode(JSON.stringify(value)))
}

function parseSigningKey(raw: string) {
  const value = raw.trim()
  if (value.startsWith('{')) return JSON.parse(value)
  return JSON.parse(atob(value))
}

function playerHost(customerCode: string) {
  const value = customerCode.trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '')
  if (value.endsWith('.cloudflarestream.com')) return value
  if (value.startsWith('customer-')) return `${value}.cloudflarestream.com`
  return `customer-${value}.cloudflarestream.com`
}

async function createPlaybackToken(videoUid: string, keyId: string, rawKey: string) {
  const header = { alg: 'RS256', kid: keyId }
  const payload = { sub: videoUid, kid: keyId, exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS }
  const unsigned = `${encodeJson(header)}.${encodeJson(payload)}`
  const key = await crypto.subtle.importKey(
    'jwk',
    parseSigningKey(rawKey),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned))
  return `${unsigned}.${base64Url(new Uint8Array(signature))}`
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  let body: { videoUid?: string }
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Neplatná požiadavka.' }, 400)
  }
  const videoUid = String(body.videoUid || '').trim()
  if (!/^[a-zA-Z0-9]+$/.test(videoUid)) return json({ error: 'Video nie je dostupné.' }, 400)

  const token = bearerToken(request)
  const userToken = token.split('.').length === 3 ? token : ''
  const supabase = createUserClient(userToken)
  const { data: video, error: videoError } = await supabase
    .from('videos')
    .select('provider_video_id, access_level, published')
    .eq('provider', 'cloudflare_stream')
    .eq('provider_video_id', videoUid)
    .eq('published', true)
    .maybeSingle()
  if (videoError || !video) return json({ error: 'Video nie je dostupné.' }, 404)

  if (video.access_level !== 'free') {
    if (!userToken) return json({ error: 'Prihlásenie je povinné.' }, 401)
    const { data: { user }, error: userError } = await supabase.auth.getUser(userToken)
    if (userError || !user) return json({ error: 'Prihlásenie nie je platné.' }, 401)

    const isAdmin = user.app_metadata?.role === 'admin'
    if (!isAdmin) {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('membership, membership_status, membership_expires_at')
        .eq('id', user.id)
        .maybeSingle()
      if (profileError || !profile) return json({ error: 'Prístup sa nepodarilo overiť.' }, 403)
      const active = profile.membership_status === 'active'
        && (!profile.membership_expires_at || new Date(profile.membership_expires_at) > new Date())
      const allowed = active && (video.access_level === 'member'
        ? ['member', 'vip'].includes(profile.membership)
        : profile.membership === 'vip')
      if (!allowed) return json({ error: 'Nemáte prístup k tomuto videu.' }, 403)
    }
  }

  const customerCode = Deno.env.get('CLOUDFLARE_STREAM_CUSTOMER_CODE')
  if (!customerCode) return json({ error: 'Cloudflare Stream nie je nakonfigurovaný.' }, 503)
  const streamHost = playerHost(customerCode)
  if (video.access_level === 'free') {
    return json({
      playerUrl: `https://${streamHost}/${videoUid}/iframe`,
      expiresAt: null,
    })
  }

  const keyId = Deno.env.get('CLOUDFLARE_STREAM_SIGNING_KEY_ID')
  const signingKey = Deno.env.get('CLOUDFLARE_STREAM_SIGNING_KEY')
  if (!keyId || !signingKey) return json({ error: 'Cloudflare Stream signing nie je nakonfigurovaný.' }, 503)

  try {
    const playbackToken = await createPlaybackToken(videoUid, keyId, signingKey)
    return json({
      playerUrl: `https://${streamHost}/${playbackToken}/iframe`,
      expiresAt: new Date(Date.now() + TOKEN_TTL_SECONDS * 1000).toISOString(),
    })
  } catch (error) {
    console.error('Cloudflare playback token failed', error)
    return json({ error: 'Video momentálne nie je dostupné.' }, 500)
  }
})
