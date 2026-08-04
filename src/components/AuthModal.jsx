import { useEffect, useRef, useState } from 'react'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { useProfile } from '../context/profile-context'

function AuthModal({ mode, onModeChange, onClose }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState({ type: '', message: '' })
  const [submitting, setSubmitting] = useState(false)
  const emailRef = useRef(null)

  useEffect(() => {
    emailRef.current?.focus()
    const handleKeyDown = (event) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const switchMode = (nextMode) => {
    setStatus({ type: '', message: '' })
    setPassword('')
    onModeChange(nextMode)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!supabase) {
      setStatus({ type: 'error', message: 'Prihlásenie momentálne nie je dostupné.' })
      return
    }

    setSubmitting(true)
    setStatus({ type: '', message: '' })

    const result = mode === 'register'
      ? await supabase.auth.signUp({ email: email.trim(), password })
      : await supabase.auth.signInWithPassword({ email: email.trim(), password })

    setSubmitting(false)

    if (result.error) {
      setStatus({ type: 'error', message: result.error.message })
      return
    }

    if (mode === 'register' && !result.data.session) {
      setStatus({ type: 'success', message: 'Registrácia bola úspešná. Skontroluj e-mail a potvrď svoj účet.' })
      setPassword('')
      return
    }

    setStatus({ type: 'success', message: mode === 'register' ? 'Účet bol vytvorený a si prihlásený.' : 'Prihlásenie bolo úspešné.' })
    window.setTimeout(onClose, 650)
  }

  return (
    <div className="auth-modal" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="auth-dialog" role="dialog" aria-modal="true" aria-labelledby="auth-heading">
        <button className="auth-close" type="button" onClick={onClose} aria-label="Zavrieť prihlasovacie okno">×</button>
        <span className="auth-eyebrow">VÝCHOD BROTHERS</span>
        <h2 id="auth-heading">{mode === 'register' ? 'Vytvor si účet' : 'Vitaj späť'}</h2>
        <p>{mode === 'register' ? 'Zaregistruj sa e-mailom a heslom.' : 'Prihlás sa do svojho účtu.'}</p>

        <div className="auth-tabs" aria-label="Typ formulára">
          <button type="button" className={mode === 'login' ? 'is-active' : ''} aria-pressed={mode === 'login'} onClick={() => switchMode('login')}>Prihlásenie</button>
          <button type="button" className={mode === 'register' ? 'is-active' : ''} aria-pressed={mode === 'register'} onClick={() => switchMode('register')}>Registrácia</button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label htmlFor="auth-email">E-mail</label>
          <input ref={emailRef} id="auth-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required />
          <label htmlFor="auth-password">Heslo</label>
          <input id="auth-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === 'register' ? 'new-password' : 'current-password'} minLength="6" required />
          <button className="auth-submit" type="submit" disabled={submitting}>{submitting ? 'Pracujem…' : mode === 'register' ? 'Vytvoriť účet' : 'Prihlásiť sa'}</button>
        </form>
        <p className={`auth-status${status.type ? ` is-${status.type}` : ''}`} aria-live="polite">{status.message}</p>
      </section>
    </div>
  )
}

export default function AuthControl() {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState('login')
  const { session, profile, authLoading, profileLoading, profileError, signOut } = useProfile()

  if (authLoading) return <span className="auth-trigger is-loading">Načítavam…</span>

  if (session) {
    return (
      <div className="auth-account">
        <span className={`auth-profile-message${profileError ? ' is-error' : ''}`} role={profileError ? 'alert' : 'status'}>{profileLoading ? 'Načítavam profil…' : profileError || profile?.username || 'Môj účet'}</span>
        <button className="auth-trigger is-signed-in" type="button" onClick={signOut} title={session.user.email}>Odhlásiť</button>
      </div>
    )
  }

  return (
    <>
      <button className="auth-trigger" type="button" onClick={() => setOpen(true)} disabled={!isSupabaseConfigured}>Prihlásiť</button>
      {open && <AuthModal mode={mode} onModeChange={setMode} onClose={() => setOpen(false)} />}
    </>
  )
}
