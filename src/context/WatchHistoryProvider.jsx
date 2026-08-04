import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useProfile } from './profile-context'
import { WatchHistoryContext } from './watch-history-context'

const historyColumns = 'id, user_id, video_id, position_seconds, duration_seconds, progress_percent, completed, started_at, last_watched_at, updated_at'

const normalizeProgress = ({ positionSeconds, durationSeconds, completed }) => {
  if (completed) return 100
  if (!durationSeconds) return 0
  return Math.min(100, Math.max(0, (positionSeconds / durationSeconds) * 100))
}

export default function WatchHistoryProvider({ children }) {
  const { session, authLoading } = useProfile()
  const [history, setHistory] = useState(new Map())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    const userId = session?.user?.id
    if (!supabase || !userId) {
      setHistory(new Map())
      setLoading(false)
      setError('')
      return undefined
    }

    setLoading(true)
    setError('')
    supabase
      .from('watch_history')
      .select(historyColumns)
      .order('last_watched_at', { ascending: false })
      .then(({ data, error: queryError }) => {
        if (!active) return
        if (queryError) {
          setError('Históriu pozerania sa nepodarilo načítať.')
          setHistory(new Map())
          return
        }
        setHistory(new Map((data || []).map((entry) => [entry.video_id, entry])))
      })
      .finally(() => { if (active) setLoading(false) })

    return () => { active = false }
  }, [session?.user?.id])

  const saveProgress = useCallback(async (videoId, values) => {
    const userId = session?.user?.id
    if (!supabase || !userId || !videoId) return null

    const durationSeconds = Number.isFinite(values.durationSeconds) ? Math.max(0, Math.round(values.durationSeconds)) : null
    const positionSeconds = Number.isFinite(values.positionSeconds) ? Math.max(0, Math.round(values.positionSeconds)) : 0
    const progressPercent = normalizeProgress({ positionSeconds, durationSeconds, completed: values.completed })
    const completed = Boolean(values.completed || progressPercent >= 90)
    const timestamp = new Date().toISOString()
    const record = {
      user_id: userId,
      video_id: videoId,
      position_seconds: positionSeconds,
      duration_seconds: durationSeconds,
      progress_percent: completed ? 100 : Number(progressPercent.toFixed(2)),
      completed,
      last_watched_at: timestamp,
      updated_at: timestamp,
    }
    const { data, error: saveError } = await supabase
      .from('watch_history')
      .upsert(record, { onConflict: 'user_id,video_id' })
      .select(historyColumns)
      .single()
    if (saveError) {
      setError('Pozíciu videa sa nepodarilo uložiť.')
      throw saveError
    }
    setHistory((current) => new Map(current).set(videoId, data))
    return data
  }, [session?.user?.id])

  const value = useMemo(() => ({
    history,
    loading: authLoading || loading,
    error,
    isEnabled: Boolean(session?.user?.id),
    getProgress: (videoId) => history.get(videoId) || null,
    saveProgress,
  }), [authLoading, error, history, loading, saveProgress, session?.user?.id])

  return <WatchHistoryContext.Provider value={value}>{children}</WatchHistoryContext.Provider>
}
