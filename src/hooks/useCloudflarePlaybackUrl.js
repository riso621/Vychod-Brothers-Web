import { useEffect, useState } from 'react'
import { getCloudflarePlaybackUrl } from '../lib/cloudflare-stream'

const REFRESH_INTERVAL_MS = 14 * 60 * 1000

export function useCloudflarePlaybackUrl(videoUid, enabled = true, trailer = false) {
  const [url, setUrl] = useState(null)
  const [loading, setLoading] = useState(Boolean(videoUid && enabled))

  useEffect(() => {
    let active = true
    let timer

    const refresh = async () => {
      if (!videoUid || !enabled) {
        setUrl(null)
        setLoading(false)
        return
      }
      setLoading(true)
      try {
        const nextUrl = await getCloudflarePlaybackUrl(videoUid, trailer)
        if (active) setUrl(nextUrl)
      } catch {
        if (active) setUrl(null)
      } finally {
        if (active) {
          setLoading(false)
          timer = window.setTimeout(refresh, REFRESH_INTERVAL_MS)
        }
      }
    }

    refresh()
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [videoUid, enabled, trailer])

  return { url, loading }
}
