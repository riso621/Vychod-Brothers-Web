import { useCallback, useEffect, useRef, useState } from 'react'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { useProfile } from '../context/profile-context'
import { invalidateVideoCache } from '../lib/videos'
import { createStoragePath, uploadThumbnailFile } from '../lib/storage'
import { cleanupCloudflareUpload, createCloudflareUpload, deleteTrailerFromProvider, deleteVideoFromProvider, getCloudflarePlaybackUrl, uploadCloudflareVideo, waitForCloudflareUpload } from '../lib/cloudflare-stream'
import { useSignedStorageUrl } from '../hooks/useSignedStorageUrl'
import { adminRequest } from '../lib/admin-control-center'
import AdminVideoComments from '../admin/AdminVideoComments'

const accessLabels = { free: 'VEREJNÉ', member: 'ČLENSKÉ', vip: 'ČLENSKÉ (legacy)' }
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

function validateVideo(values, { mainAsset, thumbnailAsset, isEditing }) {
  if (!values.title || values.title.length > 160) return 'Názov je povinný a môže mať najviac 160 znakov.'
  if (!values.slug || values.slug.length > 180 || !slugPattern.test(values.slug)) return 'Slug používaj malými písmenami, číslami a pomlčkami.'
  if (!values.description || values.description.length > 5000) return 'Popis je povinný a môže mať najviac 5 000 znakov.'
  if (!['free', 'member', 'vip'].includes(values.access_level)) return 'Vyber platnú úroveň prístupu.'
  if (!isEditing && !mainAsset) return 'Najprv úspešne nahraj MP4 video.'
  if (!isEditing && !thumbnailAsset) return 'Najprv úspešne nahraj thumbnail.'
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

const emptyUpload = () => ({ file: null, status: 'idle', progress: 0, assetId: '', error: '', previewUrl: '' })
const activeUpload = (upload) => upload.status === 'uploading' || upload.status === 'processing'
const uploadLabel = { idle: 'Vybrať súbor', uploading: 'Nahráva sa…', processing: 'Spracúva sa…', uploaded: 'Nahrané ✓', error: 'Chyba pri nahrávaní' }

function validateUploadFile(file, type) {
  if (!file) return 'Súbor nebol vybraný.'
  if (type === 'thumbnail') {
    if (!imageTypes.includes(file.type) || !/\.(jpe?g|png|webp)$/i.test(file.name)) return 'Thumbnail musí byť JPG, JPEG, PNG alebo WEBP.'
    if (file.size > MAX_THUMBNAIL_SIZE) return 'Thumbnail môže mať najviac 10 MB.'
  } else {
    if (file.type !== 'video/mp4' || !file.name.toLowerCase().endsWith('.mp4')) return 'Video musí byť vo formáte MP4.'
    if (file.size > MAX_VIDEO_SIZE) return 'Video môže mať najviac 5 GB.'
  }
  return ''
}

function FileUploadField({ label, accept, upload, existing, onSelect, onRetry, onRemove, optional = false, preview }) {
  const inputRef = useRef(null)
  const complete = upload.status === 'uploaded' || (existing && upload.status === 'idle')
  return (
    <div className={`admin-file-field upload-${upload.status}`}>
      <div className="admin-file-heading"><strong>{label}</strong>{optional && <small>Voliteľné</small>}<span className={complete ? 'is-complete' : ''}>{complete ? 'Nahrané ✓' : uploadLabel[upload.status]}</span></div>
      {preview}
      <input ref={inputRef} className="sr-only" type="file" accept={accept} onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; if (file) onSelect(file) }} />
      {(upload.file || existing) && <span className="admin-file-meta"><strong>{upload.file?.name || existing}</strong>{upload.file && <small>{formatFileSize(upload.file.size)}</small>}</span>}
      {(activeUpload(upload) || upload.status === 'uploaded') && <span className="admin-upload-progress" aria-label={`${label}: ${upload.progress} %`}><i style={{ width: `${upload.progress}%` }} /><small>{upload.status === 'processing' ? 'Cloudflare spracúva video…' : `${upload.progress} %`}</small></span>}
      {upload.error && <p className="admin-upload-error" role="alert">{upload.error}</p>}
      <div className="admin-upload-actions">
        <button type="button" onClick={() => inputRef.current?.click()} disabled={activeUpload(upload)}>{complete ? 'Nahradiť' : 'Vybrať súbor'}</button>
        {upload.status === 'error' && <button type="button" onClick={onRetry}>Skúsiť znova</button>}
        {(upload.file || existing) && <button type="button" onClick={onRemove}>Odstrániť</button>}
      </div>
    </div>
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
  const [uploads, setUploads] = useState({ thumbnail: emptyUpload(), main: emptyUpload(), trailer: emptyUpload() })
  const [removed, setRemoved] = useState({ thumbnail: false, main: false, trailer: false })
  const [published, setPublished] = useState(Boolean(video?.published))
  const [accessLevel, setAccessLevel] = useState(video?.access_level === 'free' ? 'free' : 'member')
  const controllers = useRef({})
  const uploadsRef = useRef(uploads)
  uploadsRef.current = uploads
  const isEditing = Boolean(video)

  const setUpload = useCallback((kind, patch) => setUploads((current) => ({ ...current, [kind]: { ...current[kind], ...patch } })), [])

  const cleanupCandidate = useCallback(async (kind, upload = uploadsRef.current[kind]) => {
    controllers.current[kind]?.abort()
    delete controllers.current[kind]
    if (!upload.assetId) return
    if (kind === 'thumbnail') await supabase.storage.from('thumbnails').remove([upload.assetId])
    else await cleanupCloudflareUpload(upload.assetId)
  }, [])

  const startUpload = useCallback(async (kind, file) => {
    const validation = validateUploadFile(file, kind)
    if (validation) { setUpload(kind, { ...emptyUpload(), file, status: 'error', error: validation }); return }
    const previous = uploadsRef.current[kind]
    if (previous.assetId) await cleanupCandidate(kind, previous).catch(() => undefined)
    if (previous.previewUrl) URL.revokeObjectURL(previous.previewUrl)
    const controller = new AbortController()
    controllers.current[kind] = controller
    const previewUrl = kind === 'thumbnail' ? URL.createObjectURL(file) : ''
    setRemoved((current) => ({ ...current, [kind]: false }))
    setUpload(kind, { file, status: 'uploading', progress: 0, assetId: '', error: '', previewUrl })
    let createdAssetId = ''
    try {
      const userId = (await supabase.auth.getUser()).data.user?.id
      if (!userId) throw new Error('Prihlásenie vypršalo. Prihlás sa znova.')
      if (kind === 'thumbnail') {
        const path = createStoragePath(userId, file)
        createdAssetId = path
        setUpload(kind, { assetId: path })
        await uploadThumbnailFile({ path, file, signal: controller.signal, onProgress: (progress) => setUpload(kind, { progress }) })
        setUpload(kind, { status: 'uploaded', progress: 100 })
      } else {
        const direct = await createCloudflareUpload(file, kind === 'trailer' ? 'free' : accessLevel, kind === 'trailer' ? 'trailer' : 'full')
        createdAssetId = direct.uid
        if (controller.signal.aborted) { await cleanupCloudflareUpload(direct.uid); throw new DOMException('Upload bol zrušený.', 'AbortError') }
        setUpload(kind, { assetId: direct.uid })
        await uploadCloudflareVideo({ uploadUrl: direct.uploadUrl, file, signal: controller.signal, onProgress: (progress) => setUpload(kind, { progress }) })
        setUpload(kind, { status: 'processing', progress: 100 })
        await waitForCloudflareUpload(direct.uid, { signal: controller.signal })
        setUpload(kind, { status: 'uploaded', progress: 100 })
      }
    } catch (error) {
      if (error?.name === 'AbortError' && createdAssetId) {
        if (kind === 'thumbnail') await supabase.storage.from('thumbnails').remove([createdAssetId]).catch(() => undefined)
        else await cleanupCloudflareUpload(createdAssetId).catch(() => undefined)
      } else if (error?.name !== 'AbortError') setUpload(kind, { status: 'error', error: error?.message || 'Upload sa nepodaril.' })
    } finally { delete controllers.current[kind] }
  }, [accessLevel, cleanupCandidate, setUpload])

  const removeUpload = useCallback(async (kind) => {
    const candidate = uploadsRef.current[kind]
    await cleanupCandidate(kind, candidate).catch(() => undefined)
    if (candidate.previewUrl) URL.revokeObjectURL(candidate.previewUrl)
    setUploads((current) => ({ ...current, [kind]: emptyUpload() }))
    const hasExisting = kind === 'thumbnail' ? video?.thumbnail_url : kind === 'main' ? video?.provider_video_id : video?.trailer_provider_video_id
    if (hasExisting) setRemoved((current) => ({ ...current, [kind]: true }))
  }, [cleanupCandidate, video])

  const changeAccessLevel = useCallback(async (nextLevel) => {
    if (uploadsRef.current.main.file) {
      await cleanupCandidate('main').catch(() => undefined)
      setUploads((current) => ({ ...current, main: emptyUpload() }))
      setMessage('Úroveň prístupu sa zmenila. Hlavné video vyberte znova, aby sa správne nastavila ochrana prehrávania.')
    }
    setAccessLevel(nextLevel)
  }, [cleanupCandidate])

  const closeSafely = useCallback(async () => {
    if (Object.values(uploadsRef.current).some(activeUpload) && !window.confirm('Prebieha nahrávanie. Naozaj chcete zavrieť?')) return
    await Promise.all(Object.keys(uploadsRef.current).map((kind) => cleanupCandidate(kind).catch(() => undefined)))
    onClose()
  }, [cleanupCandidate, onClose])

  useEffect(() => {
    titleRef.current?.focus()
    const handleKeyDown = (event) => { if (event.key === 'Escape') closeSafely() }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [closeSafely])

  const handleSubmit = async (event) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const values = {
      title: String(formData.get('title') || '').trim(),
      slug: String(formData.get('slug') || '').trim().toLowerCase(),
      description: String(formData.get('description') || '').trim(),
      access_level: accessLevel,
      featured: formData.has('featured'),
      published: formData.has('published'),
    }
    const mainAsset = uploads.main.status === 'uploaded' ? uploads.main.assetId : (!removed.main ? video?.provider_video_id : null)
    const thumbnailAsset = uploads.thumbnail.status === 'uploaded' ? uploads.thumbnail.assetId : (!removed.thumbnail ? video?.thumbnail_url : null)
    const trailerAsset = uploads.trailer.status === 'uploaded' ? uploads.trailer.assetId : (!removed.trailer ? video?.trailer_provider_video_id : null)
    const validationError = validateVideo(values, { mainAsset, thumbnailAsset, isEditing }) || (values.published && !mainAsset ? 'Publikované video musí mať pripravené hlavné video.' : '')
    if (validationError) {
      setMessage(validationError)
      return
    }

    setSubmitting(true)
    setMessage('')
    try {
      const payload = {
        ...values,
        provider: mainAsset ? 'cloudflare_stream' : video?.provider || 'cloudflare_stream',
        provider_video_id: mainAsset,
        thumbnail_url: thumbnailAsset,
        trailer_provider_video_id: trailerAsset,
      }
      await adminRequest({ action:'save-video', videoId:video?.id || null, video:payload })
      const cleanup = []
      if (isEditing && video.thumbnail_url && video.thumbnail_url !== thumbnailAsset && !/^https?:\/\//i.test(video.thumbnail_url)) cleanup.push(supabase.storage.from('thumbnails').remove([video.thumbnail_url]))
      if (isEditing && video.provider === 'cloudflare_stream' && video.provider_video_id && video.provider_video_id !== mainAsset) cleanup.push(cleanupCloudflareUpload(video.provider_video_id))
      if (isEditing && video.trailer_provider_video_id && video.trailer_provider_video_id !== trailerAsset) cleanup.push(cleanupCloudflareUpload(video.trailer_provider_video_id))
      await Promise.allSettled(cleanup)
      await onSaved(values.title, isEditing)
    } catch (error) {
      setMessage(readableMutationError(error))
      setSubmitting(false)
    }
  }

  const blockingUpload = Object.values(uploads).some((upload) => activeUpload(upload) || upload.status === 'error')
  const hasMain = uploads.main.status === 'uploaded' || (!removed.main && Boolean(video?.provider_video_id))
  const saveDisabled = submitting || blockingUpload || (published && !hasMain)

  return (
    <div className="admin-video-modal" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeSafely() }}>
      <section className="admin-video-dialog" role="dialog" aria-modal="true" aria-labelledby="admin-video-form-heading">
        <header><div><span>{isEditing ? 'Úprava záznamu' : 'Nový záznam'}</span><h2 id="admin-video-form-heading">{isEditing ? 'Upraviť video' : 'Pridať video'}</h2></div><button type="button" onClick={closeSafely} aria-label="Zavrieť formulár">×</button></header>
        <form className="admin-video-form" onSubmit={handleSubmit} noValidate>
          <label>Názov<input ref={titleRef} name="title" type="text" maxLength="160" defaultValue={video?.title || ''} required /></label>
          <label>Slug<input name="slug" type="text" maxLength="180" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" placeholder="nazov-videa" defaultValue={video?.slug || ''} required /></label>
          <label className="is-wide">Popis<textarea name="description" rows="4" maxLength="5000" defaultValue={video?.description || ''} required /></label>
          <FileUploadField label="Thumbnail" accept=".jpg,.jpeg,.png,.webp" upload={uploads.thumbnail} existing={!removed.thumbnail && video?.thumbnail_url ? 'Existujúci thumbnail' : ''} onSelect={(file) => startUpload('thumbnail', file)} onRetry={() => startUpload('thumbnail', uploads.thumbnail.file)} onRemove={() => removeUpload('thumbnail')} optional={isEditing} preview={uploads.thumbnail.previewUrl ? <img className="admin-upload-preview" src={uploads.thumbnail.previewUrl} alt="Náhľad nového thumbnailu" /> : null} />
          <FileUploadField label="Hlavné video MP4" accept="video/mp4,.mp4" upload={uploads.main} existing={!removed.main && video?.provider_video_id ? 'Existujúce hlavné video' : ''} onSelect={(file) => startUpload('main', file)} onRetry={() => startUpload('main', uploads.main.file)} onRemove={() => removeUpload('main')} optional={isEditing} />
          <FileUploadField label="Verejný trailer MP4" accept="video/mp4,.mp4" upload={uploads.trailer} existing={!removed.trailer && video?.trailer_provider_video_id ? 'Existujúci trailer' : ''} onSelect={(file) => startUpload('trailer', file)} onRetry={() => startUpload('trailer', uploads.trailer.file)} onRemove={() => removeUpload('trailer')} optional />
          <label>Prístup<select name="access_level" value={accessLevel} onChange={(event) => changeAccessLevel(event.target.value)}><option value="free">Verejné celé video</option><option value="member">Členské video</option></select></label>
          <fieldset><legend>Stav</legend><label className="admin-check"><input name="featured" type="checkbox" defaultChecked={video?.featured || false} /> Featured</label><label className="admin-check"><input name="published" type="checkbox" checked={published} onChange={(event) => setPublished(event.target.checked)} /> Publikované</label></fieldset>
          <div className="admin-form-actions is-wide"><p className={message ? 'is-error' : ''} role={message ? 'alert' : undefined} aria-live="polite">{message || (blockingUpload ? 'Počkajte na dokončenie nahrávania.' : published && !hasMain ? 'Pred publikovaním nahrajte hlavné video.' : '')}</p><button type="button" onClick={closeSafely} disabled={submitting}>Zrušiť</button><button className="is-primary" type="submit" disabled={saveDisabled}>{submitting ? 'Ukladám…' : isEditing ? 'Uložiť zmeny' : 'Uložiť video'}</button></div>
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
    try {
      await deleteVideoFromProvider(video.id)
    } catch (error) {
      setMessage(error?.message || readableMutationError(error, 'odstrániť'))
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
  const [query, setQuery] = useState('')
  const [accessFilter, setAccessFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [providerFilter, setProviderFilter] = useState('all')
  const [sortOrder, setSortOrder] = useState('newest')
  const [interactionStats, setInteractionStats] = useState({})
  const [selectedVideoId, setSelectedVideoId] = useState(() => window.location.pathname.match(/^\/admin\/videos\/([0-9a-f-]{36})\/comments$/i)?.[1] || '')
  const isAdmin = session?.user?.app_metadata?.role === 'admin'
  const visibleVideos = videos.filter((video) => {
    const matchesQuery = `${video.title} ${video.slug}`.toLowerCase().includes(query.toLowerCase())
    const matchesAccess = accessFilter === 'all' || video.access_level === accessFilter
    const matchesStatus = statusFilter === 'all' || (statusFilter === 'published' ? video.published : !video.published)
    const matchesProvider = providerFilter === 'all' || video.provider === providerFilter
    return matchesQuery && matchesAccess && matchesStatus && matchesProvider
  }).sort((a,b) => sortOrder === 'oldest' ? new Date(a.created_at) - new Date(b.created_at) : new Date(b.created_at) - new Date(a.created_at))

  const loadVideos = useCallback(async () => {
    setLoading(true)
    const [{ data, error: queryError },statsResult] = await Promise.all([supabase
      .from('videos')
      .select('id, title, slug, description, thumbnail_url, provider, provider_video_id, trailer_provider_video_id, access_level, published, featured, created_at')
      .order('created_at', { ascending: false }),adminRequest({action:'video-interaction-stats'}).catch(()=>({stats:[]}))])
    setVideos(data || [])
    setInteractionStats(Object.fromEntries((statsResult.stats||[]).map((item)=>[item.video_id,{likes:Number(item.like_count||0),comments:Number(item.comment_count||0)}])))
    setError(queryError ? 'Videá sa nepodarilo načítať.' : '')
    setLoading(false)
  }, [])

  useEffect(()=>{const sync=()=>setSelectedVideoId(window.location.pathname.match(/^\/admin\/videos\/([0-9a-f-]{36})\/comments$/i)?.[1]||'');window.addEventListener('popstate',sync);return()=>window.removeEventListener('popstate',sync)},[])

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
  const toggle = async (video, field) => {
    try { await adminRequest({ action:'video-toggle', videoId:video.id, field, value:!video[field] }); await loadVideos(); setSuccess(`Video „${video.title}“ bolo aktualizované.`) }
    catch (error) { setError(error.message) }
  }
  const previewTrailer = async (video) => {
    try {
      const url = await getCloudflarePlaybackUrl(video.trailer_provider_video_id, true)
      if (!url) throw new Error('Trailer momentálne nie je dostupný.')
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (previewError) { setError(previewError.message || 'Trailer momentálne nie je dostupný.') }
  }
  const removeTrailer = async (video) => {
    if (!window.confirm(`Odstrániť trailer videa „${video.title}“? Hlavné video zostane zachované.`)) return
    try { await deleteTrailerFromProvider(video.id); await loadVideos(); setSuccess(`Trailer videa „${video.title}“ bol odstránený.`) }
    catch (trailerError) { setError(trailerError.message || 'Trailer sa nepodarilo odstrániť.') }
  }

  if (authLoading) {
    return <section className="admin-videos"><p className="admin-videos-status" aria-live="polite">Overujem oprávnenie…</p></section>
  }

  if (!isAdmin) {
    return <section className="admin-videos"><div className="admin-videos-status is-error" role="alert"><div><strong>Nemáte oprávnenie</strong><p>Táto stránka je dostupná iba administrátorom.</p></div></div></section>
  }

  const selectedVideo=videos.find((video)=>video.id===selectedVideoId)
  if(selectedVideo)return <AdminVideoComments video={selectedVideo} onBack={()=>{window.history.pushState({},'', '/admin/videos');window.dispatchEvent(new PopStateEvent('popstate'));setSelectedVideoId('')}} onChanged={async()=>{const result=await adminRequest({action:'video-interaction-stats'});setInteractionStats(Object.fromEntries((result.stats||[]).map((item)=>[item.video_id,{likes:Number(item.like_count||0),comments:Number(item.comment_count||0)}])))}}/>

  return (
    <section className="admin-videos" aria-labelledby="admin-videos-heading">
      <header className="admin-videos-heading">
        <div><span>ADMIN / VIDEO KATALÓG</span><h1 id="admin-videos-heading">Videá</h1><p>Správa videí, publikovania, prístupu a providerov.</p></div>
        <div className="admin-heading-actions"><button type="button" onClick={() => { setEditingVideo(null); setModalOpen(true); setSuccess('') }} disabled={!isSupabaseConfigured}><span aria-hidden="true">+</span> Pridať video</button></div>
      </header>

      <div className="admin-toolbar admin-video-toolbar">
        <input type="search" placeholder="Hľadať video alebo slug" value={query} onChange={(event) => setQuery(event.target.value)} />
        <select value={accessFilter} onChange={(event) => setAccessFilter(event.target.value)} aria-label="Filtrovať prístup"><option value="all">Všetky prístupy</option><option value="free">Verejné</option><option value="member">Členské</option><option value="vip">Členské (legacy)</option></select>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filtrovať stav"><option value="all">Všetky stavy</option><option value="published">Publikované</option><option value="draft">Koncepty</option></select>
        <select value={providerFilter} onChange={(event) => setProviderFilter(event.target.value)} aria-label="Filtrovať provider"><option value="all">Všetci provideri</option><option value="youtube">YouTube</option><option value="cloudflare_stream">Cloudflare</option><option value="stream">Legacy</option></select>
        <select value={sortOrder} onChange={(event) => setSortOrder(event.target.value)} aria-label="Zoradiť"><option value="newest">Najnovšie</option><option value="oldest">Najstaršie</option></select>
      </div>

      <div className="admin-video-list" aria-live="polite" aria-busy={loading}>
        {success && <p className="admin-videos-success" role="status">{success}</p>}
        {loading && <p className="admin-videos-status">Načítavam videá…</p>}
        {!loading && error && <p className="admin-videos-status is-error" role="alert">{error}</p>}
        {!loading && !error && videos.length === 0 && <p className="admin-videos-status">Zatiaľ tu nie sú žiadne publikované videá.</p>}
        {visibleVideos.map((video) => (
          <article className="admin-video-row" key={video.id}>
            <div className="admin-video-thumbnail"><StorageImage path={video.thumbnail_url} /><span aria-hidden="true">VB</span></div>
            <div className="admin-video-title"><span>Názov</span><h2>{video.title}</h2><time dateTime={video.created_at}>{formatDate(video.created_at)}</time><div className="admin-video-actions"><a href={`/videos/${video.slug}`} target="_blank" rel="noreferrer">Náhľad videa</a>{video.trailer_provider_video_id && <><button type="button" onClick={() => previewTrailer(video)}>Prehrať trailer</button><button type="button" onClick={() => removeTrailer(video)}>Odstrániť trailer</button></>}<button type="button" onClick={() => {window.history.pushState({},'',`/admin/videos/${video.id}/comments`);window.dispatchEvent(new PopStateEvent('popstate'));setSelectedVideoId(video.id)}}>Komentáre</button><button type="button" onClick={() => toggle(video,'published')}>{video.published?'Skryť':'Publikovať'}</button><button type="button" onClick={() => toggle(video,'featured')}>{video.featured?'Zrušiť featured':'Featured'}</button><button type="button" onClick={() => { setEditingVideo(video); setModalOpen(true); setSuccess('') }}>Upraviť</button><button className="is-danger" type="button" onClick={() => { setDeletingVideo(video); setSuccess('') }}>Odstrániť</button></div></div>
            <dl><div><dt>Provider</dt><dd>{providerLabels[video.provider] || video.provider}</dd></div><div><dt>Prístup</dt><dd className={`access-${video.access_level}`}>{accessLabels[video.access_level] || video.access_level}</dd></div><div><dt>Trailer</dt><dd>{video.trailer_provider_video_id ? 'Nahraný' : 'Chýba'}</dd></div><div><dt>Publikované</dt><dd>{video.published ? 'Áno' : 'Nie'}</dd></div><div><dt>Featured</dt><dd>{video.featured ? 'Áno' : 'Nie'}</dd></div><div><dt>❤️ Srdiečka</dt><dd>{interactionStats[video.id]?.likes??0}</dd></div><div><dt>💬 Komentáre</dt><dd>{interactionStats[video.id]?.comments??0}</dd></div></dl>
          </article>
        ))}
      </div>

      {modalOpen && <VideoFormModal video={editingVideo} onClose={() => { setModalOpen(false); setEditingVideo(null) }} onSaved={handleSaved} />}
      {deletingVideo && <DeleteVideoModal video={deletingVideo} onClose={() => setDeletingVideo(null)} onDeleted={handleDeleted} />}
    </section>
  )
}
