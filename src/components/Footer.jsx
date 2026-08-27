import { activeSocialProfiles, contactEmail, footerNavigation, footerSlogan, legalLinks } from '../data'

function FooterIcon({ name }) {
  const paths = {
    page: <><path d="M6 3h9l3 3v15H6z"/><path d="M15 3v4h4M9 11h6M9 15h6"/></>,
    users: <><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20c0-4 2.5-6 6-6s6 2 6 6M14 15c4.5-.8 7 1.2 7 5"/></>,
    mail: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/></>,
    youtube: <><rect x="3" y="6" width="18" height="12" rx="4"/><path d="m10 9 5 3-5 3z"/></>,
    tiktok: <path d="M14 4v10.5a4 4 0 1 1-3-3.87V7h3c1.2 2.3 2.8 3.5 5 3.7V7.8c-2.4-.4-3.8-1.7-5-3.8Z"/>,
    instagram: <><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></>,
    facebook: <path d="M14 21v-8h3l.5-3H14V8.3c0-.9.3-1.6 1.7-1.6H18V4.1c-.5-.1-1.6-.1-2.7-.1C12.6 4 11 5.6 11 8.5V10H8v3h3v8Z"/>,
    arrow: <path d="M5 12h14M14 7l5 5-5 5"/>,
    external: <path d="M14 5h5v5M19 5l-8 8M18 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>,
  }
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}

function CompactFooter() {
  const membershipNavigation = footerNavigation.filter((item) => item.label !== 'O nás')
  return <footer className="site-footer membership-footer" id="kontakt">
    <div className="membership-footer__cards">
      <nav className="membership-footer__card" aria-label="Navigácia v pätičke"><h2><FooterIcon name="page"/>Stránka</h2>{membershipNavigation.map((item) => <a href={item.href} key={item.label}><span>{item.label}</span><FooterIcon name="arrow"/></a>)}</nav>
      <nav className="membership-footer__card" aria-label="Sociálne siete"><h2><FooterIcon name="users"/>Sleduj nás</h2>{activeSocialProfiles.map((profile) => <a href={profile.url} target="_blank" rel="noopener noreferrer" aria-label={`${profile.label} – otvorí sa v novom okne`} key={profile.id}><span><FooterIcon name={profile.id}/>{profile.name}</span><FooterIcon name="external"/></a>)}</nav>
    </div>
    <a className="membership-footer__contact" href={`mailto:${contactEmail}`}><span className="membership-footer__contact-icon"><FooterIcon name="mail"/></span><span><b>Kontakt</b><strong>{contactEmail}</strong></span><FooterIcon name="arrow"/></a>
    <div className="membership-footer__base"><div className="membership-footer__brand"><a href="/" aria-label="Východ Brothers – domov">VB</a><div><strong>Východ Brothers</strong><p>{footerSlogan}</p></div></div><div className="membership-footer__legal"><span>© {new Date().getFullYear()} Východ Brothers</span><nav aria-label="Právne informácie">{legalLinks.map((item) => <a href={item.href} key={item.href}>{item.label}</a>)}</nav></div></div>
  </footer>
}

export default function Footer({ variant = 'default' }) {
  if (variant === 'membership') return <CompactFooter />
  const homeHref = window.location.pathname === '/' ? '#domov' : '/'

  return (
    <footer className="site-footer" id="kontakt">
      <div className="site-footer__top">
        <div className="site-footer__brand">
          <a className="site-footer__logo" href={homeHref} aria-label="Východ Brothers – domov"><i>V</i>B</a>
          <p>{footerSlogan}</p>
        </div>

        <nav className="site-footer__column" aria-label="Navigácia v pätičke">
          <h2>Stránka</h2>
          {footerNavigation.map((item) => <a href={item.href} key={item.label}>{item.label}</a>)}
        </nav>

        <nav className="site-footer__column" aria-label="Sociálne siete">
          <h2>Sleduj nás</h2>
          {activeSocialProfiles.map((profile) => (
            <a href={profile.url} target="_blank" rel="noopener noreferrer" aria-label={`${profile.label} – otvorí sa v novom okne`} key={profile.id}>
              {profile.name}<span aria-hidden="true">↗</span>
            </a>
          ))}
        </nav>

        <div className="site-footer__column site-footer__contact">
          <h2>Kontakt</h2>
          <p>Spolupráce, médiá<br />a všetko ostatné.</p>
          <a href={`mailto:${contactEmail}`}>{contactEmail}</a>
        </div>
      </div>

      <div className="site-footer__bottom">
        <span>© {new Date().getFullYear()} Východ Brothers</span>
        <nav aria-label="Právne informácie">
          {legalLinks.map((item) => <a href={item.href} key={item.href}>{item.label}</a>)}
        </nav>
      </div>
    </footer>
  )
}
