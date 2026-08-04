import { useCallback, useEffect, useRef, useState } from 'react'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { useProfile } from '../context/profile-context'
import { invalidateVideoCache } from '../lib/videos'
import { createStoragePath, uploadThumbnailFile } from '../lib/storage'
import { createCloudflareUpload, uploadCloudflareVideo } from '../lib/cloudflare-stream'
import { useSignedStorageUrl } from '../hooks/useSignedStorageUrl'

const accessLabels = { public: 'Verejné', member: 'Pre členov', vip: 'VIP' }
const providerLabels = { youtube: 'YouTube', stream: 'Legacy Stream', cloudflare_stream: 'Cloudflare Stream' }
const MAX_VIDEO_SIZE = 5 * 1024 * 1024 * 1024
const MAX_THUMBNAIL_SIZE = 10 * 1024 * 1024
const imageTypes = ['image/jpeg', 'image/png', 'image/webp']

function formatFileSize(bytes) {
  if (!Number.isFinite(bytes)) return ''
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  return `${Math.ceil(bytes / 1024)} KB`
}

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('sk-SK', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)
}

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

function validateVideo(values, { videoFile, thumbnailFile, isEditing }) {
  if (!values.title || values.title.length > 160) return 'Názov je povinný a môže mať najviac 160 znakov.'
  if (!values.slug || values.slug.length > 180 || !slugPattern.test(values.slug)) return 'Slug používaj malými písmenami, číslami a pomlčkami.'
  if (!values.description || values.description.length > 5000) return 'Popis je povinný a môže mať najviac 5 000 znakov.'
  if (!['public', 'member', 'vip'].includes(values.access_level)) return 'Vyber platnú úroveň prístupu.'
  if (!isEditing && !videoFile) return 'Vyber MP4 video súbor.'
  if (!isEditing && !thumbnailFile) return 'Vyber thumbnail obrázok.'
  if (videoFile && (videoFile.type !== 'video/mp4' || !videoFile.name.toLowerCase().endsWith('.mp4'))) return 'Video musí byť vo formáte MP4.'
  if (videoFile?.size > MAX_VIDEO_SIZE) return 'Video môže mať najviac 5 GB.'
  if (thumbnailFile && (!imageTypes.includes(thumbnailFile.type) || !/\.(jpe?g|png|webp)$/i.test(thumbnailFile.name))) return 'Thumbnail musí byť JPG, JPEG, PNG alebo WEBP.'
  if (thumbnailFile?.size > MAX_THUMBNAIL_SIZE) return 'Thumbnail môže mať najviac 10 MB.'
  return ''
}

function readableMutationError(error, action = 'uložiť') {
  if (error?.code === '23505') return 'Video s týmto slugom už existuje. Zvoľ iný slug.'
  if (error?.code === '42501') return 'Nemáte oprávnenie meniť videá.'
  if (error?.code === '23514') return 'Niektorá hodnota nie je povolená databázou.'
  if (/unauthorized|forbidden|row-level security|permission/i.test(error?.message || '')) return 'Nemáte oprávnenie nahrať alebo zmeniť toto video.'
  if (/size|too large|maximum/i.test(error?.message || '')) return 'Súbor prekračuje povolenú veľkosť.'
  return `Video sa nepodarilo ${action}. Skontroluj údaje a skús to znova.`
}

function FileUploadField({ label, accept, file, progress, onChange, optional = false }) {
  return (
    <label className="admin-file-field">
      {label}{optional && <small>Voliteľné pri úprave</small>}
      <input type="file" accept={accept} onChange={(event) => onChange(event.target.files?.[0] || null)} />
      {file && <span className="admin-file-meta"><strong>{file.name}</strong><small>{formatFileSize(file.size)}</small></span>}
      {file && <span className="admin-upload-progress" aria-label={`${label}: ${progress} %`}><i style={{ width: `${progress}%` }} /><small>{progress === 100 ? 'Úspešne nahrané' : `${progress} %`}</small></span>}
    </label>
  )
}

function StorageImage({ path }) {
  const { url } = useSignedStorageUrl('thumbnails', path, Boolean(path))
  return url ? <img src={url} alt="" loading="lazy" onError={(event) => { event.currentTarget.hidden = true }} /> : null
}

