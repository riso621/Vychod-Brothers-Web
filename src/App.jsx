import { lazy, Suspense, useState } from 'react'
import { motion, useScroll, useSpring } from 'framer-motion'
import { aboutPath } from './data'
import Footer from './components/Footer'
import NewsletterSection from './components/NewsletterSection'
import { useProfile } from './context/profile-context'
import { isActiveClubMember } from './lib/membership'
import PublicCinematicBackground from './components/PublicCinematicBackground'
import './App.css'
import './netflix.css'

const AuthControl = lazy(() => import('./components/AuthModal'))
const ProfileProvider = lazy(() => import('./context/ProfileProvider'))
const WatchHistoryProvider = lazy(() => import('./context/WatchHistoryProvider'))
const AdminApp = lazy(() => import('./admin/AdminApp'))
const VideosSection = lazy(() => import('./components/VideosSection'))
const VideoDetail = lazy(() => import('./components/VideoDetail'))
const StreamingHome = lazy(() => import('./components/StreamingHome'))
const CinematicIntro = lazy(() => import('./components/CinematicIntro'))
const MembershipSection = lazy(() => import('./components/MembershipSection'))
const AccountDashboard = lazy(() => import('./components/AccountDashboard'))
const PasswordResetPage = lazy(() => import('./components/PasswordResetPage'))
const AuthCallbackPage = lazy(() => import('./components/AuthCallbackPage'))
const RegistrationPage = lazy(() => import('./components/RegistrationPage'))
const LoginPage = lazy(() => import('./components/LoginPage'))
const ProfileSelectionPage = lazy(() => import('./components/ProfileSelectionPage'))
const CheckoutPage = lazy(() => import('./components/CheckoutPage'))
const CollaborationSection = lazy(() => import('./components/CollaborationSection'))
const CollaborationTeaser = lazy(() => import('./components/CollaborationTeaser'))
const AboutStoryTeaser = lazy(() => import('./components/AboutStoryTeaser'))
const AboutPage = lazy(() => import('./components/AboutPage'))
const AnalyticsTracker = lazy(() => import('./components/AnalyticsTracker'))
const LegalPage = lazy(() => import('./components/LegalPage'))

function Logo() {
  return <a className="brand" href="/" aria-label="Východ Brothers – domov"><i>V</i>B<span>VÝCHOD BROTHERS</span></a>
}

function Header() {
  const [open, setOpen] = useState(false)
  const { profile, session } = useProfile()
  const isMember = isActiveClubMember(profile, session?.user?.app_metadata?.role === 'admin')
  const path = window.location.pathname
  const nav = [['Domov', '/'], ['Filmy', '/filmy'], ['Seriály', '/serialy'], ['Všetky videá', '/videos'], ['Členstvo', '/clenstvo']]
  return <header className={`topbar${session ? '' : ' public-topbar'}`}>
    <Logo />
    {session && <nav className={open ? 'main-nav is-open' : 'main-nav'} aria-label="Hlavná navigácia">
      {nav.map(([label, href]) => <a className={path === href || href === '/videos' && path.startsWith('/videos') ? 'active' : ''} href={href} key={href} onClick={() => setOpen(false)}>{label}</a>)}
    </nav>}
    {session && <a className="join-brush" href={isMember ? '/videos' : '/clenstvo'}>{isMember ? 'MOJE VIDEÁ' : 'OD 6,99 €'}</a>}
    {session ? <Suspense fallback={null}><AuthControl /></Suspense> : <a className="auth-trigger" href="/prihlasenie">Prihlásiť sa</a>}
    {session && <button className="hamburger" aria-label="Otvoriť menu" aria-expanded={open} onClick={() => setOpen(!open)}><span /><span /><span /></button>}
  </header>
}

function HomePage() {
  const { session, authLoading } = useProfile()
  const { scrollYProgress } = useScroll()
  const smoothProgress = useSpring(scrollYProgress, { stiffness: 90, damping: 24 })
  return <><motion.div className="scroll-progress" style={{ scaleX: smoothProgress }} /><main className="site-shell streaming-shell"><Header /><StreamingHome />{!authLoading && session && <><Suspense fallback={null}><AboutStoryTeaser /><CollaborationTeaser /></Suspense><NewsletterSection /><Footer /></>}</main></>
}

function VideosPage({ slug, contentType = 'all' }) {
  return <main className="videos-page"><Header />{slug ? <VideoDetail slug={slug} /> : <VideosSection contentType={contentType} />}<Footer /></main>
}

function StandardPage({ className, children, footerVariant }) {
  return <main className={className}><Header />{children}<Footer variant={footerVariant} /></main>
}

function routeFor(path) {
  if (path === '/registracia' || path === '/registracia/') return <RegistrationPage />
  if (path === '/prihlasenie' || path === '/prihlasenie/') return <LoginPage />
  if (path === '/profil' || path === '/profil/') return <ProfileSelectionPage />
  if (path === '/filmy' || path === '/filmy/') return <VideosPage contentType="movie" />
  if (path === '/serialy' || path === '/serialy/') return <VideosPage contentType="series" />
  if (path.startsWith('/videos')) return <VideosPage slug={path === '/videos' || path === '/videos/' ? '' : decodeURIComponent(path.slice('/videos/'.length))} />
  if (/^\/checkout\/(club|member|vip)\/?$/.test(path)) return <main className="checkout-page"><Header /><CheckoutPage plan="club" /></main>
  if (path === '/account' || path === '/account/') return <StandardPage className="account-page"><AccountDashboard /></StandardPage>
  if (path === '/clenstvo' || path === '/clenstvo/') return <StandardPage className="membership-page" footerVariant="membership"><MembershipSection standalone /></StandardPage>
  if (path === aboutPath || path === `${aboutPath}/`) return <StandardPage className="about-page"><AboutPage /></StandardPage>
  if (path === '/spolupraca' || path === '/spolupraca/') return <StandardPage className="collaboration-page"><CollaborationSection /></StandardPage>
  if (path === '/reset-hesla' || path === '/reset-hesla/') return <StandardPage className="account-page"><PasswordResetPage /></StandardPage>
  if (path === '/auth/callback' || path === '/auth/callback/') return <StandardPage className="account-page"><AuthCallbackPage /></StandardPage>
  if (path === '/obchodne-podmienky' || path === '/obchodne-podmienky/') return <StandardPage className="legal-shell"><LegalPage type="terms" /></StandardPage>
  if (path === '/ochrana-osobnych-udajov' || path === '/ochrana-osobnych-udajov/') return <StandardPage className="legal-shell"><LegalPage type="privacy" /></StandardPage>
  return <HomePage />
}

export default function App() {
  const path = window.location.pathname
  if (path === '/admin' || path.startsWith('/admin/')) {
    return <Suspense fallback={<div className="admin-boot">Načítavam administráciu…</div>}><ProfileProvider><AdminApp /></ProfileProvider></Suspense>
  }
  return <Suspense fallback={null}><PublicCinematicBackground /><CinematicIntro /><ProfileProvider><WatchHistoryProvider><AnalyticsTracker />{routeFor(path)}</WatchHistoryProvider></ProfileProvider></Suspense>
}
