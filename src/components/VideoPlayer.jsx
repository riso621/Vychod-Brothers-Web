import { useSignedStorageUrl } from '../hooks/useSignedStorageUrl'
import { useCloudflarePlaybackUrl } from '../hooks/useCloudflarePlaybackUrl'

const youtubeIdPattern = /^[a-zA-Z0-9_-]{11}$/

function getYoutubeVideoId(youtubeUrl) {
  if (!youtubeUrl) return null
  try {
    const url = new URL(youtubeUrl)
    const hostname = url.hostname.replace(/^www\./, '')
    let videoId = null
    if (hostname === 'youtu.be') videoId = url.pathname.split('/').filter(Boolean)[0]
    else if (hostname === 'youtube.com' || hostname === 'm.youtube.com') {
      if (url.pathname === '/watch') videoId = url.searchParams.get('v')
      if (url.pathname.startsWith('/shorts/')) videoId = url.pathname.split('/')[2]
    }
    return youtubeIdPattern.test(videoId ?? '') ? videoId : null
  } catch {
    return null
  }
}

function PlayerState({ heading, description, accessMessage, accessLevel, image, locked = false }) {
  return (
    <div className={`video-detail-stage video-player-state access-${accessLevel}`}>
      {image && <img className="video-player-state-image" src={image} alt="" />}
      <div className="video-player-state-copy">
        <span aria-hidden="true">▶</span>
        <strong>{heading}</strong>
        {description && <p>{description}</p>}
        {accessMessage && <small>🔒 {accessMessage}</small>}
        {locked && <a className="video-membership-cta" href="/clenstvo">Staň sa členom <span aria-hidden="true">→</span></a>}
      </div>
    </div>
  )
}

export default function VideoPlayer({ youtubeUrl, title, accessLevel, streamVideoId, provider = 'none', poster = '', previewImage = '', hasAccess = accessLevel === 'free', accessLoading = false }) {
  const youtubeVideoId = provider === 'youtube' && hasAccess ? getYoutubeVideoId(youtubeUrl) : null
  const accessMessage = accessLevel === 'vip'
    ? 'Tento obsah je dostupný iba pre VIP členov'
    : 'Tento obsah je určený pre MEMBER a VIP členov'
  const imagePath = previewImage || poster
  const { url: image, loading: imageLoading } = useSignedStorageUrl('thumbnails', imagePath, Boolean(imagePath))
  const { url: streamUrl, loading: streamLoading } = useSignedStorageUrl('videos', streamVideoId, provider === 'stream' && hasAccess && !accessLoading)
  const { url: cloudflarePlayerUrl, loading: cloudflareLoading } = useCloudflarePlaybackUrl(streamVideoId, provider === 'cloudflare_stream' && hasAccess && !accessLoading)

  if (accessLoading) return <PlayerState heading="Overujeme prístup…" accessLevel={accessLevel} image={image} />
  if (!hasAccess) return <PlayerState heading={accessLevel === 'vip' ? 'VIP obsah' : 'Premium obsah'} description="Odomkni si celý svet Východ Brothers a sleduj obsah bez obmedzení." accessMessage={accessMessage} accessLevel={accessLevel} image={image} locked />

  if (provider === 'stream') {
    if (streamLoading || imageLoading) return <PlayerState heading="Načítavam video…" accessLevel={accessLevel} image={image} />
    if (!streamUrl) return <PlayerState heading="Video momentálne nie je dostupné." accessLevel={accessLevel} image={image} />
    return <div className="video-detail-stage video-player-stream" data-stream-video-id={streamVideoId || undefined}><video src={streamUrl} poster={image || undefined} controls preload="metadata">Tvoj prehliadač nepodporuje prehrávanie videa.</video></div>
  }

  if (provider === 'cloudflare_stream') {
    if (cloudflareLoading || imageLoading) return <PlayerState heading="Načítavam video…" accessLevel={accessLevel} image={image} />
    if (!cloudflarePlayerUrl) return <PlayerState heading="Video momentálne nie je dostupné." accessLevel={accessLevel} image={image} />
    return <div className="video-detail-stage video-player-cloudflare" data-stream-video-id={streamVideoId || undefined}><iframe src={cloudflarePlayerUrl} title={`Prehrať video ${title}`} allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture" allowFullScreen /></div>
  }

  if (provider === 'none') return <PlayerState heading="Video pripravujeme." accessMessage={accessLevel === 'free' ? '' : accessMessage} accessLevel={accessLevel} image={image} />
  if (provider !== 'youtube') return <PlayerState heading="Video pripravujeme." accessLevel={accessLevel} image={image} />
  if (!youtubeVideoId) return <PlayerState heading="Video prehrávač pripravujeme" accessLevel={accessLevel} image={image} />

  return (
    <div className="video-detail-stage video-player-youtube">
      <iframe src={`https://www.youtube-nocookie.com/embed/${youtubeVideoId}`} title={`Prehrať video ${title}`} loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen />
    </div>
  )
}
