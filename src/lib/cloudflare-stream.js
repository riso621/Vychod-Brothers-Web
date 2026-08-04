import * as tus from 'tus-js-client'
import { supabase } from './supabase'

export async function createCloudflareUpload(file, accessLevel) {
  if (!supabase) throw new Error('Supabase nie je nakonfigurovaný.')
  const { data, error } = await supabase.functions.invoke('cloudflare-stream-upload-url', {
    body: { fileName: file.name, fileSize: file.size, accessLevel },
  })
  if (error || !data?.uploadUrl || !data?.uid) {
    throw new Error(data?.error || error?.message || 'Nepodarilo sa pripraviť Cloudflare upload.')
  }
  return data
}

export function uploadCloudflareVideo({ uploadUrl, file, onProgress }) {
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
    upload.start()
  })
}

export async function getCloudflarePlaybackUrl(videoUid) {
  if (!supabase || !videoUid) return null
  const { data, error } = await supabase.functions.invoke('cloudflare-stream-playback-token', {
    body: { videoUid },
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
