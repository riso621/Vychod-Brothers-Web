import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { canAccessMembership } from '../lib/membership'
import VideoPlayer from './VideoPlayer'

const labels = { member: 'ČLENSKÉ', vip: 'ČLENSKÉ' }
const prices = { member: '5,99 € / mesiac', vip: '5,99 € / mesiac' }
const reveal = { hidden: { opacity: 0, y: 22 }, visible: { opacity: 1, y: 0, transition: { duration: .65, ease: [.2, .7, .2, 1] } } }

function Artwork({ url }) {
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [url])
  if (!url || failed) return <span className="members-showcase-fallback" aria-hidden="true"><b>VB</b><small>EXKLUZÍVNA PREMIÉRA</small></span>
  return <img src={url} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} />
}

function LockIcon() {
  return <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M9 14v-3a7 7 0 0 1 14 0v3" /><rect x="6" y="14" width="20" height="15" rx="4" /><path d="M16 20v4" /></svg>
}

function CardVisual({ video, thumbnailUrl, unlocked }) {
  return <><Artwork url={thumbnailUrl} /><span className="members-showcase-gradient" />{unlocked ? <span className="members-showcase-play"><i aria-hidden="true">▶</i><b>PREHRAŤ</b></span> : <span className="members-showcase-lock"><i><LockIcon /></i><em>{labels[video.accessLevel]}</em><strong>{prices[video.accessLevel]}</strong></span>}<span className="members-showcase-meta"><span><b>{video.title}</b><small>{video.duration || '—'}</small></span><em className={`access-${video.accessLevel}`}>{labels[video.accessLevel]}</em></span></>
}

function PremiumShowcaseCard({ video, thumbnailUrl, unlocked }) {
  const visual = <CardVisual video={video} thumbnailUrl={thumbnailUrl} unlocked={unlocked} />
  return <motion.article className={`members-showcase-card ${unlocked ? 'is-unlocked' : 'is-locked'}`} initial="hidden" whileInView="visible" viewport={{ once: true, amount: .2 }} variants={reveal}>{unlocked ? <a className="members-showcase-art" href={`/videos/${video.slug}`} aria-label={`Pozrieť video ${video.title}`}>{visual}</a> : <details className="members-showcase-art"><summary aria-label={`Zobraziť členstvo pre video ${video.title}`}>{visual}</summary><a className="members-showcase-cta" href="/clenstvo">Stať sa členom <span aria-hidden="true">→</span></a></details>}</motion.article>
}

function formatDuration(seconds) {
  const value = Math.max(0, Math.round(seconds || 0))
  if (!value) return ''
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`
}

function InlineTrailerFeature({ video, thumbnailUrl, membershipHref }) {
  const sectionRef = useRef(null)
  const [nearViewport, setNearViewport] = useState(false)
  const [inViewport, setInViewport] = useState(false)
  const [ended, setEnded] = useState(false)
  const [duration, setDuration] = useState(0)
  const [replaySignal, setReplaySignal] = useState(0)
  const reducedMotion = useMemo(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false, [])

  useEffect(() => {
    const section = sectionRef.current
    if (!section || !('IntersectionObserver' in window)) { setNearViewport(true); return undefined }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setNearViewport(true)
      setInViewport(entry.intersectionRatio >= .6)
    }, { threshold: [0, .6], rootMargin: '260px 0px' })
    observer.observe(section)
    return () => observer.disconnect()
  }, [])

  const handleEnded = useCallback(() => setEnded(true), [])

  const handleReplay = () => {
    setEnded(false)
    setReplaySignal((value) => value + 1)
  }

  return <div className="members-inline-feature">
    <div className="members-inline-player" ref={sectionRef}>
      {nearViewport ? <VideoPlayer title={`${video.title} – verejná ukážka`} accessLevel="free" streamVideoId={video.trailerStreamVideoId} provider="cloudflare_stream" poster={video.poster} previewImage={video.previewImage} hasAccess trailer autoPlay={!reducedMotion} startMuted playbackActive={inViewport && !reducedMotion && !ended} replaySignal={replaySignal} onDurationChange={setDuration} onEnded={handleEnded} /> : <Artwork url={thumbnailUrl} />}
      <span className="members-inline-badge">UKÁŽKA{duration ? ` · ${formatDuration(duration)}` : ''}</span>
      {ended && <div className="members-inline-ended" role="status"><span>CHCEŠ VIDIEŤ CELÉ VIDEO?</span><p>Odomkni celé video a všetok členský obsah.</p><a href={membershipHref}>ODOMKNÚŤ CELÉ VIDEO – 5,99 € / MESIAC</a><button type="button" onClick={handleReplay}>↻ PREHRAŤ UKÁŽKU ZNOVA</button></div>}
      <small className="members-inline-note">Bezplatná ukážka. Celé členské video zostáva chránené.</small>
    </div>
    <aside className="members-inline-offer"><span>VÝCHOD BROTHERS CLUB</span><h3>Chceš vidieť, ako to dopadlo?</h3><p>Celé video a mnoho ďalšieho nájdeš len vo Východ Brothers Clube.</p><ul><li>Exkluzívne videá a zákulisie</li><li>Bonusy a predčasné prístupy</li><li>Všetok budúci členský obsah</li></ul><a href={membershipHref}>ODOMKNÚŤ CELÉ VIDEO <strong>5,99 € / MESIAC</strong></a>{ended && <button type="button" onClick={handleReplay}>↻ PREHRAŤ UKÁŽKU ZNOVA</button>}</aside>
  </div>
}

export default function PremiumShowcase({ videos, thumbnailUrls, profile, session, isAdmin }) {
  if (!videos.length) return null
  const lockedTrailerVideo = videos.find((video) => video.trailerStreamVideoId && !canAccessMembership(video.accessLevel, profile, isAdmin))
  const returnTo = lockedTrailerVideo ? `/videos/${lockedTrailerVideo.slug}` : '/videos'
  const membershipHref = session ? `/checkout/club?returnTo=${encodeURIComponent(returnTo)}` : `/?auth=register&next=${encodeURIComponent(`/checkout/club?returnTo=${returnTo}`)}`
  return <section className={`members-showcase count-${videos.length}${lockedTrailerVideo ? ' has-inline-trailer' : ''}`} aria-labelledby="members-showcase-heading"><header className="members-showcase-heading"><div><span>ORIGINÁLNA TVORBA · BONUSY · PREMIÉRY</span><h2 id="members-showcase-heading">Len pre členov</h2><p>Príbehy a momenty, ktoré vo verejnom feede neuvidíš.</p></div><a href="/clenstvo">Objaviť členstvo <span aria-hidden="true">→</span></a></header>{lockedTrailerVideo ? <InlineTrailerFeature video={lockedTrailerVideo} thumbnailUrl={thumbnailUrls.get(lockedTrailerVideo.thumbnail)} membershipHref={membershipHref} /> : <div className="members-showcase-row">{videos.map((video) => <PremiumShowcaseCard video={video} thumbnailUrl={thumbnailUrls.get(video.thumbnail)} unlocked={canAccessMembership(video.accessLevel, profile, isAdmin)} key={video.id} />)}</div>}</section>
}
