import { useState } from 'react'

const checkoutHref = '/?auth=register&next=%2Fcheckout%2Fclub'
const fallbackImages = ['/images/team/vychod-brothers-team-evening.webp', '/images/team/vychod-brothers-team-day.webp', '/images/backgrounds/vb-cinematic-energy.webp']

const benefits = [
  ['film', 'EXKLUZÍVNE MINI FILMY', 'Originálne príbehy a minifilmy Východ Brothers, ktoré inde nenájdeš.'],
  ['series', 'ORIGINÁLNE SERIÁLY', 'Epizódy a vlastné formáty vytvorené pre našu komunitu.'],
  ['devices', 'SLEDUJ KDEKOĽVEK', 'Pozeraj cez web na mobile, tablete aj počítači pod jedným účtom.'],
  ['spark', 'NOVÝ OBSAH PRAVIDELNE', 'Knižnicu priebežne dopĺňame o nové videá, bonusy a zákulisie.'],
]

const faqs = [
  ['Čo je VÝCHOD BROTHERS?', 'VÝCHOD BROTHERS je slovenská platforma s originálnymi minifilmami, seriálmi, paródiami a exkluzívnym obsahom našej tvorivej skupiny.'],
  ['Koľko stojí predplatné?', 'Členstvo stojí 5,99 € mesačne. Ide o jeden plán bez ďalších úrovní alebo skrytých doplatkov.'],
  ['Čo môžem sledovať?', 'Po aktivácii členstva získaš prístup ku všetkým publikovaným členským videám, minifilmom, seriálom, bonusom a zákulisiu. Verejné videá môže sledovať každý.'],
  ['Kde môžem sledovať obsah?', 'Obsah môžeš sledovať vo webovom prehliadači na mobile, tablete alebo počítači. Stačí sa prihlásiť do svojho účtu.'],
  ['Ako môžem zrušiť predplatné?', 'Predplatné môžeš kedykoľvek spravovať alebo zrušiť v časti Môj účet. Prístup ti zostane do konca už zaplateného obdobia.'],
  ['Ako funguje členstvo?', 'Vytvoríš si účet, dokončíš bezpečnú platbu cez Stripe a po potvrdení platby sa členský katalóg automaticky odomkne.'],
]

function Icon({ name }) {
  const paths = {
    film: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 5v14M17 5v14M3 9h4M17 9h4M3 15h4M17 15h4"/></>,
    series: <><rect x="4" y="4" width="16" height="16" rx="3"/><path d="m10 9 5 3-5 3zM7 1v3M17 1v3"/></>,
    devices: <><rect x="2" y="4" width="14" height="11" rx="2"/><path d="M7 20h4M9 15v5"/><rect x="17" y="8" width="5" height="11" rx="1"/></>,
    spark: <><path d="m12 2 1.6 5.4L19 9l-5.4 1.6L12 16l-1.6-5.4L5 9l5.4-1.6z"/><path d="m19 15 .7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.7z"/></>,
  }
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}

function imageFor(video, urls, index) {
  if (!video?.thumbnail) return fallbackImages[index % fallbackImages.length]
  return /^https?:\/\//i.test(video.thumbnail) ? video.thumbnail : urls.get(video.thumbnail) || fallbackImages[index % fallbackImages.length]
}

export default function PublicStreamingLanding({ videos, urls }) {
  const [openFaq, setOpenFaq] = useState(-1)
  const posters = videos.length ? videos.slice(0, 12) : fallbackImages.map((thumbnail, index) => ({ id: `fallback-${index}`, thumbnail, title: 'Východ Brothers' }))

  return <div className="public-stream">
    <section className="public-hero">
      <div className="poster-collage" aria-hidden="true">{[...posters, ...posters].slice(0, 15).map((video, index) => <div className="poster-tile" key={`${video.id}-${index}`}><img src={imageFor(video, urls, index)} alt="" /></div>)}</div>
      <div className="public-hero-overlay" />
      <div className="public-hero-content">
        <span>VÝCHOD BROTHERS ORIGINAL</span>
        <h1>FILMY A SERIÁLY,<br/>KTORÉ INDE NENÁJDEŠ.</h1>
        <p>Originálne mini filmy, seriály a exkluzívny obsah od Východ Brothers.</p>
        <strong>Už za 5,99 € mesačne. <small>Zrušíš kedykoľvek.</small></strong>
        <div><a href={checkoutHref}>ZAČAŤ SLEDOVAŤ <b>›</b></a><a className="public-member-link" href="/?auth=login&next=%2Fvideos">Už si člen? Prejsť do katalógu</a></div>
      </div>
    </section>

    <div className="public-curve" aria-hidden="true"><i /></div>

    <section className="public-section public-trending" aria-labelledby="trending-title">
      <span className="public-eyebrow">VÝBER Z KNIŽNICE</span><h2 id="trending-title">PRÁVE LETÍ</h2>
      {videos.length ? <div className="ranking-track">{videos.slice(0, 10).map((video, index) => <a href={`/videos/${video.slug}`} className="ranking-card" key={video.id}><b>{index + 1}</b><div><img src={imageFor(video, urls, index)} alt="" loading="lazy"/><span>{video.accessLevel === 'free' ? 'VEREJNÉ' : 'VB CLUB'}</span><strong>{video.title}</strong></div></a>)}</div> : <p className="public-empty">Publikovaný obsah sa tu zobrazí automaticky hneď po jeho pridaní do katalógu.</p>}
    </section>

    <section className="public-section public-benefits" aria-labelledby="benefits-title"><span className="public-eyebrow">JEDNO ČLENSTVO · CELÝ SVET VB</span><h2 id="benefits-title">PREČO VÝCHOD BROTHERS?</h2><div className="benefit-grid">{benefits.map(([icon, title, text]) => <article key={title}><Icon name={icon}/><h3>{title}</h3><p>{text}</p></article>)}</div></section>

    <section className="public-section public-faq" id="faq" aria-labelledby="faq-title"><span className="public-eyebrow">VŠETKO PODSTATNÉ</span><h2 id="faq-title">ČASTO KLADENÉ OTÁZKY</h2><div>{faqs.map(([question, answer], index) => <article className={openFaq === index ? 'is-open' : ''} key={question}><button type="button" aria-expanded={openFaq === index} onClick={() => setOpenFaq(openFaq === index ? -1 : index)}><span>{question}</span><b>+</b></button><div><p>{answer}</p></div></article>)}</div></section>

    <section className="public-final-cta"><span>VÝCHOD BROTHERS CLUB</span><h2>PRIPRAVENÝ SLEDOVAŤ?</h2><p>Objav originálne filmy a seriály od Východ Brothers.</p><strong>5,99 € / mesiac</strong><a href={checkoutHref}>ZAČAŤ SLEDOVAŤ <b>›</b></a></section>

    <footer className="public-footer"><a className="public-footer-logo" href="/">VB</a><nav aria-label="Pätička"><a href="mailto:ahoj@vychodbrothers.sk">Kontakt</a><a href="#faq">Často kladené otázky</a><a href="/obchodne-podmienky">Podmienky používania</a><a href="/ochrana-osobnych-udajov">Ochrana osobných údajov</a><a href="/account">Správa predplatného</a><a href="/?auth=login&next=%2Fvideos">Prihlásenie</a></nav><p>© {new Date().getFullYear()} Východ Brothers. Všetky práva vyhradené.</p></footer>
  </div>
}
