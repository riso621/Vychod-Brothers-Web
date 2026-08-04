import { useCallback, useEffect, useRef, useState } from 'react'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { useProfile } from '../context/profile-context'

const accessLabels = { public: 'Verejné', member: 'Pre členov', vip: 'VIP' }
const providerLabels = { youtube: 'YouTube', stream: 'Stream' }

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('sk-SK', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)
}

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

function validateVideo(values) {
  if (!values.title || values.title.length > 160) return 'Názov je povinný a môže mať najviac 160 znakov.'
  if (!values.slug || values.slug.length > 180 || !slugPattern.test(values.slug)) return 'Slug používaj malými písmenami, číslami a pomlčkami.'
  if (!values.description || values.description.length > 5000) return 'Popis je povinný a môže mať najviac 5 000 znakov.'
  if (!values.thumbnail_url) return 'Thumbnail URL je povinná.'
  try {
    const url = new URL(values.thumbnail_url)
    if (!['http:', 'https:'].includes(url.protocol)) return 'Thumbnail musí používať platnú HTTP alebo HTTPS adresu.'
  } catch {
    return 'Zadaj platnú URL adresu thumbnailu.'
  }
  if (!['youtube', 'stream'].includes(values.provider)) return 'Vyber platného poskytovateľa videa.'
  if (!values.provider_video_id || values.provider_video_id.length > 255 || /\s/.test(values.provider_video_id)) return 'Provider video ID je povinné a nesmie obsahovať medzery.'
  if (!['public', 'member', 'vip'].includes(values.access_level)) return 'Vyber platnú úroveň prístupu.'
  return ''
}

function readableInsertError(error) {
  if (error?.code === '23505') return 'Video s týmto slugom už existuje. Zvoľ iný slug.'
  if (error?.code === '42501') return 'Nemáte oprávnenie vytvárať videá.'
  if (error?.code === '23514') return 'Niektorá hodnota nie je povolená databázou.'
  return 'Video sa nepodarilo uložiť. Skontroluj údaje a skús to znova.'
}

function VideoFormModal({ onClose, onCreated }) {
  const titleRef = useRef(null)
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    titleRef.current?.focus()
    const handleKeyDown = (event) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const handleSubmit = async (event) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const values = {
      title: String(formData.get('title') || '').trim(),
      slug: String(formData.get('slug') || '').trim().toLowerCase(),
      description: String(formData.get('description') || '').trim(),
      thumbnail_url: String(formData.get('thumbnail_url') || '').trim(),
      provider: String(formData.get('provider') || ''),
      provider_video_id: String(formData.get('provider_video_id') || '').trim(),
      access_level: String(formData.get('access_level') || ''),
      featured: formData.has('featured'),
      published: formData.has('published'),
    }
    const validationError = validateVideo(values)
    if (validationError) {
      setMessage(validationError)
      return
    }

    setSubmitting(true)
    setMessage('')
    const { error } = await supabase.from('videos').insert(values)
    if (error) {
      setMessage(readableInsertError(error))
      setSubmitting(false)
      return
    }
    await onCreated(values.title)
  }

  return (
    <div className="admin-video-modal" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="admin-video-dialog" role="dialog" aria-modal="true" aria-labelledby="admin-video-form-heading">
        <header><div><span>Nový záznam</span><h2 id="admin-video-form-heading">Pridať video</h2></div><button type="button" onClick={onClose} aria-label="Zavrieť formulár">×</button></header>
        <form className="admin-video-form" onSubmit={handleSubmit} noValidate>
          <label>Názov<input ref={titleRef} name="title" type="text" maxLength="160" required /></label>
          <label>Slug<input name="slug" type="text" maxLength="180" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" placeholder="nazov-videa" required /></label>
          <label className="is-wide">Popis<textarea name="description" rows="4" maxLength="5000" required /></label>
          <label className="is-wide">Thumbnail URL<input name="thumbnail_url" type="url" placeholder="https://…" required /></label>
          <label>Provider<select name="provider" defaultValue="youtube"><option value="youtube">YouTube</option><option value="stream">Stream</option></select></label>
          <label>Provider video ID<input name="provider_video_id" type="text" maxLength="255" required /></label>
          <label>Prístup<select name="access_level" defaultValue="public"><option value="public">Verejné</option><option value="member">Pre členov</option><option value="vip">VIP</option></select></label>
          <fieldset><legend>Stav</legend><label className="admin-check"><input name="featured" type="checkbox" /> Featured</label><label className="admin-check"><input name="published" type="checkbox" /> Publikované</label></fieldset>
          <div className="admin-form-actions is-wide"><p className={message ? 'is-error' : ''} role={message ? 'alert' : undefined} aria-live="polite">{message}</p><button type="button" onClick={onClose} disabled={submitting}>Zrušiť</button><button className="is-primary" type="submit" disabled={submitting}>{submitting ? 'Ukladám…' : 'Uložiť video'}</button></div>
        </form>
      </section>
    </div>
  )
}

export default function AdminVideosDashboard() {
  const { session, authLoading } = useProfile()
  const [videos, setVideos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const isAdmin = session?.user?.app_metadata?.role === 'admin'

  const loadVideos = useCallback(async () => {
    setLoading(true)
    const { data, error: queryError } = await supabase
      .from('videos')
      .select('id, title, thumbnail_url, provider, access_level, published, featured, created_at')
      .order('created_at', { ascending: false })
    setVideos(data || [])
    setError(queryError ? 'Videá sa nepodarilo načítať.' : '')
    setLoading(false)
  }, [])

  useEffect(() => {
    if (authLoading) return undefined
    if (!isAdmin) {
      setLoading(false)
      return undefined
    }
    if (!supabase) {
      setError('Supabase nie je nakonfigurovaný.')
      setLoading(false)
      return undefined
    }

    loadVideos()
    return undefined
  }, [authLoading, isAdmin, loadVideos])

  const handleCreated = async (title) => {
    await loadVideos()
    setModalOpen(false)
    setSuccess(`Video „${title}“ bolo úspešne vytvorené.`)
  }

  if (authLoading) {
    return <section className="admin-videos"><p className="admin-videos-status" aria-live="polite">Overujem oprávnenie…</p></section>
  }

  if (!isAdmin) {
    return <section className="admin-videos"><div className="admin-videos-status is-error" role="alert"><div><strong>Nemáte oprávnenie</strong><p>Táto stránka je dostupná iba administrátorom.</p></div></div></section>
  }

  return (
    <section className="admin-videos" aria-labelledby="admin-videos-heading">
      <header className="admin-videos-heading">
        <div><span>ADMIN / VIDEO KATALÓG</span><h1 id="admin-videos-heading">Videá</h1><p>Prehľad videí dostupných cez aktuálne databázové oprávnenia.</p></div>
        <button type="button" onClick={() => setModalOpen(true)} disabled={!isSupabaseConfigured}><span aria-hidden="true">+</span> Pridať video</button>
      </header>

      <div className="admin-video-list" aria-live="polite" aria-busy={loading}>
        {success && <p className="admin-videos-success" role="status">{success}</p>}
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

      {modalOpen && <VideoFormModal onClose={() => setModalOpen(false)} onCreated={handleCreated} />}
    </section>
  )
}
