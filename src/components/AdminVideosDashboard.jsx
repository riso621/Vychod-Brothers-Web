import { useEffect, useRef, useState } from 'react'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

const accessLabels = { public: 'Verejné', member: 'Pre členov', vip: 'VIP' }
const providerLabels = { youtube: 'YouTube', stream: 'Stream' }

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('sk-SK', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)
}

function VideoFormModal({ onClose }) {
  const titleRef = useRef(null)
  const [message, setMessage] = useState('')

  useEffect(() => {
    titleRef.current?.focus()
    const handleKeyDown = (event) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const handleSubmit = (event) => {
    event.preventDefault()
    setMessage('Ukladanie videí zatiaľ nie je aktívne.')
  }

  return (
    <div className="admin-video-modal" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="admin-video-dialog" role="dialog" aria-modal="true" aria-labelledby="admin-video-form-heading">
        <header><div><span>Nový záznam</span><h2 id="admin-video-form-heading">Pridať video</h2></div><button type="button" onClick={onClose} aria-label="Zavrieť formulár">×</button></header>
        <form className="admin-video-form" onSubmit={handleSubmit}>
          <label>Názov<input ref={titleRef} name="title" type="text" required /></label>
          <label>Slug<input name="slug" type="text" required /></label>
          <label className="is-wide">Popis<textarea name="description" rows="4" /></label>
          <label className="is-wide">Thumbnail URL<input name="thumbnail_url" type="url" /></label>
          <label>Provider<select name="provider" defaultValue="youtube"><option value="youtube">YouTube</option><option value="stream">Stream</option></select></label>
          <label>Provider video ID<input name="provider_video_id" type="text" /></label>
          <label>Prístup<select name="access_level" defaultValue="public"><option value="public">Verejné</option><option value="member">Pre členov</option><option value="vip">VIP</option></select></label>
          <fieldset><legend>Stav</legend><label className="admin-check"><input name="featured" type="checkbox" /> Featured</label><label className="admin-check"><input name="published" type="checkbox" /> Publikované</label></fieldset>
          <div className="admin-form-actions is-wide"><p aria-live="polite">{message}</p><button type="button" onClick={onClose}>Zrušiť</button><button className="is-primary" type="submit">Pripraviť video</button></div>
        </form>
      </section>
    </div>
  )
}

export default function AdminVideosDashboard() {
  const [videos, setVideos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)

  useEffect(() => {
    let active = true
    if (!supabase) {
      setError('Supabase nie je nakonfigurovaný.')
      setLoading(false)
      return undefined
    }

    supabase
      .from('videos')
      .select('id, title, thumbnail_url, provider, access_level, published, featured, created_at')
      .order('created_at', { ascending: false })
      .then(({ data, error: queryError }) => {
        if (!active) return
        setVideos(data || [])
        setError(queryError ? 'Videá sa nepodarilo načítať.' : '')
        setLoading(false)
      })

    return () => { active = false }
  }, [])

  return (
    <section className="admin-videos" aria-labelledby="admin-videos-heading">
      <header className="admin-videos-heading">
        <div><span>ADMIN / VIDEO KATALÓG</span><h1 id="admin-videos-heading">Videá</h1><p>Prehľad videí dostupných cez aktuálne databázové oprávnenia.</p></div>
        <button type="button" onClick={() => setModalOpen(true)} disabled={!isSupabaseConfigured}><span aria-hidden="true">+</span> Pridať video</button>
      </header>

      <div className="admin-video-list" aria-live="polite" aria-busy={loading}>
        {loading && <p className="admin-videos-status">Načítavam videá…</p>}
        {!loading && error && <p className="admin-videos-status is-error" role="alert">{error}</p>}
        {!loading && !error && videos.length === 0 && <p className="admin-videos-status">Zatiaľ tu nie sú žiadne publikované videá.</p>}
        {videos.map((video) => (
          <article className="admin-video-row" key={video.id}>
            <div className="admin-video-thumbnail">{video.thumbnail_url && <img src={video.thumbnail_url} alt="" loading="lazy" onError={(event) => { event.currentTarget.hidden = true }} />}<span aria-hidden="true">VB</span></div>
            <div className="admin-video-title"><span>Názov</span><h2>{video.title}</h2><time dateTime={video.created_at}>{formatDate(video.created_at)}</time></div>
            <dl><div><dt>Provider</dt><dd>{providerLabels[video.provider] || video.provider}</dd></div><div><dt>Prístup</dt><dd className={`access-${video.access_level}`}>{accessLabels[video.access_level] || video.access_level}</dd></div><div><dt>Publikované</dt><dd>{video.published ? 'Áno' : 'Nie'}</dd></div><div><dt>Featured</dt><dd>{video.featured ? 'Áno' : 'Nie'}</dd></div></dl>
          </article>
        ))}
      </div>

      {modalOpen && <VideoFormModal onClose={() => setModalOpen(false)} />}
    </section>
  )
}
