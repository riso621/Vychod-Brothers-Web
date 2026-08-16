import { bearerToken, corsHeaders, json } from '../_shared/http.ts'
import { createUserClient } from '../_shared/supabase.ts'

const MAX_VIDEO_BYTES = 5 * 1024 * 1024 * 1024
const MAX_DURATION_SECONDS = 6 * 60 * 60

function metadataValue(value: string) {
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  bytes.forEach((byte) => { binary += String.fromCharCode(byte) })
  return btoa(binary)
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

  let body: { fileName?: string; fileSize?: number; accessLevel?: string; assetType?: string }
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Neplatné údaje uploadu.' }, 400)
  }

  const fileName = String(body.fileName || '')
  const fileSize = Number(body.fileSize)
  const accessLevel = String(body.accessLevel || '')
  const assetType = body.assetType === 'trailer' ? 'trailer' : 'full'
  if (!fileName.toLowerCase().endsWith('.mp4')) return json({ error: 'Video musí byť vo formáte MP4.' }, 400)
  if (!Number.isSafeInteger(fileSize) || fileSize <= 0 || fileSize > MAX_VIDEO_BYTES) return json({ error: 'Neplatná veľkosť videa.' }, 400)
  if (!['free', 'member', 'vip'].includes(accessLevel)) return json({ error: 'Neplatná úroveň prístupu.' }, 400)

  const accountId = Deno.env.get('CLOUDFLARE_ACCOUNT_ID')
  const apiToken = Deno.env.get('CLOUDFLARE_STREAM_API_TOKEN')
  if (!accountId || !apiToken) return json({ error: 'Cloudflare Stream nie je nakonfigurovaný.' }, 503)

  const expiry = new Date(Date.now() + 60 * 60 * 1000).toISOString()
  const uploadMetadata = [
    `name ${metadataValue(fileName)}`,
    `maxDurationSeconds ${metadataValue(String(MAX_DURATION_SECONDS))}`,
    assetType === 'trailer' || accessLevel === 'free' ? null : 'requiresignedurls',
    `expiry ${metadataValue(expiry)}`,
  ].filter(Boolean).join(',')

  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/stream?direct_user=true`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiToken}`,
      'Tus-Resumable': '1.0.0',
      'Upload-Length': String(fileSize),
      'Upload-Metadata': uploadMetadata,
      'Upload-Creator': user.id,
    },
  })

  const uploadUrl = response.headers.get('Location')
  const uid = response.headers.get('stream-media-id')
  if (!response.ok || !uploadUrl || !uid) {
    const detail = await response.text()
    console.error('Cloudflare direct upload failed', response.status, detail.slice(0, 500))
    return json({ error: 'Nepodarilo sa pripraviť bezpečný upload.' }, 502)
  }

  return json({ uploadUrl, uid, expiresAt: expiry })
})
