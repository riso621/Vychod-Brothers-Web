import * as tus from 'tus-js-client'
import { supabase } from './supabase'

export const SIGNED_URL_TTL_SECONDS = 15 * 60
const SIGNED_URL_REFRESH_MS = 14 * 60 * 1000
const signedUrlCache = new Map()

function getStorageEndpoint() {
  const projectUrl = import.meta.env?.VITE_SUPABASE_URL
  if (!projectUrl) throw new Error('Supabase nie je nakonfigurovaný.')
  const projectId = new URL(projectUrl).hostname.split('.')[0]
  return `https://${projectId}.storage.supabase.co/storage/v1/upload/resumable`
}

export function createStoragePath(userId, file) {
  const extension = file.name.split('.').pop()?.toLowerCase() || 'bin'
  return `${userId}/${crypto.randomUUID()}.${extension}`
}

export async function uploadStorageFile({ bucket, path, file, onProgress }) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error('Prihlásenie vypršalo. Prihlás sa znova.')

  return new Promise((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint: getStorageEndpoint(),
      retryDelays: [0, 3000, 5000, 10000, 20000],
      headers: { authorization: `Bearer ${session.access_token}` },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      chunkSize: 6 * 1024 * 1024,
      metadata: {
        bucketName: bucket,
        objectName: path,
        contentType: file.type,
        cacheControl: '3600',
      },
      onError: reject,
      onProgress: (uploaded, total) => onProgress?.(total ? Math.round((uploaded / total) * 100) : 0),
      onSuccess: () => resolve(path),
    })

    upload.start()
  })
}

export async function getSignedStorageUrl(bucket, path, force = false) {
  if (!path || /^https?:\/\//i.test(path)) return null
  const key = `${bucket}:${path}`
  const cached = signedUrlCache.get(key)
  if (!force && cached?.refreshAt > Date.now()) return cached.url

  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, SIGNED_URL_TTL_SECONDS)
  if (error || !data?.signedUrl) return null
  signedUrlCache.set(key, { url: data.signedUrl, refreshAt: Date.now() + SIGNED_URL_REFRESH_MS })
  return data.signedUrl
}

export async function getSignedStorageUrls(bucket, paths, force = false) {
  const uniquePaths = [...new Set(paths.filter((path) => path && !/^https?:\/\//i.test(path)))]
  const result = new Map()
  const missing = []

  uniquePaths.forEach((path) => {
    const cached = signedUrlCache.get(`${bucket}:${path}`)
    if (!force && cached?.refreshAt > Date.now()) result.set(path, cached.url)
    else missing.push(path)
  })

  if (missing.length) {
    const { data, error } = await supabase.storage.from(bucket).createSignedUrls(missing, SIGNED_URL_TTL_SECONDS)
    if (!error) {
      ;(data || []).forEach((item) => {
        if (!item.signedUrl) return
        signedUrlCache.set(`${bucket}:${item.path}`, { url: item.signedUrl, refreshAt: Date.now() + SIGNED_URL_REFRESH_MS })
        result.set(item.path, item.signedUrl)
      })
    }
  }
  return result
}

export function clearSignedStorageUrl(bucket, path) {
  signedUrlCache.delete(`${bucket}:${path}`)
}
