import { useEffect, useMemo, useState } from 'react'
import { getPublishedVideos } from '../lib/videos'

const accessLabels = {
  public: 'Verejné',
  member: 'Pre členov',
  vip: 'VIP obsah',
}

const categoryLabels = {
  youtube: 'YouTube',
  stream: 'Stream',
}

function VideoCard({ video, featured = false }) {
  const locked = video.accessLevel !== 'public'

  return (
    <article className={`catalog-video-card${featured ? ' is-featured' : ''}`}>
      <div className="catalog-video-image">
        <img src={video.thumbnail} alt="" loading={featured ? 'eager' : 'lazy'} onError={(event) => { event.currentTarget.hidden = true }} />
        <span className="catalog-video-duration">{video.duration}</span>
        {locked && <span className={`catalog-video-lock access-${video.accessLevel}`} aria-label={accessLabels[video.accessLevel]}>⌁ {accessLabels[video.accessLevel]}</span>}
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
  const [publishedVideos, setPublishedVideos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const featuredVideo = publishedVideos.find((video) => video.featured) || null
  const categories = useMemo(() => [...new Set(publishedVideos.map((video) => video.category))], [publishedVideos])
  const [category, setCategory] = useState('all')
  const visibleVideos = category === 'all' ? publishedVideos : publishedVideos.filter((video) => video.category === category)

  useEffect(() => {
    let active = true
    getPublishedVideos()
      .then((videos) => { if (active) setPublishedVideos(videos) })
      .catch(() => { if (active) setError('Videá sa nepodarilo načítať. Skús to, prosím, znova.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

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
          <VideoCard video={featuredVideo} featured />
        </div>
      )}

      {!loading && !error && publishedVideos.length > 0 && <><div className="videos-toolbar">
        <h2>Všetky videá</h2>
        <div className="videos-filters" aria-label="Filtrovať videá podľa kategórie">
          <button type="button" className={category === 'all' ? 'is-active' : ''} aria-pressed={category === 'all'} onClick={() => setCategory('all')}>Všetky</button>
          {categories.map((item) => <button type="button" className={category === item ? 'is-active' : ''} aria-pressed={category === item} onClick={() => setCategory(item)} key={item}>{categoryLabels[item] ?? item}</button>)}
        </div>
      </div>

      <div className="videos-grid">
        {visibleVideos.map((video) => <VideoCard video={video} key={video.id} />)}
      </div></>}
    </section>
  )
}
