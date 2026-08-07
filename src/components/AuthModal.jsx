import { useEffect, useRef, useState } from 'react'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { useProfile } from '../context/profile-context'

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function authErrorMessage(error, mode) {
  const code = error?.code || ''
  if (code === 'invalid_credentials') return 'E-mail alebo heslo nie sú správne.'
  if (code === 'email_not_confirmed') return 'Najprv potvrď svoj e-mail cez odkaz, ktorý sme ti poslali.'
  if (['user_already_exists', 'email_exists', 'user_already_registered'].includes(code)) return 'Účet s týmto e-mailom už existuje.'
  if (code === 'weak_password') return 'Heslo je príliš slabé. Použi aspoň 8 znakov.'
  if (code === 'over_email_send_rate_limit') return 'Odoslali sme už viac e-mailov. Skús to znova o chvíľu.'
  if (code === 'signup_disabled') return 'Registrácia je momentálne vypnutá.'
  if (code === 'validation_failed') return 'Skontroluj zadané údaje.'
  return mode === 'register'
    ? 'Registráciu sa nepodarilo dokončiť. Skús to znova.'
    : mode === 'forgot'
      ? 'E-mail na obnovu hesla sa nepodarilo odoslať.'
      : 'Prihlásenie sa nepodarilo. Skús to znova.'
}

function validateCredentials({ email, password, confirmPassword, mode }) {
  const normalizedEmail = email.trim()
  if (!normalizedEmail) return 'Zadaj svoj e-mail.'
  if (!emailPattern.test(normalizedEmail)) return 'Zadaj platnú e-mailovú adresu.'
  if (mode === 'forgot') return ''
  if (!password) return 'Zadaj heslo.'
  if (password.length < 8) return 'Heslo musí mať aspoň 8 znakov.'
  if (mode === 'register' && !confirmPassword) return 'Potvrď svoje heslo.'
  if (mode === 'register' && password !== confirmPassword) return 'Heslá sa nezhodujú.'
  return ''
}

