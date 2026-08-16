import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { canAccessMembership } from '../lib/membership'
import VideoPlayer from './VideoPlayer'
import CtaButton from './CtaButton'

const labels = { member: 'ČLENSKÉ', vip: 'ČLENSKÉ' }

function Artwork({ url }) {
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [url])
  if (!url || failed) return <span className="members-showcase-fallback" aria-hidden="true"><b>VB</b><small>EXKLUZÍVNA PREMIÉRA</small></span>
  return <img src={url} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} />
}

function LockIcon() {
  return <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M9 14v-3a7 7 0 0 1 14 0v3" /><rect x="6" y="14" width="20" height="15" rx="4" /><path d="M16 20v4" /></svg>
}

function InlineTrailerFeature({ video, thumbnailUrl, membershipHref }) {
  const sectionRef = useRef(null)
  const [nearViewport, setNearViewport] = useState(false)
  const [inViewport, setInViewport] = useState(false)
  const [ended, setEnded] = useState(false)
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
      {nearViewport ? <VideoPlayer title={`${video.title} – verejná ukážka`} accessLevel="free" streamVideoId={video.trailerStreamVideoId} provider="cloudflare_stream" poster={video.poster} previewImage={video.previewImage} hasAccess trailer autoPlay={!reducedMotion} startMuted playbackActive={inViewport && !reducedMotion && !ended} replaySignal={replaySignal} onEnded={handleEnded} /> : <Artwork url={thumbnailUrl} />}
      <span className="members-inline-badge">TRAILER</span>
      {ended && <div className="members-inline-ended" role="status"><span>CHCEŠ VIDIEŤ CELÉ VIDEO?</span><p>Odomkni celé video a všetok členský obsah.</p><CtaButton href={membershipHref} variant="primary" icon="crown" label="ODOMKNÚŤ CELÉ VIDEO" sublabel="5,99 € / MESIAC" /><button type="button" onClick={handleReplay}>↻ PREHRAŤ UKÁŽKU ZNOVA</button></div>}
      <small className="members-inline-note">Bezplatná ukážka. Celé členské video zostáva chránené.</small>
    </div>
    <aside className="members-inline-offer"><span>VÝCHOD BROTHERS CLUB</span><h3>Chceš vidieť, ako to dopadlo?</h3><p>Celé video a mnoho ďalšieho nájdeš len vo Východ Brothers Clube.</p><ul><li>Exkluzívne videá a zákulisie</li><li>Bonusy a predčasné prístupy</li><li>Všetok budúci členský obsah</li></ul><CtaButton href={membershipHref} variant="primary" fullWidth icon="crown" label="ODOMKNÚŤ CELÉ VIDEO" sublabel="5,99 € / MESIAC" />{ended && <button type="button" onClick={handleReplay}>↻ PREHRAŤ UKÁŽKU ZNOVA</button>}</aside>
  </div>
}

function FeaturedPoster({ video, thumbnailUrl, unlocked, membershipHref }) {
  const content = <><Artwork url={thumbnailUrl} /><span className="members-featured-poster-gradient" /><span className="members-featured-poster-status"><i>{unlocked ? '▶' : <LockIcon />}</i><b>{unlocked ? 'POZRIEŤ CELÉ VIDEO' : 'CELÉ VIDEO JE PRE ČLENOV'}</b></span></>
  return <div className="members-inline-feature">
    <div className="members-inline-player members-featured-poster">
      {unlocked ? <a href={`/videos/${video.slug}`} aria-label={`Pozrieť celé video ${video.title}`}>{content}</a> : <div>{content}</div>}
      <span className="members-inline-badge">{video.featured ? 'FEATURED · ' : ''}{labels[video.accessLevel]}</span>
      <small className="members-inline-note">{unlocked ? 'Členský obsah je pre váš účet odomknutý.' : 'Toto video nemá verejnú ukážku. Celé video zostáva chránené.'}</small>
    </div>
    <OfferPanel video={video} unlocked={unlocked} membershipHref={membershipHref} />
  </div>
}

