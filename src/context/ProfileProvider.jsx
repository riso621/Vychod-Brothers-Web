import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { ProfileContext } from './profile-context'

const profileColumns = 'id, username, membership, membership_started_at, membership_expires_at, membership_status, stripe_subscription_id, stripe_subscription_status, stripe_cancel_at_period_end, avatar_url, created_at'

export default function ProfileProvider({ children }) {
  const [session, setSession] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [profile, setProfile] = useState(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileError, setProfileError] = useState('')
  const profileRequestRef = useRef(0)

  const loadProfile = useCallback(async (userId, { silent = false } = {}) => {
    if (!supabase || !userId) return null
    const requestId = ++profileRequestRef.current
    if (!silent) setProfileLoading(true)
    setProfileError('')
    const { data, error } = await supabase.from('profiles').select(profileColumns).eq('id', userId).maybeSingle()
    if (requestId !== profileRequestRef.current) return null
    setProfile(data)
    setProfileError(error
      ? 'Profil sa nepodarilo bezpečne načítať.'
      : data ? '' : 'Profil sa zatiaľ nenašiel. Dokončenie účtu môže chvíľu trvať.')
    setProfileLoading(false)
    return error ? null : data
  }, [])

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false)
      return undefined
    }

    let active = true
    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return
      setSession(data.session)
      setProfileError(error ? 'Prihlásenie sa nepodarilo načítať.' : '')
      setAuthLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      if (!nextSession) {
        profileRequestRef.current += 1
        setProfile(null)
        setProfileLoading(false)
        setProfileError('')
      }
      setAuthLoading(false)
    })

    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!supabase || !session?.user?.id) {
      profileRequestRef.current += 1
      setProfile(null)
      setProfileLoading(false)
      return undefined
    }

    loadProfile(session.user.id)
    return undefined
  }, [session?.user?.id, loadProfile])

  useEffect(() => {
    if (!session?.user?.id) return undefined

    let lastRefreshAt = 0
    const refreshVisibleProfile = () => {
      if (document.visibilityState === 'hidden' || Date.now() - lastRefreshAt < 1000) return
      lastRefreshAt = Date.now()
      loadProfile(session.user.id, { silent: true })
    }
    const handlePageShow = (event) => {
      if (event.persisted) refreshVisibleProfile()
    }

    window.addEventListener('focus', refreshVisibleProfile)
    window.addEventListener('pageshow', handlePageShow)
    document.addEventListener('visibilitychange', refreshVisibleProfile)
    return () => {
      window.removeEventListener('focus', refreshVisibleProfile)
      window.removeEventListener('pageshow', handlePageShow)
      document.removeEventListener('visibilitychange', refreshVisibleProfile)
    }
  }, [session?.user?.id, loadProfile])

  const signOut = async () => {
    if (!supabase) return { error: null }
    profileRequestRef.current += 1
    setSession(null)
    setProfile(null)
    setProfileLoading(false)
    setProfileError('')
    const { error } = await supabase.auth.signOut({ scope: 'local' })
    return { error }
  }

  const refreshProfile = useCallback((options) => loadProfile(session?.user?.id, options), [loadProfile, session?.user?.id])

  const value = useMemo(() => ({
    session,
    profile,
    authLoading,
    profileLoading,
    profileError,
    refreshProfile,
    signOut,
  }), [session, profile, authLoading, profileLoading, profileError, refreshProfile])

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
}