function VideoFormModal({ video, onClose, onSaved }) {
  const titleRef = useRef(null)
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [videoFile, setVideoFile] = useState(null)
  const [thumbnailFile, setThumbnailFile] = useState(null)
  const [videoProgress, setVideoProgress] = useState(0)
  const [thumbnailProgress, setThumbnailProgress] = useState(0)
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
      access_level: String(formData.get('access_level') || ''),
      featured: formData.has('featured'),
      published: formData.has('published'),
    }
    const validationError = validateVideo(values, { videoFile, thumbnailFile, isEditing })
    if (validationError) {
      setMessage(validationError)
      return
    }

    setSubmitting(true)
    setMessage('')
    const userId = (await supabase.auth.getUser()).data.user?.id
    if (!userId) {
      setMessage('Prihlásenie vypršalo. Prihlás sa znova.')
      setSubmitting(false)
      return
    }

    let uploadedThumbnail = null
    let cloudflareVideoUid = null
    try {
      if (thumbnailFile) {
        uploadedThumbnail = createStoragePath(userId, thumbnailFile)
        await uploadThumbnailFile({ path: uploadedThumbnail, file: thumbnailFile, onProgress: setThumbnailProgress })
      }
      if (videoFile) {
        const directUpload = await createCloudflareUpload(videoFile)
        cloudflareVideoUid = directUpload.uid
        await uploadCloudflareVideo({ uploadUrl: directUpload.uploadUrl, file: videoFile, onProgress: setVideoProgress })
      }

      const payload = {
        ...values,
        provider: cloudflareVideoUid ? 'cloudflare_stream' : video?.provider || 'cloudflare_stream',
        provider_video_id: cloudflareVideoUid || video?.provider_video_id,
        thumbnail_url: uploadedThumbnail || video?.thumbnail_url,
      }
      const query = isEditing
        ? supabase.from('videos').update(payload).eq('id', video.id)
        : supabase.from('videos').insert(payload)
      const { error } = await query
      if (error) throw error

      if (isEditing && uploadedThumbnail && video.thumbnail_url && !/^https?:\/\//i.test(video.thumbnail_url)) await supabase.storage.from('thumbnails').remove([video.thumbnail_url])
      await onSaved(values.title, isEditing)
    } catch (error) {
      if (uploadedThumbnail) await supabase.storage.from('thumbnails').remove([uploadedThumbnail])
      setMessage(readableMutationError(error))
      setSubmitting(false)
    }
  }

  return (
    <div className="admin-video-modal" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="admin-video-dialog" role="dialog" aria-modal="true" aria-labelledby="admin-video-form-heading">
        <header><div><span>{isEditing ? 'Úprava záznamu' : 'Nový záznam'}</span><h2 id="admin-video-form-heading">{isEditing ? 'Upraviť video' : 'Pridať video'}</h2></div><button type="button" onClick={onClose} aria-label="Zavrieť formulár">×</button></header>
        <form className="admin-video-form" onSubmit={handleSubmit} noValidate>
          <label>Názov<input ref={titleRef} name="title" type="text" maxLength="160" defaultValue={video?.title || ''} required /></label>
          <label>Slug<input name="slug" type="text" maxLength="180" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" placeholder="nazov-videa" defaultValue={video?.slug || ''} required /></label>
          <label className="is-wide">Popis<textarea name="description" rows="4" maxLength="5000" defaultValue={video?.description || ''} required /></label>
          <FileUploadField label="Thumbnail" accept=".jpg,.jpeg,.png,.webp" file={thumbnailFile} progress={thumbnailProgress} onChange={setThumbnailFile} optional={isEditing} />
          <FileUploadField label="Video MP4" accept="video/mp4,.mp4" file={videoFile} progress={videoProgress} onChange={setVideoFile} optional={isEditing} />
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
    if (video.thumbnail_url && !/^https?:\/\//i.test(video.thumbnail_url)) await supabase.storage.from('thumbnails').remove([video.thumbnail_url])
    if (video.provider === 'stream' && video.provider_video_id) await supabase.storage.from('videos').remove([video.provider_video_id])
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
    setSuccess(wasEditing ? `Video „${title}“ bolo úspešne upravené.` : 'Video bolo úspešne nahrané.')
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
            <div className="admin-video-thumbnail"><StorageImage path={video.thumbnail_url} /><span aria-hidden="true">VB</span></div>
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
