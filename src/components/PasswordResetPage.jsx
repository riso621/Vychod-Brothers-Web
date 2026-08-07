import { useState } from 'react'
import { useProfile } from '../context/profile-context'
import { supabase } from '../lib/supabase'

export default function PasswordResetPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [status, setStatus] = useState({ type: '', message: '' })
  const { session, authLoading, signOut } = useProfile()
  const recoveryRequested = new URLSearchParams(window.location.search).get('recovery') === '1'

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (submitting) return
    if (!session || !supabase || !recoveryRequested) {
      setStatus({ type: 'error', message: 'Odkaz na obnovu hesla nie je platný alebo už expiroval.' })
      return
    }
    if (!password) {
      setStatus({ type: 'error', message: 'Zadaj nové heslo.' })
      return
    }
    if (password.length < 8) {
      setStatus({ type: 'error', message: 'Heslo musí mať aspoň 8 znakov.' })
      return
    }
    if (password !== confirmPassword) {
      setStatus({ type: 'error', message: 'Heslá sa nezhodujú.' })
      return
    }

    setSubmitting(true)
    setStatus({ type: '', message: '' })
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setStatus({ type: 'error', message: error.code === 'same_password' ? 'Nové heslo musí byť odlišné od pôvodného.' : 'Heslo sa nepodarilo zmeniť. Vyžiadaj si nový odkaz.' })
      setSubmitting(false)
      return
    }
    await signOut()
    setPassword('')
    setConfirmPassword('')
    setStatus({ type: 'success', message: 'Heslo bolo úspešne zmenené. Teraz sa môžeš prihlásiť.' })
    setSubmitting(false)
  }

  if (authLoading) return <section className="auth-page-state" aria-live="polite">Overujem odkaz na obnovu hesla…</section>

  const invalidRecovery = !session || !recoveryRequested
  return (
    <section className="auth-page" aria-labelledby="reset-password-heading">
      <div className="auth-page-card">
        <span className="auth-eyebrow">VÝCHOD BROTHERS · ÚČET</span>
        <h1 id="reset-password-heading">Nové heslo</h1>
        {invalidRecovery ? <>
          <p className="auth-page-error" role="alert">Odkaz na obnovu hesla nie je platný alebo už expiroval.</p>
          <a className="auth-page-link" href="/?auth=login">Späť na prihlásenie</a>
        </> : <>
          <p>Zadaj nové heslo s minimálne ôsmimi znakmi.</p>
          <form className="auth-form" onSubmit={handleSubmit} noValidate>
            <label htmlFor="reset-password">Nové heslo</label>
            <input id="reset-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" minLength="8" disabled={submitting} autoFocus />
            <label htmlFor="reset-password-confirm">Potvrdenie hesla</label>
            <input id="reset-password-confirm" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" minLength="8" disabled={submitting} />
            <button className="auth-submit" type="submit" disabled={submitting}>{submitting ? 'Ukladám…' : 'Nastaviť nové heslo'}</button>
          </form>
          <p className={`auth-status${status.type ? ` is-${status.type}` : ''}`} role={status.type === 'error' ? 'alert' : undefined} aria-live="polite">{status.message}</p>
          {status.type === 'success' && <a className="auth-page-link" href="/?auth=login">Prihlásiť sa</a>}
        </>}
      </div>
    </section>
  )
}
