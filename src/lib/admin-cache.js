const CACHE_TTL = 45_000
const cache = new Map()
const pending = new Map()

export function readAdminCache(key) {
  return cache.get(key)?.value ?? null
}

export function isAdminCacheFresh(key) {
  const entry = cache.get(key)
  return Boolean(entry && Date.now() - entry.savedAt < CACHE_TTL)
}

export async function cachedAdminLoad(key, loader, { force = false } = {}) {
  if (!force && isAdminCacheFresh(key)) return cache.get(key).value
  if (pending.has(key)) return pending.get(key)
  const request = Promise.resolve(loader()).then((value) => {
    cache.set(key, { value, savedAt: Date.now() })
    return value
  }).finally(() => pending.delete(key))
  pending.set(key, request)
  return request
}

export function invalidateAdminCache(...keys) {
  keys.forEach((key) => cache.delete(key))
}
