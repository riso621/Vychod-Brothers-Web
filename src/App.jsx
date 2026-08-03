import { useEffect, useState } from 'react'
import { media, navItems, plans, stats } from './data'
import './App.css'

const Arrow = () => <span className="arrow" aria-hidden="true">→</span>

function Logo() {
  return <a className="brand" href="#domov" aria-label="Východ Brothers – domov"><i>V</i>B</a>
}

function Header() {
  const [open, setOpen] = useState(false)
  return (
    <header className="topbar">
      <Logo />
      <nav className={open ? 'main-nav is-open' : 'main-nav'} aria-label="Hlavná navigácia">
        {navItems.map((item, index) => <a className={index === 0 ? 'active' : ''} href={`#${['domov','videa','onas','clenstvo','merch','kontakt'][index]}`} key={item} onClick={() => setOpen(false)}>{item}</a>)}
      </nav>
      <a className="join-brush" href="#clenstvo">STAŤ SA ČLENOM</a>
      <button className="hamburger" aria-label="Otvoriť menu" aria-expanded={open} onClick={() => setOpen(!open)}><span /><span /><span /></button>
    </header>
  )
}

function SideRail() {
  return <aside className="side-rail" aria-label="Sociálne siete"><div className="socials"><a href="#facebook">f</a><a href="#instagram">◎</a><a href="#tiktok">♪</a><a href="#youtube">▶</a></div><span className="vertical">VÝCHOD BROTHERS</span><span className="plus">+</span><a className="scroll" href="#videa">↓ <small>SCROLL</small></a></aside>
}

function FilmStrip() {
  return <div className="film-strip reveal" aria-label="Ukážky z videí"><div className="perforations top" />{media.film.map((image, index) => <div className="frame" key={image}><img src={image} alt={`Momentka z natáčania ${index + 1}`} /></div>)}<div className="perforations bottom" /></div>
}

function Hero() {
  return (
    <section className="hero" id="domov">
      <Header />
      <div className="hero-photo" style={{ backgroundImage: `url(${media.hero})` }} />
      <div className="hero-copy reveal"><h1>VÝCHOD<br />BROTHERS</h1><p>PARÓDIE. MINIFILMY. ZÁBAVA.<br />TO JE NÁŠ SVET.</p><a className="outline-btn" href="#videa"><b>▶</b> POZRIEŤ NAJNOVŠIE VIDEO</a></div>
      <div className="neon-mark" aria-hidden="true">VB</div>
      <FilmStrip />
      <p className="mentality">NIE JE LEN MIESTO,<br />JE TO MENTALITA.<i /></p>
    </section>
  )
}

function Stats() {
  return <section className="stats-panel reveal"><div className="stats-intro">SÚČASŤ<br />NÁŠHO SVETA <Arrow /></div>{stats.map((item) => <div className="stat" key={item.value}><strong>{item.value}</strong><span>{item.lines[0]}<br />{item.lines[1]}</span><i /></div>)}</section>
}

function FeatureCard({ type, image, title, accent, children }) {
  return <a className={`feature-card ${type} reveal`} href={`#${type}`}><span className="card-image" style={{ backgroundImage: `url(${image})` }} /><span className="card-shade" /><h2>{title}<br /><em>{accent}</em></h2><p>{children}</p><Arrow /></a>
}

function ContentGrid() {
  return <section className="content-grid" id="videa"><FeatureCard type="latest" image={media.latest} title="NAJNOVŠIE" accent="VIDEO">POZRIEŤ TERAZ</FeatureCard><FeatureCard type="backstage" image={media.backstage} title="ZÁKULISIE" accent="">POZRI SA, ČO SA DEJE<br />ZA KAMEROU</FeatureCard><FeatureCard type="vip" image={media.vip} title="VIP" accent="KLUB">EXKLUZÍVNY OBSAH<br />PRE ČLENOV</FeatureCard><FeatureCard type="merch" image={media.merch} title="MERCH" accent="">OFICIÁLNY MERCH<br />VÝCHOD BROTHERS</FeatureCard><FeatureCard type="giveaway" image={media.giveaway} title="SÚŤAŽE" accent="& GIVEAWAYE">SÚŤAŽE LEN PRE<br />NAŠICH ČLENOV</FeatureCard></section>
}

function Membership() {
  return <section className="membership reveal" id="clenstvo"><div className="membership-poster"><span>STAŇ SA</span><strong>LEGENDOU</strong><p>EXKLUZÍVNY OBSAH, VIDEÁ SKÔR,<br />BEHIND THE SCENES A VEĽA VIAC!</p></div>{plans.map((plan) => <article className={`plan ${plan.popular ? 'popular' : ''}`} key={plan.name}>{plan.popular && <span className="badge">NAJOBĽÚBENEJŠIE</span>}<h3>{plan.name}</h3><div className="price">{plan.price} <small>/ MESIAC</small></div><ul>{plan.perks.map((perk) => <li key={perk}>✓ &nbsp; {perk}</li>)}</ul><button>{plan.button}</button></article>)}<div className="member-benefits"><p>ⓧ <span>ZRUŠÍŠ KEDYKOĽVEK</span></p><p>▣ <span>BEZPEČNÁ PLATBA</span></p><p>▤ <span>FAKTÚRA AUTOMATICKY</span></p><p>♡ <span>PODPORA TVORBY<br />VÝCHOD BROTHERS</span></p></div></section>
}

function Newsletter() {
  return <section className="newsletter reveal"><div><h2>NEZMEŠKAJ NOVÉ VIDEO! <Arrow /></h2><p>Prihlás sa na odber noviniek a buď vždy prvý,<br />kto sa dozvie o novom videu alebo špeciálnom obsahu.</p></div><form onSubmit={(e) => e.preventDefault()}><input type="email" aria-label="Tvoj e-mail" placeholder="Tvoj e-mail" required /><button>ODOBERAŤ</button><Arrow /></form></section>
}

function Footer() {
  return <footer id="kontakt"><Logo /><p>Humor z východu pre celé Slovensko.</p><nav><a href="#privacy">Ochrana súkromia</a><a href="#cookies">Cookies</a><a href="mailto:ahoj@vychodbrothers.sk">ahoj@vychodbrothers.sk</a></nav><span>© 2026 VÝCHOD BROTHERS</span></footer>
}

export default function App() {
  useEffect(() => { const observer = new IntersectionObserver((entries) => entries.forEach((entry) => entry.isIntersecting && entry.target.classList.add('visible')), { threshold: .08 }); document.querySelectorAll('.reveal').forEach((el) => observer.observe(el)); return () => observer.disconnect() }, [])
  return <><SideRail /><main className="site-shell"><Hero /><Stats /><ContentGrid /><Membership /><Newsletter /><Footer /></main></>
}
