import { useEffect, useMemo, useState } from 'react'
import { useWatchHistory } from '../context/watch-history-context'
import { getPublishedVideos } from '../lib/videos'
import { getSignedStorageUrls } from '../lib/storage'
import { useProfile } from '../context/profile-context'
import { canAccessMembership } from '../lib/membership'

const formatTime = (seconds) => {
  const value = Math.max(0, Math.floor(seconds || 0))
  const hours = Math.floor(value / 3600)
  const minutes = Math.floor((value % 3600) / 60)
  const rest = value % 60
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}` : `${minutes}:${String(rest).padStart(2, '0')}`
}

export default function ContinueWatchingSection() {
  const { history, isEnabled, loading: historyLoading } = useWatchHistory()
  const { session, profile } = useProfile()
  const [videos, setVideos] = useState([])
  const [thumbnails, setThumbnails] = useState(new Map())

  useEffect(() => {
    if (!isEnabled) return undefined
    let active = true
    getPublishedVideos().then((items) => { if (active) setVideos(items) }).catch(() => {})
    return () => { active = false }
  }, [isEnabled])

  const items = useMemo(() => videos
    .map((video) => ({ video, progress: history.get(video.id) }))
    .filter(({ video, progress }) => progress && progress.progress_percent > 0 && !progress.completed && canAccessMembership(video.accessLevel, profile, session?.user?.app_metadata?.role === 'admin'))
    .sort((a, b) => new Date(b.progress.last_watched_at) - new Date(a.progress.last_watched_at))
    .slice(0, 6), [history, profile, session?.user?.app_metadata?.role, videos])

  useEffect(() => {
    let active = true
    const paths = items.map(({ video }) => video.thumbnail).filter(Boolean)
    if (!paths.length) {
      setThumbnails(new Map())
      return undefined
    }
    getSignedStorageUrls('thumbnails', paths).then((urls) => { if (active) setThumbnails(urls) }).catch(() => {})
    return () => { active = false }
  }, [items])

  if (!isEnabled || historyLoading || !items.length) return null

  return (
    <section className="continue-watching" aria-labelledby="continue-watching-heading">
      <header><span>TVOJ ROZPOZERANÝ OBSAH</span><h2 id="continue-watching-heading">Pokračovať v pozeraní</h2></header>
      <div className="continue-watching-grid">
        {items.map(({ video, progress }) => (
          <article className="continue-card" key={video.id}>
            <a href={`/videos/${video.slug}`} aria-label={`Pokračovať vo videu ${video.title}`}>
              <div className="continue-card-image">
                {thumbnails.get(video.thumbnail) && <img src={thumbnails.get(video.thumbnail)} alt="" loading="lazy" />}
                <span>Pokračovať od {formatTime(progress.position_seconds)}</span>
                <i style={{ width: `${Math.min(100, progress.progress_percent || 0)}%` }} />
              </div>
              <div className="continue-card-copy"><h3>{video.title}</h3><span>Pokračovať →</span></div>
            </a>
          </article>
        ))}
      </div>
    </section>
  )
}
