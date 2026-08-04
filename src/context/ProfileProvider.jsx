import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { ProfileContext } from './profile-context'

const profileColumns = 'id, username, membership, membership_started_at, membership_expires_at, membership_status, avatar_url, created_at'

export default function ProfileProvider({ children }) {
  const [session, setSession] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [profile, setProfile] = useState(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileError, setProfileError] = useState('')

  const loadProfile = useCallback(async (userId) => {
    if (!supabase || !userId) return
    setProfileLoading(true)
    setProfileError('')
    const { data, error } = await supabase.from('profiles').select(profileColumns).eq('id', userId).maybeSingle()
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
      setAuthLoading(false)
    })

    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!supabase || !session?.user?.id) {
      setProfile(null)
      setProfileLoading(false)
      return undefined
    }

    loadProfile(session.user.id)
    return undefined
  }, [session?.user?.id, loadProfile])

  const signOut = async () => {
    if (supabase) await supabase.auth.signOut()
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
