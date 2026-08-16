import { useEffect, useState } from 'react'
import { getPublishedVideoBySlug } from '../lib/videos'
import { useProfile } from '../context/profile-context'
import VideoPlayer from './VideoPlayer'
import { canAccessMembership } from '../lib/membership'
import { useWatchHistory } from '../context/watch-history-context'
import VideoInteractions from './VideoInteractions'

const accessLabels = {
  free: 'FREE',
  member: 'Členské video',
  vip: 'Členské video',
}

const categoryLabels = {
  youtube: 'YouTube',
  stream: 'Stream',
  cloudflare_stream: 'Cloudflare Stream',
}

const formatDate = (publishedAt) => new Intl.DateTimeFormat('sk-SK', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
}).format(new Date(publishedAt))

export default function VideoDetail({ slug }) {
  const { session, profile, authLoading, profileLoading } = useProfile()
  const [video, setVideo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const { getProgress, saveProgress, isEnabled: watchHistoryEnabled } = useWatchHistory()

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    getPublishedVideoBySlug(slug)
      .then((result) => { if (active) setVideo(result) })
      .catch(() => { if (active) setError('Video sa nepodarilo načítať. Skús to, prosím, znova.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [slug])

  if (loading) return <section className="video-not-found" aria-live="polite"><p>Načítavam video…</p></section>
  if (error) return <section className="video-not-found" role="alert"><h1>Video sa nepodarilo načítať</h1><p>{error}</p><a href="/videos">← Späť na videá</a></section>

  if (!video) {
    return (
      <section className="video-not-found" aria-labelledby="video-not-found-heading">
        <span>404</span>
        <h1 id="video-not-found-heading">Video sa nenašlo</h1>
        <p>Hľadané video neexistuje alebo zatiaľ nie je dostupné.</p>
        <a href="/videos">← Späť na videá</a>
      </section>
    )
  }

  const isAdmin = session?.user?.app_metadata?.role === 'admin'
  const hasAccess = canAccessMembership(video.accessLevel, profile, isAdmin)
  const accessLoading = video.accessLevel !== 'free' && (authLoading || profileLoading)
  const videoPath = `/videos/${slug}`
  const membershipHref = session
    ? `/checkout/club?returnTo=${encodeURIComponent(videoPath)}`
    : `/?auth=register&next=${encodeURIComponent(`/checkout/club?returnTo=${videoPath}`)}`
  const lockedCopy = { heading: 'Celé video je dostupné členom.', description: 'Aktivuj Východ Brothers Club a odomkni všetky členské videá.', ctaLabel: 'Stať sa členom – 5,99 € / mesiac', ctaHref: membershipHref }
  const watchProgress = getProgress(video.id)

  return (
    <article className="video-detail">
      <a className="video-detail-back" href="/videos">← Späť na videá</a>

      <header className="video-detail-heading">
        <div className="video-detail-meta">
          <span>{categoryLabels[video.category] ?? video.category}</span>
          <span className={`access-${video.accessLevel}`}>{accessLabels[video.accessLevel]}</span>
        </div>
        <h1>{video.title}</h1>
        <p>{video.shortDescription}</p>
      </header>

      {!hasAccess && video.trailerStreamVideoId && !accessLoading && <section className="video-trailer-preview"><header><span>VEREJNÁ UKÁŽKA</span><h2>Pozrite si trailer</h2><p>Toto je ukážka. Celé video a všetok členský obsah odomknete jedným členstvom.</p></header><VideoPlayer title={`${video.title} – ukážka`} accessLevel="free" streamVideoId={video.trailerStreamVideoId} provider="cloudflare_stream" poster={video.poster} previewImage={video.previewImage} hasAccess trailer /><aside className="video-trailer-cta"><div><span>VÝCHOD BROTHERS CLUB</span><h2>POZRITE SI CELÉ VIDEO</h2><p>Všetok členský obsah za <strong>5,99 € / mesiac</strong>.</p><small>Bez záväzku • Zrušíte kedykoľvek</small></div><a href={membershipHref}>STAŤ SA ČLENOM →</a></aside></section>}
      {(hasAccess || !video.trailerStreamVideoId || accessLoading) && <VideoPlayer youtubeUrl={video.youtubeUrl} title={video.title} accessLevel={video.accessLevel} streamVideoId={video.streamVideoId} provider={video.provider} poster={video.poster} previewImage={video.previewImage} hasAccess={hasAccess} accessLoading={accessLoading} lockedCopy={lockedCopy} videoId={video.id} watchProgress={watchProgress} onWatchProgress={watchHistoryEnabled ? saveProgress : null} />}

      <div className="video-detail-content">
        <div className="video-detail-description">
          <h2>O videu</h2>
          <p>{video.description}</p>
          {video.tags.length > 0 && <div className="video-detail-tags" aria-label="Tagy videa">{video.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div>}
        </div>
        <dl className="video-detail-facts">
          <div><dt>Dĺžka</dt><dd>{video.duration}</dd></div>
          <div><dt>Kategória</dt><dd>{categoryLabels[video.category] ?? video.category}</dd></div>
          <div><dt>Publikované</dt><dd>{formatDate(video.publishedAt)}</dd></div>
          <div><dt>Prístup</dt><dd>{accessLabels[video.accessLevel]}</dd></div>
        </dl>
      </div>
      {!accessLoading && hasAccess && <VideoInteractions videoId={video.id} />}
    </article>
  )
}
