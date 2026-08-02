import { useEffect, useRef, useState } from 'react'
import { brothers, stats, videos } from './data'
import './App.css'

const Arrow = () => <span aria-hidden="true">↗</span>

function Logo() {
  return <a className="logo" href="#top" aria-label="Východ Brothers – domov"><span>V</span>B<small>VÝCHOD<br />BROTHERS</small></a>
}

function Header() {
  const [open, setOpen] = useState(false)
  return (
    <header className="header">
      <Logo />
      <nav className={open ? 'nav open' : 'nav'} aria-label="Hlavná navigácia">
        <a href="#pribeh" onClick={() => setOpen(false)}>O nás</a>
        <a href="#videa" onClick={() => setOpen(false)}>Videá</a>
        <a href="#clenstvo" onClick={() => setOpen(false)}>Členstvo</a>
        <a href="#spolupraca" onClick={() => setOpen(false)}>Spolupráca</a>
      </nav>
      <a className="header-link" href="#kontakt">Napíš nám <Arrow /></a>
      <button className="menu" onClick={() => setOpen(!open)} aria-label="Otvoriť menu" aria-expanded={open}><i /><i /></button>
    </header>
  )
}

function Intro({ onEnter }) {
  return (
    <div className="intro" role="dialog" aria-label="Vstup na web">
      <div className="intro-grain" />
      <p>TRI HLAVY / JEDEN VÝCHOD</p>
      <button onClick={onEnter} aria-label="Vstúpiť na web">
        <span>VB</span>
        <i>VSTÚPIŤ</i>
      </button>
      <small>Zvuk zapínať nemusíš.<br />Nás bude počuť aj tak.</small>
    </div>
  )
}

function Hero() {
  const ref = useRef(null)
  useEffect(() => {
    const move = (e) => {
      if (!ref.current || window.innerWidth < 800) return
      const x = (e.clientX / window.innerWidth - .5) * 18
      const y = (e.clientY / window.innerHeight - .5) * 12
      ref.current.style.setProperty('--mx', `${x}px`)
      ref.current.style.setProperty('--my', `${y}px`)
    }
    window.addEventListener('pointermove', move)
    return () => window.removeEventListener('pointermove', move)
  }, [])
  return (
    <section className="hero" id="top" ref={ref}>
      <div className="hero-image" />
      <div className="hero-vignette" />
      <div className="hero-copy">
        <p className="eyebrow">Humor / Paródie / Minifilmy / Život</p>
        <h1><span>VÝCHOD</span><span>NEHRÁME.</span><em>MY HO ŽIJEME.</em></h1>
      </div>
      <p className="hero-note">Traja bratia.<br />Príbehy bez filtra.</p>
      <a className="round-link" href="#videa" aria-label="Pozrieť najnovšie video"><span>PLAY</span><Arrow /></a>
      <div className="hero-index">01 — 08</div>
    </section>
  )
}

function Manifesto() {
  return (
    <section className="manifesto reveal" id="pribeh">
      <p className="section-tag">[ O NÁS ]</p>
      <div className="manifesto-text">
        <p>Nerobíme obsah pre algoritmus.</p>
        <h2>ROBÍME <span>SCÉNY,</span><br />KTORÉ SI BUDEŠ<br />PAMÄTAŤ.</h2>
      </div>
      <p className="manifesto-side">Z východu do celého Slovenska. Humor, ktorý poznáš. Filmový svet, ktorý nečakáš.</p>
      <div className="marquee"><div>NAŠE PRAVIDLÁ · ŽIADNE PRAVIDLÁ · NAŠE PRAVIDLÁ · ŽIADNE PRAVIDLÁ · </div></div>
    </section>
  )
}

function Brothers() {
  return (
    <section className="brothers-section">
      <div className="section-head reveal"><p className="section-tag">[ TROJICA ]</p><h2>TRI POHĽADY.<br /><i>JEDEN OBRAZ.</i></h2></div>
      <div className="brothers">
        {brothers.map((person, index) => (
          <article className="brother reveal" key={person.name} style={{ '--delay': `${index * 90}ms` }}>
            <img src={person.image} alt={`Portrét – ${person.name}`} loading="lazy" />
            <div className="brother-shade" />
            <span className="number">{person.number}</span>
            <div className="brother-info"><p>{person.role}</p><h3>{person.name}</h3><span>{person.bio}</span></div>
          </article>
        ))}
      </div>
    </section>
  )
}

