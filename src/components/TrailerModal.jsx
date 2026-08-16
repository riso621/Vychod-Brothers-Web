import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import VideoPlayer from './VideoPlayer'

export default function TrailerModal({ video, membershipHref, onClose }) {
  const [ended, setEnded] = useState(false)
  const closeButtonRef = useRef(null)
  const handleEnded = useCallback(() => setEnded(true), [])

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeButtonRef.current?.focus()
    const handleKeyDown = (event) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  return createPortal(
    <div className="trailer-modal" role="dialog" aria-modal="true" aria-labelledby="trailer-modal-title" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <div className="trailer-modal-panel">
        <header className="trailer-modal-header"><div><span>VEREJNÁ UKÁŽKA · ZDARMA</span><h2 id="trailer-modal-title">{video.title}</h2></div><button ref={closeButtonRef} type="button" onClick={onClose} aria-label="Zavrieť ukážku">×</button></header>
        <div className="trailer-modal-player">
          <VideoPlayer title={`${video.title} – verejná ukážka`} accessLevel="free" streamVideoId={video.trailerStreamVideoId} provider="cloudflare_stream" poster={video.poster} previewImage={video.previewImage} hasAccess trailer autoPlay onEnded={handleEnded} />
          {ended && <div className="trailer-modal-ended" role="status"><span>CHCEŠ VIDIEŤ CELÉ VIDEO?</span><h3>Staň sa členom Východ Brothers Club</h3><p>Všetky členské videá za <strong>5,99 € / mesiac</strong>.</p><a href={membershipHref}>STAŤ SA ČLENOM <i aria-hidden="true">→</i></a></div>}
        </div>
        <footer><span aria-hidden="true">▶</span> Bezplatná ukážka. Celé členské video zostáva chránené.</footer>
      </div>
    </div>,
    document.body,
  )
}
