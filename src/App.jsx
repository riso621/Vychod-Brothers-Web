import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { animate, motion, useInView, useReducedMotion, useScroll, useSpring, useTransform } from 'framer-motion'
import { activeSocialProfiles, media, navItems, socialProfiles, stats } from './data'
import NewsletterSection from './components/NewsletterSection'
import Footer from './components/Footer'
import { useProfile } from './context/profile-context'
import { getEffectiveMembership } from './lib/membership'
import { useSiteContent } from './hooks/useSiteContent'
import './App.css'

const Arrow = () => <span className="arrow" aria-hidden="true">→</span>
const MotionLink = motion.create('a')
const AuthControl = lazy(() => import('./components/AuthModal'))
const ProfileProvider = lazy(() => import('./context/ProfileProvider'))
const WatchHistoryProvider = lazy(() => import('./context/WatchHistoryProvider'))
const AdminApp = lazy(() => import('./admin/AdminApp'))
const VideosSection = lazy(() => import('./components/VideosSection'))
const VideoDetail = lazy(() => import('./components/VideoDetail'))
const HomepageContent = lazy(() => import('./components/HomepageContent'))
const MembershipSection = lazy(() => import('./components/MembershipSection'))
const AccountDashboard = lazy(() => import('./components/AccountDashboard'))
const PasswordResetPage = lazy(() => import('./components/PasswordResetPage'))
const AuthCallbackPage = lazy(() => import('./components/AuthCallbackPage'))
const CheckoutPage = lazy(() => import('./components/CheckoutPage'))
const CollaborationSection = lazy(() => import('./components/CollaborationSection'))
const AnalyticsTracker = lazy(() => import('./components/AnalyticsTracker'))

const reveal = {
  hidden: { opacity: 0, y: 26 },
  visible: { opacity: 1, y: 0, transition: { duration: .85, ease: [.2, .7, .2, 1] } },
}

function Logo() {
  return <a className="brand" href={window.location.pathname === '/' ? '#domov' : '/'} aria-label="Východ Brothers – domov"><i>V</i>B</a>
}

function Header() {
  const [open, setOpen] = useState(false)
  const { profile, session } = useProfile()
  const membership = session?.user?.app_metadata?.role === 'admin' ? 'vip' : getEffectiveMembership(profile)
  const isVideosPage = window.location.pathname.startsWith('/videos')
  const isMembershipPage = window.location.pathname.startsWith('/clenstvo')
  const isHomePage = window.location.pathname === '/'
  const hrefs = !isHomePage
    ? ['/', '/videos', '/#onas', '/clenstvo', '/#merch', '/#kontakt']
    : ['#domov', '/videos', '#onas', '/clenstvo', '#merch', '#kontakt']
  return (
    <header className="topbar">
      <Logo />
      <nav className={open ? 'main-nav is-open' : 'main-nav'} aria-label="Hlavná navigácia">
        {navItems.map((item, index) => <a className={isVideosPage && index === 1 || isMembershipPage && index === 3 || isHomePage && index === 0 ? 'active' : ''} href={hrefs[index]} key={item} onClick={() => setOpen(false)}>{item}</a>)}
      </nav>
      <a className="join-brush" href={membership === 'vip' ? '/videos' : '/clenstvo'}>{membership === 'vip' ? 'VIP VIDEÁ' : membership === 'member' ? 'PREJSŤ NA VIP' : 'STAŤ SA ČLENOM'}</a>
      <Suspense fallback={null}><AuthControl /></Suspense>
      <button className="hamburger" aria-label="Otvoriť menu" aria-expanded={open} onClick={() => setOpen(!open)}><span /><span /><span /></button>
    </header>
  )
}

