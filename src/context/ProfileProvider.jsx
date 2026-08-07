import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { ProfileContext } from './profile-context'

const profileColumns = 'id, username, membership, membership_started_at, membership_expires_at, membership_status, avatar_url, created_at'

export default function ProfileProvider({ children }) {
  const [session, setSession] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [profile, setProfile] = useState(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileError, setProfileError] = useState('')
  const profileRequestRef = useRef(0)

  const loadProfile = useCallback(async (userId) => {
    if (!supabase || !userId) return
    const requestId = ++profileRequestRef.current
    setProfileLoading(true)
    setProfileError('')
    const { data, error } = await supabase.from('profiles').select(profileColumns).eq('id', userId).maybeSingle()
    if (requestId !== profileRequestRef.current) return
    setProfile(data)
    setProfileError(error
      ? 'Profil sa nepodarilo bezpečne načítať.'
      : data ? '' : 'Profil sa zatiaľ nenašiel. Dokončenie účtu môže chvíľu trvať.')
    setProfileLoading(false)
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

  const refreshProfile = useCallback(() => loadProfile(session?.user?.id), [loadProfile, session?.user?.id])

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
