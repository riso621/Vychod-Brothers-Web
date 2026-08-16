import * as tus from 'tus-js-client'
import { supabase } from './supabase'

export async function createCloudflareUpload(file, accessLevel, assetType = 'full') {
  if (!supabase) throw new Error('Supabase nie je nakonfigurovaný.')
  const { data, error } = await supabase.functions.invoke('cloudflare-stream-upload-url', {
    body: { fileName: file.name, fileSize: file.size, accessLevel, assetType },
  })
  if (error || !data?.uploadUrl || !data?.uid) {
    throw new Error(data?.error || error?.message || 'Nepodarilo sa pripraviť Cloudflare upload.')
  }
  return data
}

export function uploadCloudflareVideo({ uploadUrl, file, onProgress, signal }) {
  return new Promise((resolve, reject) => {
    const upload = new tus.Upload(file, {
      uploadUrl,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      chunkSize: 6 * 1024 * 1024,
      removeFingerprintOnSuccess: true,
      onError: reject,
      onProgress: (uploaded, total) => onProgress?.(total ? Math.round((uploaded / total) * 100) : 0),
      onSuccess: resolve,
    })
    const abort = () => upload.abort(true).finally(() => reject(new DOMException('Upload bol zrušený.', 'AbortError')))
    if (signal?.aborted) return abort()
    signal?.addEventListener('abort', abort, { once: true })
    upload.start()
  })
}

export async function getCloudflareUploadStatus(videoUid) {
  if (!supabase || !videoUid) throw new Error('Chýba identifikátor uploadu.')
  const { data, error } = await supabase.functions.invoke('cloudflare-stream-upload-url', {
    body: { action: 'status', videoUid },
  })
  if (error || typeof data?.ready !== 'boolean') throw new Error(data?.error || error?.message || 'Stav videa sa nepodarilo overiť.')
  return data
}

export async function waitForCloudflareUpload(videoUid, { signal, onStatus, timeoutMs = 5 * 60 * 1000 } = {}) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    if (signal?.aborted) throw new DOMException('Upload bol zrušený.', 'AbortError')
    const status = await getCloudflareUploadStatus(videoUid)
    onStatus?.(status)
    if (status.ready) return status
    await new Promise((resolve, reject) => {
      const timer = window.setTimeout(resolve, 2500)
      signal?.addEventListener('abort', () => { window.clearTimeout(timer); reject(new DOMException('Upload bol zrušený.', 'AbortError')) }, { once: true })
    })
  }
  throw new Error('Cloudflare video stále spracúva. Skúste stav overiť znova.')
}

export async function cleanupCloudflareUpload(videoUid) {
  if (!supabase || !videoUid) return
  const { data, error } = await supabase.functions.invoke('cloudflare-stream-delete-video', {
    body: { action: 'cleanup-upload', expectedUid: videoUid },
  })
  if (error || !data?.uploadCleaned) throw new Error(data?.error || error?.message || 'Dočasný upload sa nepodarilo vyčistiť.')
}

export async function getCloudflarePlaybackUrl(videoUid, trailer = false) {
  if (!supabase || !videoUid) return null
  const { data, error } = await supabase.functions.invoke('cloudflare-stream-playback-token', {
    body: { videoUid, trailer },
  })
  if (error || !data?.playerUrl) return null
  return data.playerUrl
}

export async function deleteVideoFromProvider(videoId) {
  if (!supabase || !videoId) throw new Error('Video sa nepodarilo odstrániť.')
  const { data, error } = await supabase.functions.invoke('cloudflare-stream-delete-video', {
    body: { id: videoId },
  })
  if (error || !data?.deleted) {
    let message = data?.error
    if (!message && error?.context instanceof Response) {
      try {
        message = (await error.context.clone().json())?.error
      } catch {
        // Supabase may return a response without a JSON body.
      }
    }
    throw new Error(message || 'Video sa nepodarilo bezpečne odstrániť.')
  }
  return data
}

export async function deleteTrailerFromProvider(videoId, expectedUid = '') {
  if (!supabase || !videoId) throw new Error('Trailer sa nepodarilo odstrániť.')
  const { data, error } = await supabase.functions.invoke('cloudflare-stream-delete-video', {
    body: { id: videoId, action: expectedUid ? 'cleanup-trailer' : 'delete-trailer', expectedUid },
  })
  if (error || !data?.trailerDeleted) throw new Error(data?.error || error?.message || 'Trailer sa nepodarilo bezpečne odstrániť.')
  return data
}
