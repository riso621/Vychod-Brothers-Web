import { useEffect, useState } from 'react'
import { getPublishedVideoBySlug } from '../lib/videos'
import { useProfile } from '../context/profile-context'
import VideoPlayer from './VideoPlayer'
import { canAccessMembership } from '../lib/membership'

const accessLabels = {
  free: 'FREE',
  member: 'Pre členov',
  vip: 'VIP obsah',
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

      <VideoPlayer youtubeUrl={video.youtubeUrl} title={video.title} accessLevel={video.accessLevel} streamVideoId={video.streamVideoId} provider={video.provider} poster={video.poster} previewImage={video.previewImage} hasAccess={hasAccess} accessLoading={accessLoading} />

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
    </article>
  )
}
