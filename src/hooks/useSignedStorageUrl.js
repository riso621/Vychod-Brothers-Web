import { useEffect, useState } from 'react'
import { getSignedStorageUrl } from '../lib/storage'

const REFRESH_INTERVAL_MS = 14 * 60 * 1000

export function useSignedStorageUrl(bucket, path, enabled = true) {
  const [url, setUrl] = useState(null)
  const [loading, setLoading] = useState(Boolean(path && enabled))

  useEffect(() => {
    let active = true
    let timer

    const refresh = async (force = false) => {
      if (!path || !enabled) {
        setUrl(null)
        setLoading(false)
        return
      }
      setLoading(true)
      try {
        const nextUrl = await getSignedStorageUrl(bucket, path, force)
        if (!active) return
        setUrl(nextUrl)
      } catch {
        if (active) setUrl(null)
      } finally {
        if (active) {
          setLoading(false)
          timer = window.setTimeout(() => refresh(true), REFRESH_INTERVAL_MS)
        }
      }
    }

    refresh()
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [bucket, path, enabled])

  return { url, loading }
}
