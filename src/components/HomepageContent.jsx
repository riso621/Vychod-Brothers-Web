import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import ContinueWatchingSection from './ContinueWatchingSection'
import { getPublishedVideos } from '../lib/videos'
import { getSignedStorageUrls } from '../lib/storage'
import { useWatchHistory } from '../context/watch-history-context'

const accessLabels = { free: 'Verejné', member: 'Pre členov', vip: 'VIP obsah' }
const reveal = { hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0, transition: { duration: .7, ease: [.2, .7, .2, 1] } } }

function Thumbnail({ url, eager = false }) {
  if (!url) return <span className="home-video-placeholder" aria-hidden="true">VB</span>
  return <img src={url} alt="" loading={eager ? 'eager' : 'lazy'} decoding="async" onError={(event) => { event.currentTarget.hidden = true }} />
}

function Progress({ progress }) {
  if (!progress) return null
  const value = progress.completed ? 100 : Math.min(100, progress.progress_percent || 0)
  return <div className="home-video-progress" aria-label={progress.completed ? 'Dopozerané' : `Pozreté na ${Math.round(value)} percent`}><i style={{ width: `${value}%` }} />{progress.completed && <span>Dopozerané</span>}</div>
}

export default function HomepageContent() {
  const { getProgress, isEnabled } = useWatchHistory()
  const [videos, setVideos] = useState([])
  const [thumbnailUrls, setThumbnailUrls] = useState(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    getPublishedVideos().then((items) => { if (active) setVideos(items) }).catch(() => { if (active) setError('Videá sa momentálne nepodarilo načítať.') }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  useEffect(() => {
    let active = true
    let timer
    const paths = videos.map((video) => video.thumbnail).filter(Boolean)
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
  }, [videos])

  const latest = videos[0]
  const recent = videos.slice(1, 5)

  return <div className="homepage-content" id="videa">
    <section className="home-latest" aria-labelledby="home-latest-heading">
      <header className="home-section-heading"><span>ČERSTVO Z KAMERY</span><h2 id="home-latest-heading">Najnovšie video</h2></header>
      {loading && <p className="home-video-status" aria-live="polite">Načítavam najnovšie video…</p>}
      {!loading && error && <p className="home-video-status is-error" role="alert">{error}</p>}
      {!loading && !error && !latest && <p className="home-video-status">Nové video práve pripravujeme.</p>}
      {latest && <motion.article className="home-latest-card" initial="hidden" whileInView="visible" viewport={{ once: true, amount: .2 }} variants={reveal}>
        <a className="home-latest-image" href={`/videos/${latest.slug}`} aria-label={`Pozrieť video ${latest.title}`}><Thumbnail url={thumbnailUrls.get(latest.thumbnail)} eager /><span className="home-latest-play" aria-hidden="true">▶</span><Progress progress={isEnabled ? getProgress(latest.id) : null} /></a>
        <div className="home-latest-copy"><div className="home-video-meta"><span>{latest.category}</span><span className={`access-${latest.accessLevel}`}>{accessLabels[latest.accessLevel]}</span></div><h3>{latest.title}</h3><p>{latest.shortDescription}</p><a className="home-video-cta" href={`/videos/${latest.slug}`}>Pozrieť <span aria-hidden="true">→</span></a></div>
      </motion.article>}
    </section>

    <ContinueWatchingSection />

    {recent.length > 0 && <section className="home-recent" aria-labelledby="home-recent-heading"><header className="home-section-heading is-row"><div><span>NAJNOVŠIE Z KATALÓGU</span><h2 id="home-recent-heading">Najnovšie videá</h2></div><a href="/videos">Všetky videá <span aria-hidden="true">→</span></a></header><div className="home-video-grid">{recent.map((video, index) => <motion.article className="home-video-card" initial="hidden" whileInView="visible" viewport={{ once: true, amount: .16 }} variants={reveal} transition={{ delay: index * .06 }} key={video.id}><a className="home-video-image" href={`/videos/${video.slug}`}><Thumbnail url={thumbnailUrls.get(video.thumbnail)} /><span className={`home-video-access access-${video.accessLevel}`}>{accessLabels[video.accessLevel]}</span><Progress progress={isEnabled ? getProgress(video.id) : null} /></a><div><span>{video.category}</span><h3>{video.title}</h3><p>{video.shortDescription}</p><a href={`/videos/${video.slug}`}>Pozrieť <b aria-hidden="true">→</b></a></div></motion.article>)}</div></section>}

    <motion.section className="home-vip-banner" initial="hidden" whileInView="visible" viewport={{ once: true, amount: .3 }} variants={reveal} aria-labelledby="home-vip-heading"><div><span>VÝCHOD BROTHERS KLUB</span><h2 id="home-vip-heading">Viac príbehov. Bližšie k nám.</h2></div><ul><li>Bonusové videá</li><li>Zákulisie</li><li>Skorší prístup</li></ul><a href="/clenstvo">Stať sa členom <span aria-hidden="true">→</span></a></motion.section>
  </div>
}