function Videos() {
  const featured = videos[0]
  return (
    <section className="videos-section" id="videa">
      <div className="section-head light reveal"><p className="section-tag">[ TERAZ HRÁ ]</p><h2>NAJNOVŠÍ<br /><i>ÚLET.</i></h2></div>
      <a className="featured-video reveal" href="#youtube" aria-label={`Prehrať ${featured.title}`}>
        <img src={featured.image} alt="Filmové plátno v kine" loading="lazy" />
        <div className="video-overlay" />
        <button className="play" tabIndex="-1">▶</button>
        <div className="featured-title"><p>{featured.category} · {featured.views} pozretí</p><h3>{featured.title}</h3></div>
        <span className="duration">{featured.duration}</span>
      </a>
      <div className="video-list">
        {videos.slice(1).map((video, index) => (
          <a className="video-card reveal" href="#youtube" key={video.title} style={{ '--delay': `${index * 80}ms` }}>
            <div><img src={video.image} alt="" loading="lazy" /><span>{video.duration}</span></div>
            <p>{video.category} · {video.views}</p><h3>{video.title}</h3>
          </a>
        ))}
      </div>
    </section>
  )
}

function Stats() {
  return (
    <section className="stats-section">
      <p className="section-tag reveal">[ NAŠA CREW ]</p>
      <div className="stats">
        {stats.map((stat) => <div className="stat reveal" key={stat.label}><strong>{stat.value}</strong><span>{stat.label}</span></div>)}
      </div>
      <div className="social-row reveal"><span>Sleduj ten chaos</span><a href="#instagram">Instagram <Arrow /></a><a href="#tiktok">TikTok <Arrow /></a><a href="#youtube">YouTube <Arrow /></a></div>
    </section>
  )
}

function Membership() {
  return (
    <section className="membership" id="clenstvo">
      <div className="membership-bg" />
      <div className="membership-top reveal"><p className="section-tag">[ ČOSKORO ]</p><span>LEN PRE TÝCH,<br />ČO CHCÚ VIAC</span></div>
      <div className="membership-copy reveal"><p>Za dverami sa už svieti.</p><h2>VNÚTRI<br />SA DEJE <i>VIAC.</i></h2></div>
      <div className="member-preview reveal">
        <span>01</span><p>Filmy skôr než ostatní</p>
        <span>02</span><p>Zákulisie bez cenzúry</p>
        <span>03</span><p>Bonusové skeče a bloopers</p>
      </div>
      <form className="notify" onSubmit={(e) => e.preventDefault()}><label htmlFor="member-email">Daj mi vedieť, keď otvoríte</label><div><input id="member-email" type="email" placeholder="tvoj@email.sk" required /><button>Som pri tom <Arrow /></button></div></form>
    </section>
  )
}

function Collaboration() {
  return (
    <section className="collab" id="spolupraca">
      <div className="collab-copy reveal"><p className="section-tag">[ PRE ZNAČKY ]</p><h2>REKLAMA,<br />KTORÚ ĽUDIA<br /><i>NEPRESKOČIA.</i></h2></div>
      <div className="collab-info reveal"><p>Nevlepíme vaše logo do videa. Vymyslíme príbeh, v ktorom bude značka hrať hlavnú rolu a publikum ho bude chcieť dopozerať.</p><a href="mailto:spolupraca@vychodbrothers.sk">Poďme niečo vymyslieť <Arrow /></a></div>
      <div className="collab-rings"><span>VB</span></div>
    </section>
  )
}

function MerchNewsletter() {
  return (
    <section className="merch-news">
      <div className="merch reveal"><p className="section-tag">[ DROP 00 ]</p><h2>MERCH<br /><i>PRIPRAVUJEME.</i></h2><span>Nebude to len tričko s logom.</span></div>
      <div className="newsletter reveal"><p className="section-tag">[ LIST Z VÝCHODU ]</p><h3>Raz za čas niečo dobré.<br />Žiadny spam, čestné.</h3><form onSubmit={(e) => e.preventDefault()}><input aria-label="E-mail pre newsletter" type="email" placeholder="ZADAJ SVOJ E-MAIL" required /><button aria-label="Odoberať newsletter"><Arrow /></button></form></div>
    </section>
  )
}

function Footer() {
  return (
    <footer id="kontakt">
      <div className="footer-top"><p>MÁŠ NÁPAD?</p><a href="mailto:ahoj@vychodbrothers.sk">POVEDZ NÁM HO. <Arrow /></a></div>
      <div className="footer-brand">VÝCHOD<br /><i>BROTHERS</i></div>
      <div className="footer-bottom"><span>© 2026 Východ Brothers</span><div><a href="#privacy">Ochrana súkromia</a><a href="#cookies">Cookies</a><a href="#terms">Podmienky</a></div><a href="#top">Hore ↑</a></div>
    </footer>
  )
}

export default function App() {
  const [entered, setEntered] = useState(() => sessionStorage.getItem('vb-entered') === 'true')
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => entries.forEach((entry) => entry.isIntersecting && entry.target.classList.add('visible')), { threshold: .12 })
    document.querySelectorAll('.reveal').forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [entered])
  const enter = () => { sessionStorage.setItem('vb-entered', 'true'); setEntered(true) }
  return <>{!entered && <Intro onEnter={enter} />}<Header /><main><Hero /><Manifesto /><Brothers /><Videos /><Stats /><Membership /><Collaboration /><MerchNewsletter /></main><Footer /></>
}
