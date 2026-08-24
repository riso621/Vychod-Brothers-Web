import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useProfile } from '../context/profile-context'
import { canAccessMembership, clubPlan, isActiveClubMember } from '../lib/membership'
import { getSignedStorageUrls } from '../lib/storage'
import { getPublishedVideos } from '../lib/videos'

const planMeta = {
  club: { price: '5,99 €', note: 'mesačne', cta: 'Stať sa členom' },
}

const benefits = [
  { icon: 'film', title: 'Exkluzívne videá', text: 'Minifilmy, skeče a bonusové epizódy, ktoré na verejnom YouTube nenájdeš.' },
  { icon: 'camera', title: 'Zákulisie natáčania', text: 'Buď s nami pred prvou klapkou aj po poslednom strihu.' },
  { icon: 'rocket', title: 'Skorší prístup', text: 'Nové premiéry uvidíš skôr než ktokoľvek iný.' },
  { icon: 'gift', title: 'Súťaže', text: 'Špeciálne výzvy, giveaway a odmeny pripravené pre členov.' },
  { icon: 'shirt', title: 'Výhody pri merchi', text: 'Prednostný prístup k dropom a členské výhody pri budúcom merchi.' },
  { icon: 'community', title: 'Komunita', text: 'Hlasuj o ďalšom videu a buď súčasťou rozhodnutí Východ Brothers.' },
]

const planBenefits = [
  'Všetky exkluzívne videá',
  'Zákulisie a bonusový obsah',
  'Skorší prístup',
  'Súťaže a členské výhody',
  'Všetok budúci členský obsah',
]

const faqs = [
  ['Kedy získam prístup po zaplatení?', 'Prístup sa aktivuje automaticky po úspešnom potvrdení platby. Zvyčajne to trvá len niekoľko sekúnd.'],
  ['Čo členstvo odomkne?', 'Jedno členstvo odomkne všetky aktuálne aj budúce členské videá, zákulisie, bonusový obsah a skorší prístup k vybraným premiéram.'],
  ['Môžem členstvo kedykoľvek zrušiť?', 'Áno. Predplatné zrušíš kedykoľvek v Mojom účte. Prístup zostane aktívny až do konca už zaplateného obdobia.'],
  ['Obnovuje sa členstvo automaticky?', 'Áno. Východ Brothers Club sa obnovuje každý mesiac, kým predplatné nezrušíš.'],
  ['Funguje členstvo aj na mobile?', 'Áno. Členský obsah je dostupný na mobile, tablete aj desktope cez rovnaký účet.'],
  ['Budú pribúdať nové videá?', 'Áno. Členská knižnica pravidelne rastie o bonusové videá, zákulisie, premiéry aj nové exkluzívne série.'],
]

function Icon({ name }) {
  const paths = {
    film: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 5v14M17 5v14M3 9h4M17 9h4M3 15h4M17 15h4"/></>,
    camera: <><path d="M14.5 6 13 4H7L5.5 6H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2z"/><circle cx="10" cy="12" r="4"/></>,
    rocket: <><path d="M14 4c3-3 6-2 6-2s1 3-2 6l-6 6-4-4z"/><path d="m9 15-4 4M7 11l-4 1 3-5M13 17l-1 4 5-3"/></>,
    gift: <><rect x="3" y="8" width="18" height="13" rx="2"/><path d="M12 8v13M3 12h18M7.5 8C5 8 4 6.8 4 5.5S5 3 6.5 3C9 3 12 8 12 8M16.5 8C19 8 20 6.8 20 5.5S19 3 17.5 3C15 3 12 8 12 8"/></>,
    shirt: <path d="m8 4-5 3 2 5 3-1v10h8V11l3 1 2-5-5-3c-.6 1-1.8 2-4 2S8.6 5 8 4Z"/>,
    community: <><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20c0-4 2.5-6 6-6s6 2 6 6M14 15c4.5-.8 7 1.2 7 5"/></>,
    lock: <><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/></>,
    play: <path d="m9 7 8 5-8 5Z"/>,
    check: <path d="m5 12 4 4L19 6"/>,
  }
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}

function Reveal({ children, className = '', delay = 0 }) {
  const reduceMotion = useReducedMotion()
  return <motion.div className={className} initial={reduceMotion ? false : { opacity: 0, y: 22 }} whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }} viewport={{ once: true, amount: .15 }} transition={{ duration: .6, delay }}>{children}</motion.div>
}

