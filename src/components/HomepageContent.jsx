import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import ContinueWatchingSection from './ContinueWatchingSection'
import { getPublishedVideos } from '../lib/videos'
import { getSignedStorageUrls } from '../lib/storage'
import { getLatestYouTubeVideo } from '../lib/youtube'
import { useProfile } from '../context/profile-context'
import { canAccessMembership } from '../lib/membership'

const accessLabels = { member: 'MEMBER', vip: 'VIP' }
const prices = { member: '4,99 € / mesiac', vip: '9,99 € / mesiac' }
const reveal = { hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0, transition: { duration: .7, ease: [.2, .7, .2, 1] } } }

function formatDate(value) {
  if (!value) return ''
  return new Intl.DateTimeFormat('sk-SK', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(value))
}

function shortDescription(value) {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  return text.length > 190 ? `${text.slice(0, 187).trim()}…` : text
}

function Thumbnail({ url, eager = false }) {
  if (!url) return <span className="home-video-placeholder" aria-hidden="true">VB</span>
  return <img src={url} alt="" loading={eager ? 'eager' : 'lazy'} decoding="async" onError={(event) => { event.currentTarget.hidden = true }} />
}

function PremiumCard({ video, thumbnailUrl, hasAccess }) {
  const destination = hasAccess ? `/videos/${video.slug}` : '/clenstvo'
  return <motion.article className={`home-premium-card${hasAccess ? ' is-unlocked' : ' is-locked'}`} initial="hidden" whileInView="visible" viewport={{ once: true, amount: .18 }} variants={reveal}>
    <a className="home-premium-image" href={destination} aria-label={hasAccess ? `Pozrieť video ${video.title}` : `Odomknúť ${accessLabels[video.accessLevel]} video ${video.title}`}>
      <Thumbnail url={thumbnailUrl} />
      {!hasAccess && <><span className="home-premium-shade" /><span className="home-premium-lock" aria-hidden="true">🔒</span></>}
      <span className={`home-premium-level access-${video.accessLevel}`}>{accessLabels[video.accessLevel]}</span>
    </a>
    <div className="home-premium-copy"><span>{hasAccess ? 'ODOMKNUTÝ OBSAH' : prices[video.accessLevel]}</span><h3>{video.title}</h3><a href={destination}>{hasAccess ? 'Pozrieť video' : 'Odomknúť členstvo'} <b aria-hidden="true">→</b></a></div>
  </motion.article>
}

export default function HomepageContent() {
  const { session, profile } = useProfile()
  const [youtubeVideo, setYoutubeVideo] = useState(null)
  const [premiumVideos, setPremiumVideos] = useState([])
  const [thumbnailUrls, setThumbnailUrls] = useState(new Map())
  const [youtubeLoading, setYoutubeLoading] = useState(true)
  const [youtubeError, setYoutubeError] = useState(false)
  const isAdmin = session?.user?.app_metadata?.role === 'admin'

  useEffect(() => {
    let active = true
    getLatestYouTubeVideo().then((video) => { if (active) setYoutubeVideo(video) }).catch(() => { if (active) setYoutubeError(true) }).finally(() => { if (active) setYoutubeLoading(false) })
    getPublishedVideos().then((videos) => { if (active) setPremiumVideos(videos.filter((video) => ['member', 'vip'].includes(video.accessLevel)).slice(0, 3)) }).catch(() => {})
    return () => { active = false }
  }, [])

  useEffect(() => {
    let active = true
    let timer
    const paths = premiumVideos.map((video) => video.thumbnail).filter(Boolean)
    const external = new Map(paths.filter((path) => /^https?:\/\//i.test(path)).map((path) => [path, path]))
    const refresh = async (force = false) => {
      if (!paths.length) return
      try {
        const signed = await getSignedStorageUrls('thumbnails', paths, force)
        if (active) setThumbnailUrls(new Map([...external, ...signed]))
      } catch {
        if (active) setThumbnailUrls(external)
      } finally {
        if (active) timer = window.setTimeout(() => refresh(true), 14 * 60 * 1000)
      }
    }
    refresh()
    return () => { active = false; window.clearTimeout(timer) }
  }, [premiumVideos])

  return <div className="homepage-content" id="videa">
    <section className="home-latest home-youtube-latest" aria-labelledby="home-latest-heading">
      <header className="home-section-heading"><span>VÝCHOD BROTHERS NA YOUTUBE</span><h2 id="home-latest-heading">Najnovšie YouTube video</h2></header>
      {youtubeLoading && <p className="home-video-status" aria-live="polite">Načítavam najnovšie YouTube video…</p>}
      {!youtubeLoading && youtubeError && <div className="home-youtube-fallback" role="status"><div><span>YOUTUBE</span><h3>Najnovšie video momentálne načítavame</h3><p>Všetky verejné videá nájdeš priamo na našom YouTube kanáli.</p></div><a href="https://www.youtube.com/@Vychodbrothers1" target="_blank" rel="noreferrer">Otvoriť YouTube <span aria-hidden="true">↗</span></a></div>}
      {youtubeVideo && <motion.article className="home-latest-card" initial="hidden" whileInView="visible" viewport={{ once: true, amount: .2 }} variants={reveal}>
        <a className="home-latest-image" href={youtubeVideo.youtubeUrl} target="_blank" rel="noreferrer" aria-label={`Pozrieť na YouTube: ${youtubeVideo.title}`}><Thumbnail url={youtubeVideo.thumbnail} eager /><span className="home-latest-play" aria-hidden="true">▶</span><span className="home-youtube-badge">NAJNOVŠIE NA YOUTUBE</span></a>
        <div className="home-latest-copy"><div className="home-video-meta"><span>YOUTUBE</span><time dateTime={youtubeVideo.publishedAt}>{formatDate(youtubeVideo.publishedAt)}</time></div><h3>{youtubeVideo.title}</h3><p>{shortDescription(youtubeVideo.description)}</p><a className="home-video-cta" href={youtubeVideo.youtubeUrl} target="_blank" rel="noreferrer">Pozrieť na YouTube <span aria-hidden="true">↗</span></a></div>
      </motion.article>}
    </section>

    {premiumVideos.length > 0 && <section className="home-premium" aria-labelledby="home-premium-heading"><header className="home-section-heading is-row"><div><span>EXKLUZÍVNE VIDEO PREMIÉRY</span><h2 id="home-premium-heading">Len pre členov</h2></div><a href="/clenstvo">Porovnať členstvá <span aria-hidden="true">→</span></a></header><div className="home-premium-grid">{premiumVideos.map((video) => <PremiumCard video={video} thumbnailUrl={thumbnailUrls.get(video.thumbnail)} hasAccess={canAccessMembership(video.accessLevel, profile, isAdmin)} key={video.id} />)}</div></section>}

    <ContinueWatchingSection />
  </div>
}
