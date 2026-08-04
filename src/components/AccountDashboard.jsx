import { useEffect } from 'react'
import { useProfile } from '../context/profile-context'

const accountCards = [
  { icon: '◆', title: 'Moje členstvo', text: 'Prehľad aktuálneho typu členstva.' },
  { icon: '▶', title: 'Moje videá', text: 'Obsah dostupný pre tvoj účet.' },
  { icon: '◉', title: 'Nastavenia účtu', text: 'Údaje a zabezpečenie účtu.' },
  { icon: '↗', title: 'História členstva', text: 'Budúci prehľad zmien členstva.' },
]

const membershipLabels = {
  free: 'Bezplatný účet',
  member: 'Člen',
  vip: 'VIP člen',
}

function formatRegistrationDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('sk-SK', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

export default function AccountDashboard() {
  const { session, profile, authLoading, profileLoading, profileError } = useProfile()

  useEffect(() => {
    if (!authLoading && !session) {
      window.location.replace('/?auth=login&next=/account')
    }
  }, [authLoading, session])

  if (authLoading || (!session && !authLoading)) {
    return <section className="account-state" aria-live="polite">Overujem prihlásenie…</section>
  }

  if (profileLoading) {
    return <section className="account-state" aria-live="polite">Načítavam tvoj profil…</section>
  }

  if (profileError || !profile) {
    return <section className="account-state account-state-error" role="alert"><h1>Profil nie je dostupný</h1><p>{profileError || 'Profil sa zatiaľ nenašiel. Skús to, prosím, neskôr.'}</p></section>
  }

  const displayName = profile.username || session.user.email?.split('@')[0] || 'Člen'
  const initials = displayName.slice(0, 2).toUpperCase()

  return (
    <section className="account-dashboard" aria-labelledby="account-heading">
      <div className="account-heading">
        <span className="account-eyebrow">VÝCHOD BROTHERS / ÚČET</span>
        <h1 id="account-heading">Môj účet</h1>
        <p>Všetko dôležité o tvojom účte na jednom mieste.</p>
      </div>

      <article className="account-profile">
        <div className="account-avatar" aria-label={`Avatar používateľa ${displayName}`}>
          {profile.avatar_url ? <img src={profile.avatar_url} alt="" /> : <span aria-hidden="true">{initials}</span>}
        </div>
        <div className="account-identity">
          <span>Profil</span>
          <h2>{displayName}</h2>
        </div>
        <dl className="account-details">
          <div><dt>Členstvo</dt><dd>{membershipLabels[profile.membership] || profile.membership}</dd></div>
          <div><dt>Registrácia</dt><dd>{formatRegistrationDate(profile.created_at)}</dd></div>
        </dl>
      </article>

      <div className="account-grid" aria-label="Možnosti účtu">
        {accountCards.map((card) => (
          <article className="account-card" key={card.title}>
            <span className="account-card-icon" aria-hidden="true">{card.icon}</span>
            <div><h2>{card.title}</h2><p>{card.text}</p></div>
            <span className="account-card-status">Pripravujeme</span>
          </article>
        ))}
      </div>
    </section>
  )
}
