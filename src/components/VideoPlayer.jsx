import { useEffect, useMemo, useRef } from 'react'
import { useSignedStorageUrl } from '../hooks/useSignedStorageUrl'
import { useCloudflarePlaybackUrl } from '../hooks/useCloudflarePlaybackUrl'
import { loadCloudflarePlayerSdk } from '../lib/cloudflare-player'

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

const formatTime = (seconds) => {
  const value = Math.max(0, Math.floor(seconds || 0))
  const hours = Math.floor(value / 3600)
  const minutes = Math.floor((value % 3600) / 60)
  const rest = value % 60
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}` : `${minutes}:${String(rest).padStart(2, '0')}`
}

function CloudflareTrackedPlayer({ playerUrl, title, videoId, watchProgress, onWatchProgress }) {
  const iframeRef = useRef(null)
  const latestRef = useRef({ positionSeconds: 0, durationSeconds: 0 })
  const lastSavedRef = useRef(watchProgress?.position_seconds || 0)
  const resumePositionRef = useRef(watchProgress && !watchProgress.completed && watchProgress.position_seconds > 10 ? watchProgress.position_seconds : 0)
  const resumePosition = resumePositionRef.current
  const source = useMemo(() => {
    if (!resumePosition) return playerUrl
    const url = new URL(playerUrl)
    url.searchParams.set('startTime', String(resumePosition))
    return url.toString()
  }, [playerUrl, resumePosition])

  useEffect(() => {
    let active = true
    let player
    const listeners = []
    const persist = (force = false, completed = false) => {
      if (!onWatchProgress || !videoId) return
      const { positionSeconds, durationSeconds } = latestRef.current
      const change = Math.abs(positionSeconds - lastSavedRef.current)
      if (positionSeconds <= 0 || !force && change < 10 || force && !completed && change < 1) return
      lastSavedRef.current = positionSeconds
      onWatchProgress(videoId, { positionSeconds, durationSeconds, completed }).catch(() => {})
    }
    const add = (event, handler) => {
      player.addEventListener(event, handler)
      listeners.push([event, handler])
    }
    const handleVisibility = () => { if (document.visibilityState === 'hidden') persist(true) }
    const handlePageHide = () => persist(true)

    loadCloudflarePlayerSdk().then((Stream) => {
      if (!active || !iframeRef.current) return
      player = Stream(iframeRef.current)
      const updateSnapshot = () => {
        latestRef.current = { positionSeconds: Number(player.currentTime) || 0, durationSeconds: Number(player.duration) || 0 }
      }
      add('loadedmetadata', () => {
        updateSnapshot()
        if (resumePosition) player.currentTime = resumePosition
      })
      add('timeupdate', () => { updateSnapshot(); persist() })
      add('pause', () => { updateSnapshot(); persist(true) })
      add('ended', () => { updateSnapshot(); persist(true, true) })
      document.addEventListener('visibilitychange', handleVisibility)
      window.addEventListener('pagehide', handlePageHide)
    }).catch(() => {})

    return () => {
      active = false
      persist(true)
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('pagehide', handlePageHide)
      if (player) listeners.forEach(([event, handler]) => player.removeEventListener(event, handler))
    }
  }, [onWatchProgress, resumePosition, videoId])

  return <div className="video-detail-stage video-player-cloudflare" data-stream-video-id={videoId || undefined}><iframe ref={iframeRef} src={source} title={`Prehrať video ${title}`} allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture" allowFullScreen />{resumePosition > 0 && <span className="video-resume-notice">Pokračujeme od {formatTime(resumePosition)}</span>}</div>
}

export default function VideoPlayer({ youtubeUrl, title, accessLevel, streamVideoId, provider = 'none', poster = '', previewImage = '', hasAccess = accessLevel === 'free', accessLoading = false, videoId = '', watchProgress = null, onWatchProgress = null }) {
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
    return <CloudflareTrackedPlayer key={cloudflarePlayerUrl} playerUrl={cloudflarePlayerUrl} title={title} videoId={videoId} watchProgress={watchProgress} onWatchProgress={onWatchProgress} />
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
