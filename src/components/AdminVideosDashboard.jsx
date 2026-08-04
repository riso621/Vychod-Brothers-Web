import { useCallback, useEffect, useRef, useState } from 'react'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { useProfile } from '../context/profile-context'
import { invalidateVideoCache } from '../lib/videos'

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

function readableMutationError(error, action = 'uložiť') {
  if (error?.code === '23505') return 'Video s týmto slugom už existuje. Zvoľ iný slug.'
  if (error?.code === '42501') return 'Nemáte oprávnenie meniť videá.'
  if (error?.code === '23514') return 'Niektorá hodnota nie je povolená databázou.'
  return `Video sa nepodarilo ${action}. Skontroluj údaje a skús to znova.`
}

function VideoFormModal({ video, onClose, onSaved }) {
  const titleRef = useRef(null)
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const isEditing = Boolean(video)

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
    const query = isEditing
      ? supabase.from('videos').update(values).eq('id', video.id)
      : supabase.from('videos').insert(values)
    const { error } = await query
    if (error) {
      setMessage(readableMutationError(error))
      setSubmitting(false)
      return
    }
    await onSaved(values.title, isEditing)
  }

  return (
    <div className="admin-video-modal" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="admin-video-dialog" role="dialog" aria-modal="true" aria-labelledby="admin-video-form-heading">
        <header><div><span>{isEditing ? 'Úprava záznamu' : 'Nový záznam'}</span><h2 id="admin-video-form-heading">{isEditing ? 'Upraviť video' : 'Pridať video'}</h2></div><button type="button" onClick={onClose} aria-label="Zavrieť formulár">×</button></header>
        <form className="admin-video-form" onSubmit={handleSubmit} noValidate>
          <label>Názov<input ref={titleRef} name="title" type="text" maxLength="160" defaultValue={video?.title || ''} required /></label>
          <label>Slug<input name="slug" type="text" maxLength="180" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" placeholder="nazov-videa" defaultValue={video?.slug || ''} required /></label>
          <label className="is-wide">Popis<textarea name="description" rows="4" maxLength="5000" defaultValue={video?.description || ''} required /></label>
          <label className="is-wide">Thumbnail URL<input name="thumbnail_url" type="url" placeholder="https://…" defaultValue={video?.thumbnail_url || ''} required /></label>
          <label>Provider<select name="provider" defaultValue={video?.provider || 'youtube'}><option value="youtube">YouTube</option><option value="stream">Stream</option></select></label>
          <label>Provider video ID<input name="provider_video_id" type="text" maxLength="255" defaultValue={video?.provider_video_id || ''} required /></label>
          <label>Prístup<select name="access_level" defaultValue={video?.access_level || 'public'}><option value="public">Verejné</option><option value="member">Pre členov</option><option value="vip">VIP</option></select></label>
          <fieldset><legend>Stav</legend><label className="admin-check"><input name="featured" type="checkbox" defaultChecked={video?.featured || false} /> Featured</label><label className="admin-check"><input name="published" type="checkbox" defaultChecked={video?.published || false} /> Publikované</label></fieldset>
          <div className="admin-form-actions is-wide"><p className={message ? 'is-error' : ''} role={message ? 'alert' : undefined} aria-live="polite">{message}</p><button type="button" onClick={onClose} disabled={submitting}>Zrušiť</button><button className="is-primary" type="submit" disabled={submitting}>{submitting ? 'Ukladám…' : isEditing ? 'Uložiť zmeny' : 'Uložiť video'}</button></div>
        </form>
      </section>
    </div>
  )
}