function AuthModal({ mode, onModeChange, onClose }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [status, setStatus] = useState({ type: '', message: '' })
  const [submitting, setSubmitting] = useState(false)
  const emailRef = useRef(null)

  useEffect(() => {
    emailRef.current?.focus()
    const handleKeyDown = (event) => { if (event.key === 'Escape' && !submitting) onClose() }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose, submitting])

  const switchMode = (nextMode) => {
    if (submitting) return
    setStatus({ type: '', message: '' })
    setPassword('')
    setConfirmPassword('')
    onModeChange(nextMode)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (submitting) return
    if (!supabase) {
      setStatus({ type: 'error', message: 'Prihlásenie momentálne nie je dostupné.' })
      return
    }

    const validationError = validateCredentials({ email, password, confirmPassword, mode })
    if (validationError) {
      setStatus({ type: 'error', message: validationError })
      return
    }

    setSubmitting(true)
    setStatus({ type: '', message: '' })

    try {
      if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/reset-hesla?recovery=1`,
        })
        if (error) throw error
        setStatus({ type: 'success', message: 'Ak účet existuje, poslali sme na tento e-mail odkaz na obnovu hesla.' })
        return
      }

      const result = mode === 'register'
        ? await supabase.auth.signUp({
            email: email.trim(),
            password,
            options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
          })
        : await supabase.auth.signInWithPassword({ email: email.trim(), password })

      if (result.error) throw result.error

      if (mode === 'register' && !result.data.session) {
        setStatus({ type: 'success', message: 'Registrácia bola úspešná. Skontroluj e-mail a potvrď svoj účet.' })
        setPassword('')
        setConfirmPassword('')
        return
      }

      setStatus({ type: 'success', message: mode === 'register' ? 'Účet bol vytvorený a si prihlásený.' : 'Prihlásenie bolo úspešné.' })
      const nextPath = new URLSearchParams(window.location.search).get('next')
      window.setTimeout(() => {
        if (nextPath?.startsWith('/') && !nextPath.startsWith('//')) window.location.assign(nextPath)
        else onClose()
      }, 500)
    } catch (error) {
      setStatus({ type: 'error', message: authErrorMessage(error, mode) })
    } finally {
      setSubmitting(false)
    }
  }

  const heading = mode === 'register' ? 'Vytvor si účet' : mode === 'forgot' ? 'Obnov heslo' : 'Vitaj späť'
  const intro = mode === 'register'
    ? 'Zaregistruj sa e-mailom a bezpečným heslom.'
    : mode === 'forgot'
      ? 'Pošleme ti bezpečný odkaz na nastavenie nového hesla.'
      : 'Prihlás sa do svojho účtu.'

  return (
    <div className="auth-modal" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !submitting) onClose() }}>
      <section className="auth-dialog" role="dialog" aria-modal="true" aria-labelledby="auth-heading">
        <button className="auth-close" type="button" onClick={onClose} disabled={submitting} aria-label="Zavrieť prihlasovacie okno">×</button>
        <span className="auth-eyebrow">VÝCHOD BROTHERS</span>
        <h2 id="auth-heading">{heading}</h2>
        <p>{intro}</p>

        {mode !== 'forgot' && <div className="auth-tabs" aria-label="Typ formulára">
          <button type="button" className={mode === 'login' ? 'is-active' : ''} aria-pressed={mode === 'login'} disabled={submitting} onClick={() => switchMode('login')}>Prihlásenie</button>
          <button type="button" className={mode === 'register' ? 'is-active' : ''} aria-pressed={mode === 'register'} disabled={submitting} onClick={() => switchMode('register')}>Registrácia</button>
        </div>}

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <label htmlFor="auth-email">E-mail</label>
          <input ref={emailRef} id="auth-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" inputMode="email" disabled={submitting} required />
          {mode !== 'forgot' && <>
            <label htmlFor="auth-password">Heslo</label>
            <input id="auth-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === 'register' ? 'new-password' : 'current-password'} minLength="8" disabled={submitting} required />
          </>}
          {mode === 'register' && <>
            <label htmlFor="auth-password-confirm">Potvrdenie hesla</label>
            <input id="auth-password-confirm" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" minLength="8" disabled={submitting} required />
          </>}
          {mode === 'login' && <button className="auth-forgot" type="button" disabled={submitting} onClick={() => switchMode('forgot')}>Zabudol som heslo</button>}
          <button className="auth-submit" type="submit" disabled={submitting}>{submitting ? 'Pracujem…' : mode === 'register' ? 'Vytvoriť účet' : mode === 'forgot' ? 'Poslať odkaz' : 'Prihlásiť sa'}</button>
          {mode === 'forgot' && <button className="auth-back" type="button" disabled={submitting} onClick={() => switchMode('login')}>← Späť na prihlásenie</button>}
        </form>
        <p className={`auth-status${status.type ? ` is-${status.type}` : ''}`} role={status.type === 'error' ? 'alert' : undefined} aria-live="polite">{status.message}</p>
      </section>
    </div>
  )
}

export default function AuthControl() {
  const params = new URLSearchParams(window.location.search)
  const initialMode = params.get('auth') === 'register' ? 'register' : 'login'
  const [open, setOpen] = useState(() => ['login', 'register'].includes(params.get('auth')))
  const [mode, setMode] = useState(initialMode)
  const [logoutError, setLogoutError] = useState('')
  const { session, profile, authLoading, profileLoading, profileError, signOut } = useProfile()

  const handleSignOut = async () => {
    setLogoutError('')
    const { error } = await signOut()
    if (error) setLogoutError('Odhlásenie sa nepodarilo dokončiť. Obnov stránku a skús to znova.')
  }

  if (authLoading) return <span className="auth-trigger is-loading" aria-live="polite">Načítavam…</span>

  if (session) {
    return (
      <div className="auth-account">
        {logoutError
          ? <span className="auth-profile-message is-error" role="alert">{logoutError}</span>
          : profileError
            ? <span className="auth-profile-message is-error" role="alert">{profileError}</span>
            : <a className="auth-profile-message" href="/account" aria-label="Otvoriť môj účet">{profileLoading ? 'Načítavam profil…' : profile?.username || 'Môj účet'}</a>}
        <button className="auth-trigger is-signed-in" type="button" onClick={handleSignOut} title={session.user.email}>Odhlásiť</button>
      </div>
    )
  }

  return (
    <>
      <button className="auth-trigger" type="button" onClick={() => { setMode('login'); setOpen(true) }} disabled={!isSupabaseConfigured}>Prihlásiť</button>
      {open && <AuthModal mode={mode} onModeChange={setMode} onClose={() => setOpen(false)} />}
    </>
  )
}
