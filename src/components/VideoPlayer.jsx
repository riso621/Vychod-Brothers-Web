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

function PlayerState({ heading, description, accessMessage, accessLevel, image }) {
  return (
    <div className={`video-detail-stage video-player-state access-${accessLevel}`}>
      {image && <img className="video-player-state-image" src={image} alt="" />}
      <div className="video-player-state-copy">
        <span aria-hidden="true">▶</span>
        <strong>{heading}</strong>
        {description && <p>{description}</p>}
        {accessMessage && <small>⌁ {accessMessage}</small>}
      </div>
    </div>
  )
}

export default function VideoPlayer({ youtubeUrl, title, accessLevel, streamVideoId, provider = 'none', poster = '', previewImage = '' }) {
  const youtubeVideoId = provider === 'youtube' && accessLevel === 'public' ? getYoutubeVideoId(youtubeUrl) : null
  const accessMessage = accessLevel === 'vip'
    ? 'Tento obsah je dostupný iba pre VIP členov'
    : 'Tento obsah je určený pre členov'
  const image = previewImage || poster

  if (provider === 'stream') {
    return <div data-stream-video-id={streamVideoId || undefined}><PlayerState heading="Náš vlastný prehrávač bude čoskoro dostupný." description="Pripravujeme čisté a bezpečné prehrávanie priamo na našom webe." accessMessage={accessLevel === 'public' ? '' : accessMessage} accessLevel={accessLevel} image={image} /></div>
  }

  if (provider === 'none') {
    return <PlayerState heading="Video pripravujeme." accessMessage={accessLevel === 'public' ? '' : accessMessage} accessLevel={accessLevel} image={image} />
  }

  if (provider !== 'youtube' || accessLevel !== 'public') {
    return <PlayerState heading={accessLevel === 'vip' ? 'VIP obsah' : 'Pre členov'} accessMessage={accessMessage} accessLevel={accessLevel} image={image} />
  }

  if (!youtubeVideoId) {
    return <PlayerState heading="Video prehrávač pripravujeme" accessLevel={accessLevel} image={image} />
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
