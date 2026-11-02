import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { getPublishedVideos } from '../lib/videos'
import { getSignedStorageUrls } from '../lib/storage'
import { canAccessMembership, isActiveClubMember } from '../lib/membership'
import { useProfile } from '../context/profile-context'
import { useWatchHistory } from '../context/watch-history-context'
import PublicStreamingLanding from './PublicStreamingLanding'

const fallback = '/images/backgrounds/vb-cinematic-energy-4k.webp'

function resolveImage(video, urls) {
  if (!video?.thumbnail) return fallback
  return /^https?:\/\//i.test(video.thumbnail) ? video.thumbnail : urls.get(video.thumbnail) || fallback
}

function Card({ video, urls, progress, large = false }) {
  return <a className={`stream-card${large ? ' is-large' : ''}`} href={`/videos/${video.slug}`}>
    <img src={resolveImage(video, urls)} alt="" loading={large ? 'eager' : 'lazy'} decoding="async" />
    <div className="stream-card-shade" />
    <span className="stream-card-play">▶</span>
    <div className="stream-card-copy"><span>{video.accessLevel === 'free' ? 'VEREJNÉ' : 'VB CLUB'}</span><strong>{video.title}</strong><small>{video.duration || 'Východ Brothers'}</small></div>
    {progress && <i className="stream-card-progress"><b style={{ width: `${Math.min(100, progress.completed ? 100 : progress.progress_percent || 0)}%` }} /></i>}
  </a>
}

function Rail({ title, eyebrow, videos, urls, getProgress }) {
  if (!videos.length) return null
  return <section className="stream-rail"><header><div><span>{eyebrow}</span><h2>{title}</h2></div><a href="/videos">Zobraziť všetko →</a></header><div className="stream-rail-track">{videos.map((video) => <Card video={video} urls={urls} progress={getProgress(video.id)} key={video.id} />)}</div></section>
}

export default function StreamingHome() {
  const { profile, session, authLoading } = useProfile()
  const { getProgress } = useWatchHistory()
  const [videos, setVideos] = useState([])
  const [urls, setUrls] = useState(new Map())
  const isAdmin = session?.user?.app_metadata?.role === 'admin'
  const isMember = isActiveClubMember(profile, isAdmin)

  useEffect(() => {
    let active = true
    getPublishedVideos().then(async (items) => {
      if (!active) return
      setVideos(items)
      const signed = await getSignedStorageUrls('thumbnails', items.map((item) => item.thumbnail).filter(Boolean)).catch(() => new Map())
      if (active) setUrls(signed)
    }).catch(() => {})
    return () => { active = false }
  }, [])

  const hero = videos.find((video) => video.featured) || videos[0]
  const accessible = useMemo(() => videos.filter((video) => canAccessMembership(video.accessLevel, profile, isAdmin)), [isAdmin, profile, videos])
  const members = videos.filter((video) => video.accessLevel !== 'free')
  const movies = videos.filter((video) => video.contentType === 'movie')
  const series = videos.filter((video) => video.contentType === 'series')
  const continuing = accessible.filter((video) => getProgress(video.id) && !getProgress(video.id)?.completed)

  if (authLoading) return <div className="public-home-loading" aria-live="polite">Načítavam Východ Brothers…</div>
  if (!session) return <PublicStreamingLanding videos={videos} urls={urls} />

  return <div className="stream-home">
    <section className="stream-hero" style={{ '--hero-image': `url("${resolveImage(hero, urls)}")` }}>
      <div className="stream-hero-backdrop" />
      <motion.div className="stream-hero-copy" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .8 }}>
        <span className="stream-kicker">VÝCHOD BROTHERS <b>ORIGINAL</b></span>
        <h1>{hero?.title || 'PRÍBEHY Z VÝCHODU. BEZ FILTRA.'}</h1>
        <div className="stream-hero-meta"><b>Novinka</b><span>16+</span><span>{hero?.duration || 'Filmy · Seriály · Zábava'}</span><em>4K</em></div>
        <p>{hero?.shortDescription || 'Originálne minifilmy, seriály, paródie a zákulisie od Východ Brothers. Jeden svet. Jedno členstvo.'}</p>
        <div className="stream-hero-actions">{hero && <a className="is-primary" href={`/videos/${hero.slug}`}>▶ Prehrať</a>}<a href={hero ? `/videos/${hero.slug}` : '/videos'}>ⓘ Viac informácií</a></div>
      </motion.div>
      <div className="stream-hero-rating">VB ORIGINAL</div>
    </section>

    <div className="stream-library">
      <Rail title="Pokračovať v pozeraní" eyebrow="TVOJ ZOZNAM" videos={continuing} urls={urls} getProgress={getProgress} />
      <Rail title="Teraz populárne" eyebrow="TOP VÝBER" videos={videos.slice(0, 10)} urls={urls} getProgress={getProgress} />
      <section className="stream-club-banner"><div><span>VÝCHOD BROTHERS CLUB</span><h2>Všetko, čo na YouTube neuvidíš.</h2><p>Originálne filmy, exkluzívne série, zákulisie a predpremiéry. Bez reklám.</p></div><div><strong>6,99 € <small>/ mesiac</small></strong><a href={isMember ? '/videos' : '/clenstvo'}>{isMember ? 'Otvoriť katalóg' : 'Stať sa členom'}</a><small>Ročne 59,99 € · zrušíš kedykoľvek.</small></div></section>
      <Rail title="Filmy Východ Brothers" eyebrow="CELÉ PRÍBEHY" videos={movies.slice(0, 10)} urls={urls} getProgress={getProgress} />
      <Rail title="Seriály a epizódy" eyebrow="ĎALŠÍ DIEL ČAKÁ" videos={series.slice(0, 10)} urls={urls} getProgress={getProgress} />
      <Rail title="Iba pre členov" eyebrow="VB CLUB" videos={members.slice(0, 10)} urls={urls} getProgress={getProgress} />
      {!videos.length && <section className="stream-empty"><span>VÝCHOD BROTHERS STREAM</span><h2>Knižnicu práve pripravujeme.</h2><p>Publikovaný obsah sa tu zobrazí automaticky. Medzitým objav náš príbeh a členstvo.</p><a href="/clenstvo">Objaviť členstvo</a></section>}
    </div>
  </div>
}
