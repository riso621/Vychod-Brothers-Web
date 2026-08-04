import { getVideoBySlug } from '../data/videos'
import VideoPlayer from './VideoPlayer'

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

const formatDate = (publishedAt) => new Intl.DateTimeFormat('sk-SK', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
}).format(new Date(publishedAt))

export default function VideoDetail({ slug }) {
  const video = getVideoBySlug(slug)

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

      <VideoPlayer youtubeUrl={video.youtubeUrl} title={video.title} accessLevel={video.accessLevel} streamVideoId={video.streamVideoId} />

      <div className="video-detail-content">
        <div className="video-detail-description">
          <h2>O videu</h2>
          <p>{video.description}</p>
          <div className="video-detail-tags" aria-label="Tagy videa">{video.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div>
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
