import { activeSocialProfiles, contactEmail, footerNavigation, footerSlogan, legalLinks } from '../data'

export default function Footer() {
  return (
    <footer className="site-footer" id="kontakt">
      <div className="site-footer__top">
        <div className="site-footer__brand">
          <a className="site-footer__logo" href="#domov" aria-label="Východ Brothers – domov"><i>V</i>B</a>
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