function OfferPanel({ video, unlocked, membershipHref }) {
  return <aside className="members-inline-offer"><span>VÝCHOD BROTHERS CLUB</span><h3>{unlocked ? video.title : 'Chceš vidieť, ako to dopadlo?'}</h3><p>{unlocked ? 'Toto členské video máte odomknuté. Pokračujte priamo na celé video.' : 'Celé video a mnoho ďalšieho nájdeš len vo Východ Brothers Clube.'}</p><ul><li>Exkluzívne videá a zákulisie</li><li>Bonusy a predčasné prístupy</li><li>Všetok budúci členský obsah</li></ul><CtaButton href={unlocked ? `/videos/${video.slug}` : membershipHref} variant="primary" fullWidth icon={unlocked ? 'play' : 'crown'} label={unlocked ? 'POZRIEŤ CELÉ VIDEO' : 'ODOMKNÚŤ CELÉ VIDEO'} sublabel={unlocked ? '' : '5,99 € / MESIAC'} /></aside>
}

function MemberVideoRail({ videos, selectedId, thumbnailUrls, onSelect }) {
  const railRef = useRef(null)
  const scroll = (direction) => railRef.current?.scrollBy({ left: direction * Math.max(280, railRef.current.clientWidth * .78), behavior: 'smooth' })
  if (!videos.length) return null
  return <div className="members-rail-block">
    <div className="members-rail-heading"><h3>Ďalšie členské videá</h3><div><button type="button" onClick={() => scroll(-1)} aria-label="Predchádzajúce členské videá">←</button><button type="button" onClick={() => scroll(1)} aria-label="Ďalšie členské videá">→</button></div></div>
    <div className="members-video-rail" ref={railRef}>
      {videos.map((video) => <button type="button" className={`members-rail-card${video.id === selectedId ? ' is-selected' : ''}`} onClick={() => onSelect(video.id)} aria-pressed={video.id === selectedId} key={video.id}>
        <span className="members-rail-art"><Artwork url={thumbnailUrls.get(video.thumbnail)} /><i>{labels[video.accessLevel]}</i><em>{video.duration || '—'}</em><span /></span>
        <b>{video.title}</b>
      </button>)}
    </div>
    <a className="members-rail-all" href="/videos"><span aria-hidden="true">▷</span> ZOBRAZIŤ VŠETKY ČLENSKÉ VIDEÁ <span aria-hidden="true">→</span></a>
  </div>
}

export default function PremiumShowcase({ videos, thumbnailUrls, profile, session, isAdmin }) {
  const defaultVideo = videos.find((video) => video.featured) || videos.find((video) => video.trailerStreamVideoId) || videos[0] || null
  const [selectedId, setSelectedId] = useState(defaultVideo?.id || '')
  const defaultIdRef = useRef(defaultVideo?.id || '')

  useEffect(() => {
    if (!defaultVideo) return
    if (defaultIdRef.current !== defaultVideo.id || !videos.some((video) => video.id === selectedId)) {
      defaultIdRef.current = defaultVideo.id
      setSelectedId(defaultVideo.id)
    }
  }, [defaultVideo, selectedId, videos])

  if (!defaultVideo) return null

  const selectedVideo = videos.find((video) => video.id === selectedId) || defaultVideo
  const unlocked = canAccessMembership(selectedVideo.accessLevel, profile, isAdmin)
  const returnTo = `/videos/${selectedVideo.slug}`
  const membershipHref = session ? `/checkout/club?returnTo=${encodeURIComponent(returnTo)}` : `/?auth=register&next=${encodeURIComponent(`/checkout/club?returnTo=${returnTo}`)}`
  const selectedThumbnail = thumbnailUrls.get(selectedVideo.thumbnail)

  return <section className={`members-showcase count-${videos.length} has-inline-trailer`} aria-labelledby="members-showcase-heading">
    <header className="members-showcase-heading"><div><span>ORIGINÁLNA TVORBA · BONUSY · PREMIÉRY</span><h2 id="members-showcase-heading">Len pre členov</h2><p>Príbehy a momenty, ktoré vo verejnom feede neuvidíš.</p></div><CtaButton className="club-discover-cta" href="/clenstvo" icon="crown" label="OBJAVIŤ ČLENSTVO" /></header>
    <div className="members-featured-switch" key={selectedVideo.id}>
      {!unlocked && selectedVideo.trailerStreamVideoId
        ? <InlineTrailerFeature video={selectedVideo} thumbnailUrl={selectedThumbnail} membershipHref={membershipHref} />
        : <FeaturedPoster video={selectedVideo} thumbnailUrl={selectedThumbnail} unlocked={unlocked} membershipHref={membershipHref} />}
    </div>
    <MemberVideoRail videos={videos} selectedId={selectedVideo.id} thumbnailUrls={thumbnailUrls} onSelect={setSelectedId} />
  </section>
}
