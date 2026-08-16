import { useEffect, useMemo, useState } from 'react'
import { getPublishedVideos } from '../lib/videos'
import { getSignedStorageUrls } from '../lib/storage'
import { useWatchHistory } from '../context/watch-history-context'
import { useProfile } from '../context/profile-context'
import { canAccessMembership } from '../lib/membership'

const accessLabels = {
  free: 'FREE',
  member: 'ČLENSKÉ',
  vip: 'ČLENSKÉ',
}

const categoryLabels = {
  youtube: 'YouTube',
  stream: 'Stream',
  cloudflare_stream: 'Cloudflare Stream',
}

function VideoCard({ video, thumbnailUrl, featured = false, progress = null, hasAccess = false }) {
  const locked = !hasAccess

  return (
    <article className={`catalog-video-card${featured ? ' is-featured' : ''}${locked ? ' is-locked' : ''}`}>
      <div className="catalog-video-image">
        {thumbnailUrl && <img src={thumbnailUrl} alt="" loading={featured ? 'eager' : 'lazy'} decoding="async" fetchPriority={featured ? 'high' : 'auto'} onError={(event) => { event.currentTarget.hidden = true }} />}
        <span className="catalog-video-duration">{video.duration}</span>
        {locked && <span className={`catalog-video-lock access-${video.accessLevel}`} aria-label={accessLabels[video.accessLevel]}>⌁ {accessLabels[video.accessLevel]}</span>}
        {progress && <div className="catalog-watch-progress" aria-label={progress.completed ? 'Dopozerané' : `Pozreté na ${Math.round(progress.progress_percent || 0)} percent`}><i style={{ width: `${progress.completed ? 100 : Math.min(100, progress.progress_percent || 0)}%` }} />{progress.completed && <span>Dopozerané</span>}</div>}
      </div>
      <div className="catalog-video-copy">
        <div className="catalog-video-meta"><span>{categoryLabels[video.category] ?? video.category}</span><span className={`access-${video.accessLevel}`}>{accessLabels[video.accessLevel]}</span></div>
        <h2>{video.title}</h2>
        <p>{video.shortDescription}</p>
        <a className="catalog-video-link" href={`/videos/${video.slug}`}>Pozrieť detail <span aria-hidden="true">→</span></a>
      </div>
    </article>
  )
}

export default function VideosSection() {
  const { session, profile } = useProfile()
  const { getProgress, isEnabled: watchHistoryEnabled } = useWatchHistory()
  const isAdmin = session?.user?.app_metadata?.role === 'admin'
  const progressFor = (video) => watchHistoryEnabled && canAccessMembership(video.accessLevel, profile, isAdmin) ? getProgress(video.id) : null
  const [publishedVideos, setPublishedVideos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [thumbnailUrls, setThumbnailUrls] = useState(new Map())
  const featuredVideo = publishedVideos.find((video) => video.featured) || null
  const accessLevels = useMemo(() => ['free', 'member', 'vip'].filter((level) => publishedVideos.some((video) => video.accessLevel === level)), [publishedVideos])
  const [accessFilter, setAccessFilter] = useState('all')
  const visibleVideos = accessFilter === 'all' ? publishedVideos : publishedVideos.filter((video) => video.accessLevel === accessFilter)
  const accessFor = (video) => canAccessMembership(video.accessLevel, profile, isAdmin)

  useEffect(() => {
    let active = true
    getPublishedVideos()
      .then((videos) => { if (active) setPublishedVideos(videos) })
      .catch(() => { if (active) setError('Videá sa nepodarilo načítať. Skús to, prosím, znova.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  useEffect(() => {
    let active = true
    let timer
    const paths = publishedVideos.map((video) => video.thumbnail).filter(Boolean)
    if (!paths.length) return undefined

    const refresh = async (force = false) => {
      try {
        const urls = await getSignedStorageUrls('thumbnails', paths, force)
        if (active) setThumbnailUrls(urls)
      } catch {
        if (active) setThumbnailUrls(new Map())
      } finally {
        if (active) timer = window.setTimeout(() => refresh(true), 14 * 60 * 1000)
      }
    }
    refresh()
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [publishedVideos])

  return (
    <section className="videos-catalog" aria-labelledby="videos-heading">
      <header className="videos-catalog-heading">
        <span>VÝCHOD BROTHERS · KATALÓG</span>
        <h1 id="videos-heading">Videá</h1>
        <p>Paródie, minifilmy, skeče aj pohľad do zákulisia na jednom mieste. Katalóg postupne pripravujeme.</p>
      </header>

      {loading && <p className="videos-catalog-status" aria-live="polite">Načítavam videá…</p>}
      {!loading && error && <p className="videos-catalog-status is-error" role="alert">{error}</p>}
      {!loading && !error && publishedVideos.length === 0 && <p className="videos-catalog-status">Zatiaľ tu nie sú žiadne publikované videá.</p>}

      {!loading && !error && featuredVideo && (
        <div className="videos-featured" aria-label="Odporúčané video">
          <span className="videos-section-label">Odporúčané</span>
          <VideoCard video={featuredVideo} thumbnailUrl={thumbnailUrls.get(featuredVideo.thumbnail)} progress={progressFor(featuredVideo)} hasAccess={accessFor(featuredVideo)} featured />
        </div>
      )}

      {!loading && !error && publishedVideos.length > 0 && <><div className="videos-toolbar">
        <h2>Všetky videá</h2>
        <div className="videos-filters" aria-label="Filtrovať videá podľa prístupu">
          <button type="button" className={accessFilter === 'all' ? 'is-active' : ''} aria-pressed={accessFilter === 'all'} onClick={() => setAccessFilter('all')}>Všetky</button>
          {accessLevels.map((level) => <button type="button" className={accessFilter === level ? 'is-active' : ''} aria-pressed={accessFilter === level} onClick={() => setAccessFilter(level)} key={level}>{accessLabels[level]}</button>)}
        </div>
      </div>

      <div className="videos-grid">
        {visibleVideos.map((video) => <VideoCard video={video} thumbnailUrl={thumbnailUrls.get(video.thumbnail)} progress={progressFor(video)} hasAccess={accessFor(video)} key={video.id} />)}
      </div></>}
    </section>
  )
}
