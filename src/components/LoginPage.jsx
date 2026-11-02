import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useProfile } from '../context/profile-context'
import { authErrorMessage, emailPattern, onboardingCheckoutPath } from '../lib/auth-flow'
import { isActiveClubMember } from '../lib/membership'
import OnboardingShell from './OnboardingShell'

function destination(profile, session) {
  return isActiveClubMember(profile, session?.user?.app_metadata?.role === 'admin') ? '/profil' : onboardingCheckoutPath
}

export default function LoginPage() {
  const { session, profile, authLoading, profileLoading } = useProfile()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!authLoading && !profileLoading && session) window.location.replace(destination(profile, session))
  }, [authLoading, profileLoading, profile, session])

  const submit = async (event) => {
    event.preventDefault()
    const normalizedEmail = email.trim().toLowerCase()
    if (!emailPattern.test(normalizedEmail)) return setError('Zadaj platnú e-mailovú adresu.')
    if (!password) return setError('Zadaj heslo.')
    if (!supabase) return setError('Prihlásenie momentálne nie je dostupné.')
    setSubmitting(true); setError(''); setStatus('')
    try {
      const { data, error: loginError } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password })
      if (loginError) throw loginError
      const { data: nextProfile, error: profileError } = await supabase.from('profiles').select('membership, membership_status, membership_expires_at').eq('id', data.user.id).maybeSingle()
      if (profileError) throw profileError
      window.location.replace(destination(nextProfile, data.session))
    } catch (loginError) {
      setError(authErrorMessage(loginError))
    } finally { setSubmitting(false) }
  }

  const resetPassword = async () => {
    const normalizedEmail = email.trim().toLowerCase()
    if (!emailPattern.test(normalizedEmail)) return setError('Najprv zadaj platný e-mail.')
    setError(''); setStatus('')
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(normalizedEmail, { redirectTo: `${window.location.origin}/reset-hesla?recovery=1` })
    if (resetError) setError(authErrorMessage(resetError))
    else setStatus('Ak účet existuje, poslali sme ti odkaz na obnovu hesla.')
  }

  if (authLoading || (session && profileLoading)) return <OnboardingShell eyebrow="VÝCHOD BROTHERS CLUB" title="Načítavame tvoj účet…"><div className="onboarding-loader" /></OnboardingShell>
  return <OnboardingShell eyebrow="VÝCHOD BROTHERS CLUB" title="Vitaj späť" intro="Prihlás sa a pokračuj tam, kde si skončil.">
    <form className="onboarding-form" onSubmit={submit} noValidate>
      <label>E-mail<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" inputMode="email" disabled={submitting} required /></label>
      <label>Heslo<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" disabled={submitting} required /></label>
      <button className="onboarding-forgot" type="button" onClick={resetPassword}>Zabudol som heslo</button>
      {error && <p className="onboarding-error" role="alert">{error}</p>}
      {status && <p className="onboarding-success" role="status">{status}</p>}
      <button type="submit" disabled={submitting}>{submitting ? 'PRIHLASUJEM…' : 'PRIHLÁSIŤ SA'}</button>
    </form>
    <p className="onboarding-switch">Ešte nemáš účet? <a href="/registracia">Zaregistruj sa.</a></p>
  </OnboardingShell>
}
