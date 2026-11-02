import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useProfile } from '../context/profile-context'
import { authErrorMessage, emailPattern, onboardingCheckoutPath, registrationEmailFromUrl } from '../lib/auth-flow'
import { isActiveClubMember } from '../lib/membership'
import OnboardingShell from './OnboardingShell'

export default function RegistrationPage() {
  const { session, profile, authLoading, profileLoading } = useProfile()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState(registrationEmailFromUrl)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [confirmationEmail, setConfirmationEmail] = useState('')
  const [resending, setResending] = useState(false)

  useEffect(() => {
    if (authLoading || profileLoading || !session) return
    const admin = session.user.app_metadata?.role === 'admin'
    window.location.replace(isActiveClubMember(profile, admin) ? '/profil' : onboardingCheckoutPath)
  }, [authLoading, profileLoading, profile, session])

  const confirmationRedirect = `${window.location.origin}/auth/callback?next=${encodeURIComponent(onboardingCheckoutPath)}`

  const submit = async (event) => {
    event.preventDefault()
    if (submitting) return
    const normalizedFirst = firstName.trim()
    const normalizedLast = lastName.trim()
    const normalizedEmail = email.trim().toLowerCase()
    if (!normalizedFirst || !normalizedLast) return setError('Zadaj meno aj priezvisko.')
    if (!emailPattern.test(normalizedEmail)) return setError('Zadaj platnú e-mailovú adresu.')
    if (password.length < 8) return setError('Heslo musí mať aspoň 8 znakov.')
    if (!supabase) return setError('Registrácia momentálne nie je dostupná.')
    setSubmitting(true)
    setError('')
    try {
      const fullName = `${normalizedFirst} ${normalizedLast}`
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          emailRedirectTo: confirmationRedirect,
          data: { username: fullName, first_name: normalizedFirst, last_name: normalizedLast },
        },
      })
      if (signUpError) throw signUpError
      if (Array.isArray(data.user?.identities) && data.user.identities.length === 0) {
        setError('Účet s týmto e-mailom už existuje. Prihlás sa.')
        return
      }
      if (!data.session) {
        setConfirmationEmail(normalizedEmail)
        setPassword('')
        return
      }
      window.location.replace(onboardingCheckoutPath)
    } catch (signUpError) {
      setError(authErrorMessage(signUpError, 'register'))
    } finally {
      setSubmitting(false)
    }
  }

  const resend = async () => {
    if (!supabase || !confirmationEmail || resending) return
    setResending(true)
    setError('')
    const { error: resendError } = await supabase.auth.resend({ type: 'signup', email: confirmationEmail, options: { emailRedirectTo: confirmationRedirect } })
    if (resendError) setError(authErrorMessage(resendError, 'register'))
    setResending(false)
  }

  if (authLoading || (session && profileLoading)) return <OnboardingShell eyebrow="VÝCHOD BROTHERS CLUB" title="Načítavame tvoj účet…"><div className="onboarding-loader" /></OnboardingShell>

  if (confirmationEmail) return <OnboardingShell eyebrow="KROK 1 Z 2" title="Potvrď svoj e-mail" intro="Účet je takmer hotový.">
    <div className="onboarding-confirmation"><span aria-hidden="true">✉</span><p>Na adresu <strong>{confirmationEmail}</strong> sme poslali bezpečný potvrdzovací odkaz.</p><p>Po potvrdení ťa automaticky prevedieme k výberu členstva.</p></div>
    {error && <p className="onboarding-error" role="alert">{error}</p>}
    <button className="onboarding-secondary" type="button" onClick={resend} disabled={resending}>{resending ? 'Odosielam…' : 'Poslať e-mail znova'}</button>
    <a className="onboarding-text-link" href="/prihlasenie">Už potvrdené? Prihlás sa</a>
  </OnboardingShell>

  return <OnboardingShell eyebrow="KROK 1 Z 2" title="Vytvor si účet" intro="Jeden účet. Celý svet Východ Brothers.">
    <form className="onboarding-form" onSubmit={submit} noValidate>
      <div className="onboarding-name-row"><label>Meno<input value={firstName} onChange={(event) => setFirstName(event.target.value)} autoComplete="given-name" disabled={submitting} required /></label><label>Priezvisko<input value={lastName} onChange={(event) => setLastName(event.target.value)} autoComplete="family-name" disabled={submitting} required /></label></div>
      <label>E-mail<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" inputMode="email" disabled={submitting} required /></label>
      <label>Heslo<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" minLength="8" disabled={submitting} required /><small>Minimálne 8 znakov.</small></label>
      {error && <p className="onboarding-error" role="alert">{error}</p>}
      <button type="submit" disabled={submitting}>{submitting ? 'VYTVÁRAM ÚČET…' : 'VYTVORIŤ ÚČET'}</button>
    </form>
    <p className="onboarding-switch">Už máš účet? <a href="/prihlasenie">Prihlás sa.</a></p>
  </OnboardingShell>
}
