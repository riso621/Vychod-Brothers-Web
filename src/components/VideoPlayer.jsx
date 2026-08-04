const youtubeIdPattern = /^[a-zA-Z0-9_-]{11}$/

function getYoutubeVideoId(youtubeUrl) {
  if (!youtubeUrl) return null

  try {
    const url = new URL(youtubeUrl)
    const hostname = url.hostname.replace(/^www\./, '')
    let videoId = null

    if (hostname === 'youtu.be') {
      videoId = url.pathname.split('/').filter(Boolean)[0]
    } else if (hostname === 'youtube.com' || hostname === 'm.youtube.com') {
      if (url.pathname === '/watch') videoId = url.searchParams.get('v')
      if (url.pathname.startsWith('/shorts/')) videoId = url.pathname.split('/')[2]
    }

    return youtubeIdPattern.test(videoId ?? '') ? videoId : null
  } catch {
    return null
  }
}

export default function VideoPlayer({ youtubeUrl, title, accessLevel, streamVideoId }) {
  const youtubeVideoId = accessLevel === 'public' ? getYoutubeVideoId(youtubeUrl) : null
  const accessMessage = accessLevel === 'vip'
    ? 'Tento obsah je dostupný iba pre VIP členov'
    : 'Tento obsah je určený pre členov'

  if (accessLevel !== 'public') {
    return (
      <div className={`video-detail-stage video-player-locked access-${accessLevel}`} data-stream-video-id={streamVideoId || undefined}>
        <div className="video-player-lock">
          <span aria-hidden="true">⌁</span>
          <strong>{accessLevel === 'vip' ? 'VIP obsah' : 'Pre členov'}</strong>
          <p>{accessMessage}</p>
        </div>
      </div>
    )
  }

  if (!youtubeVideoId) {
    return (
      <div className="video-detail-stage">
        <div className="video-player-placeholder">
          <span aria-hidden="true">▶</span>
          <strong>Video prehrávač pripravujeme</strong>
        </div>
      </div>
    )
  }

  return (
    <div className="video-detail-stage video-player-youtube">
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${youtubeVideoId}`}
        title={`Prehrať video ${title}`}
        loading="lazy"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        referrerPolicy="strict-origin-when-cross-origin"
        allowFullScreen
      />
    </div>
  )
}
