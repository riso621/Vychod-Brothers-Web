import { useEffect, useState } from 'react'
import { getSocialStats } from '../lib/social-stats'

export function useSocialStats() {
  const [state, setState] = useState({ data: {}, loading: true, error: false })

  useEffect(() => {
    let active = true
    getSocialStats()
      .then((data) => { if (active) setState({ data, loading: false, error: false }) })
      .catch(() => { if (active) setState({ data: {}, loading: false, error: true }) })
    return () => { active = false }
  }, [])

  return state
}
