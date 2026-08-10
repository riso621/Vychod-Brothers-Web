import { useProfile } from '../context/profile-context'

export default function AuthCallbackPage() {
  const { session, authLoading, profileLoading, profileError } = useProfile()
  const search = new URLSearchParams(window.location.search)
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  const callbackError = search.get('error_description') || hash.get('error_description')
  const nextPath = search.get('next')
  const safeNextPath = nextPath?.startsWith('/') && !nextPath.startsWith('//') ? nextPath : ''
  const loginHref = `/?auth=login${safeNextPath ? `&next=${encodeURIComponent(safeNextPath)}` : ''}`

  if (authLoading || (session && profileLoading)) {
    return <section className="auth-page-state" aria-live="polite">Dokončujem overenie e-mailu…</section>
  }

  const failed = Boolean(callbackError || profileError)
  return (
    <section className="auth-page" aria-labelledby="auth-callback-heading">
      <div className="auth-page-card">
        <span className="auth-eyebrow">VÝCHOD BROTHERS · ÚČET</span>
        <h1 id="auth-callback-heading">{failed ? 'Overenie sa nepodarilo' : 'E-mail je potvrdený'}</h1>
        <p className={failed ? 'auth-page-error' : ''} role={failed ? 'alert' : undefined}>
          {failed
            ? 'Odkaz je neplatný alebo expiroval. Skús sa prihlásiť alebo si vytvor nový účet.'
            : session ? 'Tvoj účet je aktívny a môžeš pokračovať do svojho profilu.' : 'Tvoj e-mail bol potvrdený. Teraz sa môžeš prihlásiť.'}
        </p>
        <a className="auth-page-link" href={session ? safeNextPath || '/account' : loginHref}>{session ? safeNextPath ? 'Pokračovať' : 'Prejsť do účtu' : 'Prihlásiť sa'}</a>
      </div>
    </section>
  )
}