function SideRail() {
  return <aside className="side-rail" aria-label="Sociálne siete"><div className="socials">{activeSocialProfiles.map((profile) => <a href={profile.url} target="_blank" rel="noreferrer" aria-label={profile.label} title={profile.name} key={profile.id}>{profile.icon}</a>)}</div><span className="vertical">VÝCHOD BROTHERS</span><span className="plus">+</span><a className="scroll" href="#videa">↓ <small>SCROLL</small></a></aside>
}

function FilmStrip() {
  const { scrollY } = useScroll()
  const stripX = useTransform(scrollY, [0, 900], [0, 36])
  return <motion.div className="film-strip" style={{ x: stripX }} initial={{ opacity: 0, y: 35 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .75, duration: 1 }} aria-label="Ukážky z videí"><div className="perforations top" />{media.film.map((image, index) => <div className="frame" key={`${image}-${index}`}><img src={image} alt={`Momentka z natáčania ${index + 1}`} loading="eager" decoding="async" /></div>)}<div className="perforations bottom" /></motion.div>
}

function Hero() {
  const siteContent = useSiteContent()
  const reduceMotion = useReducedMotion()
  const { scrollY } = useScroll()
  const photoY = useTransform(scrollY, [0, 900], [0, reduceMotion ? 0 : 46])
  const copyY = useTransform(scrollY, [0, 700], [0, reduceMotion ? 0 : -24])
  return (
    <section className="hero" id="domov">
      <Header />
      <motion.div className="hero-photo" style={{ backgroundImage: `url(${media.hero})`, y: photoY }} animate={reduceMotion ? undefined : { scale: [1.015, 1.055] }} transition={{ duration: 18, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' }} />
      <div className="hero-smoke" aria-hidden="true" />
      <motion.div className="hero-copy" style={{ y: copyY }} initial="hidden" animate="visible" transition={{ staggerChildren: .16 }}><motion.h1 variants={reveal}>{String(siteContent['homepage.hero.headline'] || 'VÝCHOD BROTHERS').split(' ').map((word)=><span key={word}>{word}</span>)}</motion.h1><motion.p variants={reveal}>{siteContent['homepage.hero.subtitle'] || <>PARÓDIE. MINIFILMY. ZÁBAVA.<br />TO JE NÁŠ SVET.</>}</motion.p><MotionLink variants={reveal} className="outline-btn" href={socialProfiles.youtube.url} target="_blank" rel="noreferrer" whileHover={{ y: -2 }} whileTap={{ scale: .98 }}><b>▶</b> POZRIEŤ NAJNOVŠIE VIDEO</MotionLink></motion.div>
      <motion.div className="neon-mark" aria-hidden="true" initial={{ opacity: 0 }} animate={{ opacity: .76 }} transition={{ delay: .8, duration: 1.2 }}>VB</motion.div>
      <FilmStrip />
      <motion.p className="mentality" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1, duration: .8 }}>NIE JE LEN MIESTO,<br />JE TO MENTALITA.<i /></motion.p>
    </section>
  )
}

function AnimatedNumber({ value, placeholder = '--' }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, amount: .7 })
  const hasVerifiedValue = typeof value === 'string' && value.trim() !== ''
  const numericMatch = hasVerifiedValue ? value.match(/\d+(?:[.,]\d+)?/) : null
  const numeric = numericMatch ? Number(numericMatch[0].replace(',', '.')) : null
  const suffix = numericMatch ? value.replace(numericMatch[0], '') : ''
  const decimals = numericMatch?.[0].includes(',') || numericMatch?.[0].includes('.') ? 1 : 0
  const [display, setDisplay] = useState('0')
  useEffect(() => {
    if (!inView || numeric === null || !Number.isFinite(numeric)) return undefined
    const control = animate(0, numeric, { duration: 1.6, ease: 'easeOut', onUpdate: (latest) => setDisplay(latest.toFixed(decimals).replace('.', ',')) })
    return () => control.stop()
  }, [inView, numeric, decimals])
  return <strong ref={ref} aria-label={hasVerifiedValue ? value : 'Štatistika zatiaľ nie je načítaná'}>{hasVerifiedValue ? `${display}${suffix}` : placeholder}</strong>
}

