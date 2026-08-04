import { useMemo, useState } from 'react'
import { getFeaturedVideo, getPublishedVideos, getVideosByCategory } from '../data/videos'

const accessLabels = {
  public: 'Verejné',
  member: 'Pre členov',
  vip: 'VIP obsah',
}

const categoryLabels = {
  parodia: 'Paródia',
  minifilm: 'Minifilm',
  skec: 'Skeč',
  zakulisie: 'Zákulisie',
  bonus: 'Bonus',
}

function VideoCard({ video, featured = false, onSelect }) {
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
        <button type="button" onClick={() => onSelect(video)}>Pozrieť detail <span aria-hidden="true">→</span></button>
      </div>
    </article>
  )
}

export default function VideosSection() {
  const publishedVideos = getPublishedVideos()
  const featuredVideo = getFeaturedVideo()
  const categories = useMemo(() => [...new Set(publishedVideos.map((video) => video.category))], [publishedVideos])
  const [category, setCategory] = useState('all')
  const [message, setMessage] = useState('')
  const visibleVideos = category === 'all' ? publishedVideos : getVideosByCategory(category)

  const handleSelect = (video) => {
    setMessage(`${video.title}: Prehrávač pripravujeme.`)
  }

  return (
    <section className="videos-catalog" aria-labelledby="videos-heading">
      <header className="videos-catalog-heading">
        <span>VÝCHOD BROTHERS · KATALÓG</span>
        <h1 id="videos-heading">Videá</h1>
        <p>Paródie, minifilmy, skeče aj pohľad do zákulisia na jednom mieste. Katalóg postupne pripravujeme.</p>
      </header>

      {featuredVideo && (
        <div className="videos-featured" aria-label="Odporúčané video">
          <span className="videos-section-label">Odporúčané</span>
          <VideoCard video={featuredVideo} featured onSelect={handleSelect} />
        </div>
      )}

      <div className="videos-toolbar">
        <h2>Všetky videá</h2>
        <div className="videos-filters" aria-label="Filtrovať videá podľa kategórie">
          <button type="button" className={category === 'all' ? 'is-active' : ''} aria-pressed={category === 'all'} onClick={() => setCategory('all')}>Všetky</button>
          {categories.map((item) => <button type="button" className={category === item ? 'is-active' : ''} aria-pressed={category === item} onClick={() => setCategory(item)} key={item}>{categoryLabels[item] ?? item}</button>)}
        </div>
      </div>

      <div className="videos-grid">
        {visibleVideos.map((video) => <VideoCard video={video} onSelect={handleSelect} key={video.id} />)}
      </div>
      <p className="videos-catalog-status" aria-live="polite">{message}</p>
    </section>
  )
}
