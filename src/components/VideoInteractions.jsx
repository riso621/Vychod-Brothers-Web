import { useCallback, useEffect, useMemo, useState } from 'react'
import { useProfile } from '../context/profile-context'
import { videoInteractionsRequest } from '../lib/video-interactions'

function relativeTime(value) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000))
  if (seconds < 60) return 'práve teraz'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `pred ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `pred ${hours} h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `pred ${days} d`
  return new Intl.DateTimeFormat('sk-SK', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value))
}

const initials = (name) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'VB'

export default function VideoInteractions({ videoId }) {
  const { session, profile } = useProfile()
  const [data, setData] = useState({ likeCount: 0, liked: false, commentCount: 0, comments: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [text, setText] = useState('')
  const [liking, setLiking] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState('')
  const authorName = profile?.username?.trim() || 'Člen komunity'
  const loginHref = useMemo(() => `/?auth=login&next=${encodeURIComponent(window.location.pathname)}`, [])

  const load = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setLoading(true)
    try {
      const result = await videoInteractionsRequest({ action: 'get', videoId })
      setData(result)
      setError('')
    } catch (loadError) {
      if (!quiet) setError(loadError.message || 'Interakcie sa nepodarilo načítať.')
    } finally {
      if (!quiet) setLoading(false)
    }
  }, [videoId])

  useEffect(() => {
    load()
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') load({ quiet: true }) }, 30_000)
    return () => window.clearInterval(timer)
  }, [load])

  const toggleLike = async () => {
    if (!session) { window.location.href = loginHref; return }
    if (liking) return
    setLiking(true); setError('')
    const previous = data
    setData((current) => ({ ...current, liked: !current.liked, likeCount: Math.max(0, current.likeCount + (current.liked ? -1 : 1)) }))
    try {
      const result = await videoInteractionsRequest({ action: 'toggle-like', videoId })
      setData((current) => ({ ...current, liked: result.liked, likeCount: result.likeCount }))
    } catch (likeError) {
      setData(previous)
      setError(likeError.message || 'Srdiečko sa nepodarilo uložiť.')
    } finally { setLiking(false) }
  }

  const addComment = async (event) => {
    event.preventDefault()
    const value = text.trim()
    if (!value || value.length > 1000 || submitting) return
    setSubmitting(true); setError('')
    try {
      const result = await videoInteractionsRequest({ action: 'add-comment', videoId, text: value })
      setData((current) => ({ ...current, commentCount: current.commentCount + 1, comments: [result.comment, ...current.comments.filter((item) => item.id !== result.comment.id)] }))
      setText('')
    } catch (commentError) {
      setError(commentError.message || 'Komentár sa nepodarilo pridať.')
    } finally { setSubmitting(false) }
  }

  const deleteComment = async (commentId) => {
    if (deletingId) return
    setDeletingId(commentId); setError('')
    try {
      await videoInteractionsRequest({ action: 'delete-comment', videoId, commentId })
      setData((current) => ({ ...current, commentCount: Math.max(0, current.commentCount - 1), comments: current.comments.filter((item) => item.id !== commentId) }))
    } catch (deleteError) {
      setError(deleteError.message || 'Komentár sa nepodarilo odstrániť.')
    } finally { setDeletingId('') }
  }

  return <section className="video-interactions" aria-labelledby="video-comments-heading">
    <div className="video-interactions-like-row">
      <button className={data.liked ? 'video-like is-active' : 'video-like'} type="button" onClick={toggleLike} disabled={liking || loading} aria-pressed={data.liked}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" /></svg>
        <span>{data.liked ? 'Srdiečko pridané' : 'Pridať srdiečko'}</span><strong>{data.likeCount}</strong>
      </button>
    </div>
    <header><span>KOMUNITA</span><h2 id="video-comments-heading">Komentáre · {data.commentCount}</h2></header>
    {session ? <form className="video-comment-form" onSubmit={addComment}>
      <i aria-hidden="true">{initials(authorName)}</i><label><span className="sr-only">Napíšte komentár</span><textarea placeholder="Napíšte komentár..." maxLength="1000" rows="3" value={text} onChange={(event) => setText(event.target.value)} /></label><button type="submit" disabled={submitting || !text.trim()}>{submitting ? 'Pridávam…' : 'Pridať komentár'}</button>
    </form> : <div className="video-comment-login"><p>Ak chceš pridať srdiečko alebo komentár, prihlás sa.</p><a href={loginHref}>PRIHLÁSIŤ SA</a></div>}
    {error && <p className="video-interactions-error" role="alert">{error}</p>}
    {loading ? <div className="video-comments-loading" aria-live="polite">Načítavam komentáre…</div> : data.comments.length === 0 ? <div className="video-comments-empty">Zatiaľ bez komentárov. Začni diskusiu ako prvý.</div> : <div className="video-comments-list">
      {data.comments.map((comment) => <article className="video-comment" key={comment.id}><i aria-hidden="true">{initials(comment.authorName)}</i><div><header><strong>{comment.authorName}</strong><time dateTime={comment.createdAt}>{relativeTime(comment.createdAt)}</time>{comment.isOwn && <button type="button" onClick={() => deleteComment(comment.id)} disabled={deletingId === comment.id}>{deletingId === comment.id ? 'Odstraňujem…' : 'Odstrániť'}</button>}</header><p>{comment.body}</p></div></article>)}
    </div>}
  </section>
}
