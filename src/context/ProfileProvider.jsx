import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { ProfileContext } from './profile-context'

const profileColumns = 'id, username, membership, avatar_url, created_at'

export default function ProfileProvider({ children }) {
  const [session, setSession] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [profile, setProfile] = useState(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileError, setProfileError] = useState('')

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

    let active = true
    setProfileLoading(true)
    setProfileError('')

    supabase
      .from('profiles')
      .select(profileColumns)
      .eq('id', session.user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return
        setProfile(data)
        setProfileError(error
          ? 'Profil sa nepodarilo bezpečne načítať.'
          : data ? '' : 'Profil sa zatiaľ nenašiel. Dokončenie účtu môže chvíľu trvať.')
        setProfileLoading(false)
      })

    return () => { active = false }
  }, [session?.user?.id])

  const signOut = async () => {
    if (supabase) await supabase.auth.signOut()
  }

  const value = useMemo(() => ({
    session,
    profile,
    authLoading,
    profileLoading,
    profileError,
    signOut,
  }), [session, profile, authLoading, profileLoading, profileError])

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
}
