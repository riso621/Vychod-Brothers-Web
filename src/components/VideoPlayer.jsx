import { useEffect, useMemo, useRef, useState } from 'react'
import Hls from 'hls.js'
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

const formatTime = (seconds) => {
  const value = Math.max(0, Math.floor(seconds || 0))
  const hours = Math.floor(value / 3600)
  const minutes = Math.floor((value % 3600) / 60)
  const rest = value % 60
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}` : `${minutes}:${String(rest).padStart(2, '0')}`
}

function CloudflareTrackedPlayer({ playerUrl, title, videoId, watchProgress, onWatchProgress }) {
  const videoRef = useRef(null)
  const hlsRef = useRef(null)
  const [qualityLevels, setQualityLevels] = useState([])
  const [selectedQuality, setSelectedQuality] = useState('auto')
  const [audioTrackCount, setAudioTrackCount] = useState(0)
  const latestRef = useRef({ positionSeconds: 0, durationSeconds: 0 })
  const lastSavedRef = useRef(watchProgress?.position_seconds || 0)
  const resumePositionRef = useRef(watchProgress && !watchProgress.completed && watchProgress.position_seconds > 10 ? watchProgress.position_seconds : 0)
  const resumePosition = resumePositionRef.current
  const manifestUrl = useMemo(() => {
    const url = new URL(playerUrl)
    url.pathname = url.pathname.replace(/\/iframe$/, '/manifest/video.m3u8')
    return url.toString()
  }, [playerUrl])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return undefined
    let hls
    const persist = (force = false, completed = false) => {
      if (!onWatchProgress || !videoId) return
      const { positionSeconds, durationSeconds } = latestRef.current
      const change = Math.abs(positionSeconds - lastSavedRef.current)
      if (positionSeconds <= 0 || !force && change < 10 || force && !completed && change < 1) return
      lastSavedRef.current = positionSeconds
      onWatchProgress(videoId, { positionSeconds, durationSeconds, completed }).catch(() => {})
    }
    const updateSnapshot = () => {
      latestRef.current = { positionSeconds: Number(video.currentTime) || 0, durationSeconds: Number(video.duration) || 0 }
    }
    const handleMetadata = () => {
      updateSnapshot()
      if (resumePosition) video.currentTime = resumePosition
    }
    const handleTimeUpdate = () => { updateSnapshot(); persist() }
    const handlePause = () => { updateSnapshot(); persist(true) }
    const handleEnded = () => { updateSnapshot(); persist(true, true) }
    const handleVisibility = () => { if (document.visibilityState === 'hidden') persist(true) }
    const handlePageHide = () => persist(true)

    if (Hls.isSupported()) {
      hls = new Hls({ enableWorker: true })
      hlsRef.current = hls
      hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
        const uniqueLevels = new Map()
        data.levels.forEach((level, index) => {
          if (!level.height) return
          const existing = uniqueLevels.get(level.height)
          if (!existing || (level.bitrate || 0) > existing.bitrate) uniqueLevels.set(level.height, { index, height: level.height, bitrate: level.bitrate || 0 })
        })
        setQualityLevels([...uniqueLevels.values()].sort((a, b) => b.height - a.height))
        setAudioTrackCount(data.audioTracks?.length || hls.audioTracks.length || 0)
      })
      hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, (_event, data) => setAudioTrackCount(data.audioTracks.length))
      hls.loadSource(manifestUrl)
      hls.attachMedia(video)
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = manifestUrl
    }
    video.addEventListener('loadedmetadata', handleMetadata)
    video.addEventListener('timeupdate', handleTimeUpdate)
    video.addEventListener('pause', handlePause)
    video.addEventListener('ended', handleEnded)
    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('pagehide', handlePageHide)

    return () => {
      persist(true)
      video.removeEventListener('loadedmetadata', handleMetadata)
      video.removeEventListener('timeupdate', handleTimeUpdate)
      video.removeEventListener('pause', handlePause)
      video.removeEventListener('ended', handleEnded)
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('pagehide', handlePageHide)
      hls?.destroy()
      hlsRef.current = null
    }
  }, [manifestUrl, onWatchProgress, resumePosition, videoId])

  const handleQualityChange = (event) => {
    const value = event.target.value
    setSelectedQuality(value)
    if (!hlsRef.current) return
    hlsRef.current.currentLevel = value === 'auto' ? -1 : Number(value)
  }

  const handleFullscreen = () => {
    const video = videoRef.current
    if (video?.requestFullscreen) video.requestFullscreen()
    else video?.webkitEnterFullscreen?.()
  }

  return <div className="video-detail-stage video-player-cloudflare" data-stream-video-id={videoId || undefined} data-audio-tracks={audioTrackCount}><video ref={videoRef} title={`Prehrať video ${title}`} controls playsInline preload="metadata">Tvoj prehliadač nepodporuje prehrávanie videa.</video><div className="video-player-tools">{qualityLevels.length > 0 && <label className="video-quality-control"><span>Kvalita</span><select aria-label="Kvalita videa" value={selectedQuality} onChange={handleQualityChange}><option value="auto">Auto</option>{qualityLevels.map((level) => <option value={level.index} key={level.height}>{level.height}p</option>)}</select></label>}<button type="button" className="video-fullscreen-button" onClick={handleFullscreen} aria-label="Prepnúť video na celú obrazovku">⛶</button></div>{resumePosition > 0 && <span className="video-resume-notice">Pokračujeme od {formatTime(resumePosition)}</span>}</div>
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