function DeleteVideoModal({ video, onClose, onDeleted }) {
  const [deleting, setDeleting] = useState(false)
  const [message, setMessage] = useState('')

  const handleDelete = async () => {
    setDeleting(true)
    const { error } = await supabase.from('videos').delete().eq('id', video.id)
    if (error) {
      setMessage(readableMutationError(error, 'odstrániť'))
      setDeleting(false)
      return
    }
    await onDeleted(video.title)
  }

  return (
    <div className="admin-video-modal" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !deleting) onClose() }}>
      <section className="admin-video-dialog admin-delete-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-video-heading" aria-describedby="delete-video-description">
        <span>Trvalé odstránenie</span>
        <h2 id="delete-video-heading">Naozaj chcete odstrániť toto video?</h2>
        <p id="delete-video-description">Video „{video.title}“ bude natrvalo odstránené z katalógu.</p>
        {message && <p className="admin-delete-error" role="alert">{message}</p>}
        <div className="admin-form-actions"><button type="button" onClick={onClose} disabled={deleting}>Zrušiť</button><button className="is-danger" type="button" onClick={handleDelete} disabled={deleting}>{deleting ? 'Odstraňujem…' : 'Odstrániť video'}</button></div>
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
  const [editingVideo, setEditingVideo] = useState(null)
  const [deletingVideo, setDeletingVideo] = useState(null)
  const isAdmin = session?.user?.app_metadata?.role === 'admin'

  const loadVideos = useCallback(async () => {
    setLoading(true)
    const { data, error: queryError } = await supabase
      .from('videos')
      .select('id, title, slug, description, thumbnail_url, provider, provider_video_id, access_level, published, featured, created_at')
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

  const handleSaved = async (title, wasEditing) => {
    invalidateVideoCache()
    await loadVideos()
    setModalOpen(false)
    setEditingVideo(null)
    setSuccess(`Video „${title}“ bolo úspešne ${wasEditing ? 'upravené' : 'vytvorené'}.`)
  }

  const handleDeleted = async (title) => {
    invalidateVideoCache()
    await loadVideos()
    setDeletingVideo(null)
    setSuccess(`Video „${title}“ bolo odstránené.`)
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
        <button type="button" onClick={() => { setEditingVideo(null); setModalOpen(true); setSuccess('') }} disabled={!isSupabaseConfigured}><span aria-hidden="true">+</span> Pridať video</button>
      </header>

      <div className="admin-video-list" aria-live="polite" aria-busy={loading}>
        {success && <p className="admin-videos-success" role="status">{success}</p>}
        {loading && <p className="admin-videos-status">Načítavam videá…</p>}
        {!loading && error && <p className="admin-videos-status is-error" role="alert">{error}</p>}
        {!loading && !error && videos.length === 0 && <p className="admin-videos-status">Zatiaľ tu nie sú žiadne publikované videá.</p>}
        {videos.map((video) => (
          <article className="admin-video-row" key={video.id}>
            <div className="admin-video-thumbnail">{video.thumbnail_url && <img src={video.thumbnail_url} alt="" loading="lazy" onError={(event) => { event.currentTarget.hidden = true }} />}<span aria-hidden="true">VB</span></div>
            <div className="admin-video-title"><span>Názov</span><h2>{video.title}</h2><time dateTime={video.created_at}>{formatDate(video.created_at)}</time><div className="admin-video-actions"><button type="button" onClick={() => { setEditingVideo(video); setModalOpen(true); setSuccess('') }}>Upraviť</button><button className="is-danger" type="button" onClick={() => { setDeletingVideo(video); setSuccess('') }}>Odstrániť</button></div></div>
            <dl><div><dt>Provider</dt><dd>{providerLabels[video.provider] || video.provider}</dd></div><div><dt>Prístup</dt><dd className={`access-${video.access_level}`}>{accessLabels[video.access_level] || video.access_level}</dd></div><div><dt>Publikované</dt><dd>{video.published ? 'Áno' : 'Nie'}</dd></div><div><dt>Featured</dt><dd>{video.featured ? 'Áno' : 'Nie'}</dd></div></dl>
          </article>
        ))}
      </div>

      {modalOpen && <VideoFormModal video={editingVideo} onClose={() => { setModalOpen(false); setEditingVideo(null) }} onSaved={handleSaved} />}
      {deletingVideo && <DeleteVideoModal video={deletingVideo} onClose={() => setDeletingVideo(null)} onDeleted={handleDeleted} />}
    </section>
  )
}