export default function MembershipSection() {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState('club')
  const [checkoutPlan, setCheckoutPlan] = useState('')
  const [checkoutError, setCheckoutError] = useState('')
  const [openFaq, setOpenFaq] = useState(-1)
  const [premiumVideos, setPremiumVideos] = useState([])
  const [previewStatus, setPreviewStatus] = useState('loading')
  const [thumbnailUrls, setThumbnailUrls] = useState(new Map())
  const closeButtonRef = useRef(null)
  const checkoutLockRef = useRef(false)
  const { profile, session } = useProfile()
  const isAdmin = session?.user?.app_metadata?.role === 'admin'
  const isMember = isActiveClubMember(profile, isAdmin)
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    let active = true
    let refreshTimer
    async function loadPreviews(force = false) {
      try {
        const videos = (await getPublishedVideos()).filter((video) => ['member', 'vip'].includes(video.accessLevel)).slice(0, 6)
        if (!active) return
        setPremiumVideos(videos)
        setPreviewStatus('ready')
        const signed = await getSignedStorageUrls('thumbnails', videos.map((video) => video.thumbnail), force)
        if (active) setThumbnailUrls(signed)
      } catch {
        if (active) { setPremiumVideos([]); setPreviewStatus('error') }
      }
    }
    loadPreviews()
    refreshTimer = window.setInterval(() => loadPreviews(true), 14 * 60 * 1000)
    return () => { active = false; window.clearInterval(refreshTimer) }
  }, [])

  useEffect(() => {
    if (!isOpen) return undefined
    closeButtonRef.current?.focus()
    const closeOnEscape = (event) => event.key === 'Escape' && setIsOpen(false)
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [isOpen])

  const showModal = async () => {
    if (!session) {
      window.location.assign('/?auth=login&next=/clenstvo')
      return
    }
    if (checkoutLockRef.current) return
    checkoutLockRef.current = true
    setSelectedPlan('club')
    setCheckoutError('')
    setCheckoutPlan('club')
    window.location.assign('/checkout/club')
  }
  const collageVideos = useMemo(() => premiumVideos.slice(0, 4), [premiumVideos])
  const previewVideos = useMemo(() => premiumVideos.slice(0, 3), [premiumVideos])
  const fallbackImages = ['/images/team/vychod-brothers-team-day.webp', '/images/team/vychod-brothers-team-evening.webp']
  const imageFor = (video, index) => video
    ? (/^https?:\/\//i.test(video.thumbnail) ? video.thumbnail : thumbnailUrls.get(video.thumbnail)) || fallbackImages[index % fallbackImages.length]
    : fallbackImages[index % fallbackImages.length]
  const previewImageFor = (video) => video
    ? (/^https?:\/\//i.test(video.thumbnail) ? video.thumbnail : thumbnailUrls.get(video.thumbnail)) || ''
    : ''
  const checkoutCancelled = new URLSearchParams(window.location.search).get('checkout') === 'cancelled'

  return (
    <div className="membership-landing" id="clenstvo">
      {checkoutCancelled && <p className="membership-checkout-notice" role="status">Checkout bol zrušený. Nič vám nebolo účtované.</p>}
      <section className="membership-landing-hero">
        <div className="membership-hero-copy">
          <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: .6 }}>VÝCHOD BROTHERS · MEMBERSHIP</motion.span>
          <motion.h1 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .8, delay: .08 }}>STAŇ SA ČLENOM<br/><em>VÝCHOD BROTHERS</em></motion.h1>
          <motion.p initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .7, delay: .18 }}>Exkluzívne videá, bonusový obsah, premiéry, zákulisie a množstvo ďalšieho obsahu, ktorý na YouTube nikdy neuvidíš.</motion.p>
          <motion.div className="membership-hero-price" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .65, delay: .23 }}><strong>5,99 €</strong><span>/ MESIAC</span></motion.div>
          <motion.div className="membership-hero-actions" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .7, delay: .28 }}>
            {isMember ? <a href="/videos">POZRIEŤ ČLENSKÉ VIDEÁ <span>→</span></a> : <button type="button" disabled={Boolean(checkoutPlan)} onClick={showModal}>{checkoutPlan ? 'Otváram Checkout…' : 'STAŤ SA ČLENOM – 5,99 € / MESIAC'} <span>→</span></button>}
          </motion.div>
          <motion.small initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: .55 }}>BEZ ZÁVÄZKOV · ZRUŠÍŠ KEDYKOĽVEK</motion.small>
        </div>
        <motion.div className="membership-collage" initial={{ opacity: 0, x: 32 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 1, delay: .12 }} aria-label="Ukážka prémiových videí">
          {[0, 1, 2, 3].map((index) => {
            const video = collageVideos[index]
            return <motion.article className={`membership-collage-card collage-${index + 1}`} animate={reduceMotion ? undefined : { y: index % 2 ? [0, -7, 0] : [0, 6, 0] }} transition={{ duration: 7 + index, repeat: Infinity, ease: 'easeInOut' }} key={video?.id || index}>
              <img src={imageFor(video, index)} alt="" decoding="async" fetchPriority={index < 2 ? 'high' : 'auto'} />
              <div><span>ČLENSKÉ</span><strong>{video?.title || ['Iba pre našich členov', 'Zákulisie bez filtra', 'Exkluzívna premiéra', 'Bonusový príbeh'][index]}</strong></div>
            </motion.article>
          })}
          <div className="membership-collage-glow" />
        </motion.div>
        <a className="membership-scroll-cue" href="#benefity">OBJAV ČLENSTVO <span>↓</span></a>
      </section>

      <section className="membership-benefits" id="benefity">
        <Reveal className="membership-section-heading"><span>VIAC AKO LEN VIDEÁ</span><h2>PREČO BYŤ<br/><em>SÚČASŤOU?</em></h2><p>Vstúp bližšie k tvorbe, príbehom a momentom, ktoré ostávajú mimo verejného YouTube.</p></Reveal>
        <div className="membership-benefit-grid">{benefits.map((benefit, index) => <Reveal className="membership-benefit-card" delay={index * .04} key={benefit.title}><div><Icon name={benefit.icon}/></div><span>0{index + 1}</span><h3>{benefit.title}</h3><p>{benefit.text}</p></Reveal>)}</div>
      </section>

      <section className="membership-preview">
        <Reveal className="membership-preview-heading"><div><span>ORIGINÁLY VÝCHOD BROTHERS</span><h2>OBSAH, KTORÝ INDE <em>NEUVIDÍŠ.</em></h2></div><p>Členská knižnica plná premiér, bonusov a zákulisia. Posúvaj horizontálne a objav, čo ťa čaká.</p></Reveal>
        {previewStatus === 'loading' ? <div className="membership-preview-loading" aria-label="Načítavam členské videá">{[0, 1, 2].map((item) => <span key={item}/>)}</div> : previewVideos.length ? <div className={`membership-preview-rail items-${previewVideos.length}`}>
          {previewVideos.map((video) => {
            const accessLevel = video.accessLevel
            const unlocked = canAccessMembership(accessLevel, profile, isAdmin)
            const thumbnail = previewImageFor(video)
            const accessLabel = accessLevel === 'vip' ? 'BONUS' : 'MEMBER'
            const card = <article className={`membership-preview-card${unlocked ? ' is-unlocked' : ' is-locked'}`}>
              {thumbnail && <img src={thumbnail} alt={`Ukážka videa ${video.title}`} loading="lazy" decoding="async" onError={(event) => { event.currentTarget.hidden = true }} />}
              <div className="membership-preview-shade" />
              {!unlocked && <div className="membership-preview-lock"><Icon name="lock"/></div>}
              {unlocked && <div className="membership-preview-play"><Icon name="play"/></div>}
              <span className="membership-preview-action">{unlocked ? 'POZRIEŤ VIDEO' : 'ODOMKNÚŤ VIDEO'} <i aria-hidden="true">→</i></span>
              <div className="membership-preview-meta">
                <span className={`membership-preview-badge is-${accessLevel}`}>{accessLabel}</span>
                <strong>{video.title}</strong>
                <small>{video.duration || '—'}</small>
              </div>
            </article>
            return unlocked ? <a href={`/videos/${video.slug}`} key={video.id}>{card}</a> : <button type="button" disabled={Boolean(checkoutPlan)} onClick={showModal} key={video.id}>{card}</button>
          })}
        </div> : <div className="membership-preview-empty" role="status"><strong>{previewStatus === 'error' ? 'Knižnicu sa nepodarilo načítať.' : 'Prvé členské videá pripravujeme.'}</strong><span>{previewStatus === 'error' ? 'Skús stránku obnoviť o chvíľu.' : 'Nový obsah sa tu zobrazí hneď po publikovaní.'}</span></div>}
      </section>

      <section className="membership-plans-v4" id="plany">
        <Reveal className="membership-section-heading is-centered"><span>JEDNO ČLENSTVO · VŠETOK OBSAH</span><h2>VÝCHOD BROTHERS<br/><em>CLUB.</em></h2><p>Jednoduchý prístup ku všetkému členskému obsahu bez úrovní a doplatkov.</p></Reveal>
        <div className="membership-plan-grid"><motion.article className={`membership-plan-card is-vip is-recommended${isMember ? ' is-current' : ''}`} whileHover={reduceMotion ? undefined : { y: -3 }}>
          <span className="membership-plan-recommended">JEDINÝ PLÁN</span>{isMember && <span className="membership-plan-current">TVOJE AKTÍVNE ČLENSTVO</span>}
          <header><span>VÝCHOD BROTHERS</span><h3>{clubPlan.name}</h3><p>Všetky členské videá a funkcie v jednom predplatnom.</p></header>
          <div className="membership-plan-price"><strong>{planMeta.club.price}</strong><span>{planMeta.club.note}</span></div>
          <ul>{planBenefits.map((perk) => <li key={perk}><Icon name="check"/>{perk}</li>)}</ul>
          <div className="membership-plan-action">{isMember ? <a href="/videos">Prejsť na členský obsah <span>→</span></a> : <button type="button" disabled={Boolean(checkoutPlan)} onClick={showModal}>{checkoutPlan ? 'Otváram Checkout…' : 'STAŤ SA ČLENOM – 5,99 € / MESIAC'}<span>→</span></button>}<small>Zrušíš kedykoľvek.</small></div>
          <p className="membership-trust-note">Tvoríme pre komunitu Východ Brothers naprieč YouTube, TikTok a Instagram.</p>
        </motion.article></div>
      </section>

      <section className="membership-how">
        <Reveal className="membership-section-heading is-centered"><span>JEDNODUCHÉ OD PRVEJ SEKUNDY</span><h2>TRI KROKY.<br/><em>A IDEŠ.</em></h2></Reveal>
        <div className="membership-how-steps">{[['01', 'Aktivuj členstvo', 'Vytvor účet alebo sa prihlás a pokračuj k bezpečnej platbe.'], ['02', 'Zaplať', 'Dokonči bezpečnú mesačnú platbu cez Stripe.'], ['03', 'Pozeraj okamžite', 'Po potvrdení platby sa odomkne všetok členský obsah.']].map(([number, title, text], index) => <Reveal className="membership-how-step" delay={index * .1} key={number}><span>{number}</span><div><h3>{title}</h3><p>{text}</p></div>{index < 2 && <i aria-hidden="true">→</i>}</Reveal>)}</div>
      </section>

      <section className="membership-faq">
        <Reveal className="membership-section-heading"><span>VŠETKO PODSTATNÉ</span><h2>ČASTÉ<br/><em>OTÁZKY.</em></h2></Reveal>
        <div className="membership-faq-list">{faqs.map(([question, answer], index) => <div className={`membership-faq-item${openFaq === index ? ' is-open' : ''}`} key={question}><button type="button" aria-expanded={openFaq === index} onClick={() => setOpenFaq(openFaq === index ? -1 : index)}><span>{question}</span><i>{openFaq === index ? '−' : '+'}</i></button><AnimatePresence initial={false}>{openFaq === index && <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: .28 }}><p>{answer}</p></motion.div>}</AnimatePresence></div>)}</div>
      </section>

      <section className="membership-final-cta">
        <div className="membership-final-orbit" aria-hidden="true">VB</div>
        <Reveal className="membership-final-content"><div className="membership-final-copy"><span>TVORBA, KTORÁ POKRAČUJE AJ VĎAKA TEBE</span><h2>{isMember ? <>MÁŠ ODOMKNUTÝ CELÝ SVET<br/><em>VÝCHOD BROTHERS.</em></> : <>STAŇ SA ČLENOM<br/><em>EŠTE DNES.</em></>}</h2><p>{isMember ? 'Všetok členský obsah je pripravený v tvojom katalógu.' : '5,99 € / mesiac'}</p></div><div className="membership-final-action">{isMember ? <a className="membership-final-link" href="/videos">Prejsť na členský obsah <b>→</b></a> : <><button type="button" disabled={Boolean(checkoutPlan)} onClick={showModal}>{checkoutPlan ? 'Otváram Checkout…' : 'STAŤ SA ČLENOM'} <b>→</b></button><small className="membership-final-note">Zrušíš kedykoľvek.</small></>}</div></Reveal>
      </section>

      <AnimatePresence>{isOpen && <motion.div className="membership-modal" role="presentation" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => event.target === event.currentTarget && setIsOpen(false)}><motion.div className="membership-dialog" role="dialog" aria-modal="true" aria-labelledby="membership-dialog-title" initial={{ opacity: 0, y: 18, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: .98 }}><button ref={closeButtonRef} className="modal-close" type="button" aria-label="Zavrieť" onClick={() => setIsOpen(false)}>×</button><span>VÝCHOD BROTHERS · {selectedPlan.toUpperCase()}</span><h2 id="membership-dialog-title">Checkout sa nepodarilo spustiť</h2><p role="alert">{checkoutError || 'Platobná služba momentálne nie je dostupná.'}</p><button className="modal-confirm" type="button" onClick={() => setIsOpen(false)}>Rozumiem</button></motion.div></motion.div>}</AnimatePresence>
    </div>
  )
}