function Stats() {
  return <motion.section className="stats-panel" id="onas" initial="hidden" whileInView="visible" viewport={{ once: true, amount: .25 }} transition={{ staggerChildren: .08 }}><motion.div variants={reveal} className="stats-intro">OVERENÉ<br />ŠTATISTIKY <Arrow /></motion.div>{stats.map((item) => { const profile = socialProfiles[item.social]; return <motion.a variants={reveal} className={`stat stat-${item.status}`} href={profile?.url || undefined} target={profile?.url ? '_blank' : undefined} rel={profile?.url ? 'noreferrer' : undefined} aria-label={profile?.url ? `${item.lines.join(' ')} – ${profile.name}` : undefined} data-platform={item.platform} data-metric={item.metric} key={item.id}><AnimatedNumber value={item.value} placeholder={item.placeholder} /><span>{item.lines[0]}<br />{item.lines[1]}</span><i /></motion.a> })}</motion.section>
}

function HomePage() {
  useEffect(() => { const observer = new IntersectionObserver((entries) => entries.forEach((entry) => entry.isIntersecting && entry.target.classList.add('visible')), { threshold: .08 }); document.querySelectorAll('.reveal').forEach((el) => observer.observe(el)); return () => observer.disconnect() }, [])
  const { scrollYProgress } = useScroll()
  const smoothProgress = useSpring(scrollYProgress, { stiffness: 90, damping: 24 })
  return <><motion.div className="scroll-progress" style={{ scaleX: smoothProgress }} /><SideRail /><main className="site-shell"><div className="ambient-light one" /><div className="ambient-light two" /><Hero /><Stats /><HomepageContent /><Suspense fallback={null}><CollaborationSection /></Suspense><NewsletterSection /><Footer /></main></>
}

function VideosPage({ slug }) {
  return <main className="videos-page"><Header />{slug ? <VideoDetail slug={slug} /> : <VideosSection />}<Footer /></main>
}

function AccountPage() {
  return <main className="account-page"><Header /><AccountDashboard /><Footer /></main>
}

function MembershipPage() {
  return <main className="membership-page"><Header /><MembershipSection standalone /><Footer /></main>
}

function AuthFlowPage({ type }) {
  return <main className="account-page"><Header />{type === 'reset' ? <PasswordResetPage /> : <AuthCallbackPage />}<Footer /></main>
}

function CheckoutRoute({ plan }) {
  return <main className="checkout-page"><Header /><CheckoutPage plan={plan} /></main>
}

export default function App() {
  const path = window.location.pathname
  const isAdminRoute = path === '/admin' || path.startsWith('/admin/')
  if (isAdminRoute) {
    return <Suspense fallback={<div className="admin-boot">Načítavam administráciu…</div>}><ProfileProvider><AdminApp /></ProfileProvider></Suspense>
  }
  const page = path.startsWith('/videos')
    ? <VideosPage slug={path === '/videos' || path === '/videos/' ? '' : decodeURIComponent(path.slice('/videos/'.length))} />
    : /^\/checkout\/(member|vip)\/?$/.test(path)
      ? <CheckoutRoute plan={path.split('/')[2]} />
    : path === '/account' || path === '/account/'
      ? <AccountPage />
      : path === '/clenstvo' || path === '/clenstvo/'
        ? <MembershipPage />
        : path === '/reset-hesla' || path === '/reset-hesla/'
          ? <AuthFlowPage type="reset" />
          : path === '/auth/callback' || path === '/auth/callback/'
            ? <AuthFlowPage type="callback" />
        : <HomePage />
  return <Suspense fallback={null}><ProfileProvider><WatchHistoryProvider><AnalyticsTracker />{page}</WatchHistoryProvider></ProfileProvider></Suspense>
}
