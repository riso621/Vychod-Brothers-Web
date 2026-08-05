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
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [paused, setPaused] = useState(true)
  const [muted, setMuted] = useState(false)
  const [volume, setVolume] = useState(1)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [resumeToastVisible, setResumeToastVisible] = useState(false)
  const resumeToastTimerRef = useRef(null)
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
      const nextTime = Number(video.currentTime) || 0
      const nextDuration = Number(video.duration) || 0
      latestRef.current = { positionSeconds: nextTime, durationSeconds: nextDuration }
      setCurrentTime(nextTime)
      setDuration(nextDuration)
    }
    const handleMetadata = () => {
      updateSnapshot()
      if (resumePosition) {
        video.currentTime = resumePosition
        setCurrentTime(resumePosition)
        setResumeToastVisible(true)
        window.clearTimeout(resumeToastTimerRef.current)
        resumeToastTimerRef.current = window.setTimeout(() => setResumeToastVisible(false), 2600)
      }
    }
    const handleTimeUpdate = () => { updateSnapshot(); persist() }
    const handlePlay = () => setPaused(false)
    const handlePause = () => { setPaused(true); updateSnapshot(); persist(true) }
    const handleEnded = () => { setPaused(true); updateSnapshot(); persist(true, true) }
    const handleVolumeChange = () => { setMuted(video.muted); setVolume(video.volume) }
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
    video.addEventListener('play', handlePlay)
    video.addEventListener('pause', handlePause)
    video.addEventListener('ended', handleEnded)
    video.addEventListener('volumechange', handleVolumeChange)
    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('pagehide', handlePageHide)

    return () => {
      persist(true)
      video.removeEventListener('loadedmetadata', handleMetadata)
      video.removeEventListener('timeupdate', handleTimeUpdate)
      video.removeEventListener('play', handlePlay)
      video.removeEventListener('pause', handlePause)
      video.removeEventListener('ended', handleEnded)
      video.removeEventListener('volumechange', handleVolumeChange)
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('pagehide', handlePageHide)
      hls?.destroy()
      hlsRef.current = null
      window.clearTimeout(resumeToastTimerRef.current)
    }
  }, [manifestUrl, onWatchProgress, resumePosition, videoId])

  const handleQualityChange = (value) => {
    setSelectedQuality(value)
    setSettingsOpen(false)
    if (!hlsRef.current) return
    hlsRef.current.currentLevel = value === 'auto' ? -1 : Number(value)
  }

  const handleTogglePlayback = () => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) video.play().catch(() => {})
    else video.pause()
  }

  const handleSeek = (event) => {
    const value = Number(event.target.value)
    if (!videoRef.current || !Number.isFinite(value)) return
    videoRef.current.currentTime = value
    setCurrentTime(value)
  }

  const handleMute = () => {
    if (videoRef.current) videoRef.current.muted = !videoRef.current.muted
  }

  const handleVolume = (event) => {
    const value = Number(event.target.value)
    if (!videoRef.current || !Number.isFinite(value)) return
    videoRef.current.volume = value
    videoRef.current.muted = value === 0
  }

  const handleFullscreen = () => {
    const video = videoRef.current
    const player = video?.closest('.video-player-cloudflare')
    if (player?.requestFullscreen) player.requestFullscreen().catch(() => {})
    else video?.webkitEnterFullscreen?.()
  }

  const selectedQualityLabel = selectedQuality === 'auto' ? 'Auto' : `${qualityLevels.find((level) => String(level.index) === selectedQuality)?.height || ''}p`

  return <div className="video-detail-stage video-player-cloudflare" data-stream-video-id={videoId || undefined} data-audio-tracks={audioTrackCount}><video ref={videoRef} title={`Prehrať video ${title}`} playsInline preload="metadata" onClick={handleTogglePlayback}>Tvoj prehliadač nepodporuje prehrávanie videa.</video><div className="video-custom-controls"><input className="video-seek" type="range" min="0" max={duration || 0} step="0.1" value={Math.min(currentTime, duration || 0)} onChange={handleSeek} aria-label="Pozícia videa" /><div className="video-control-row"><button type="button" onClick={handleTogglePlayback} aria-label={paused ? 'Prehrať video' : 'Pozastaviť video'}>{paused ? '▶' : 'Ⅱ'}</button><span className="video-time">{formatTime(currentTime)} / {formatTime(duration)}</span><div className="video-volume"><button type="button" onClick={handleMute} aria-label={muted || volume === 0 ? 'Zapnúť zvuk' : 'Stlmiť zvuk'}>{muted || volume === 0 ? '🔇' : '🔊'}</button><input type="range" min="0" max="1" step="0.05" value={muted ? 0 : volume} onChange={handleVolume} aria-label="Hlasitosť" /></div><div className="video-controls-spacer" />{qualityLevels.length > 0 && <div className="video-settings"><button type="button" className={settingsOpen ? 'is-active' : ''} onClick={() => setSettingsOpen((open) => !open)} aria-label={`Nastavenia kvality, ${selectedQualityLabel}`} aria-expanded={settingsOpen}>⚙</button>{settingsOpen && <div className="video-quality-menu" role="menu" aria-label="Kvalita videa"><strong>Kvalita</strong><button type="button" role="menuitemradio" aria-checked={selectedQuality === 'auto'} onClick={() => handleQualityChange('auto')}><span>{selectedQuality === 'auto' ? '✓' : ''}</span>Auto</button>{qualityLevels.map((level) => { const value = String(level.index); return <button type="button" role="menuitemradio" aria-checked={selectedQuality === value} onClick={() => handleQualityChange(value)} key={level.height}><span>{selectedQuality === value ? '✓' : ''}</span>{level.height}p</button> })}</div>}</div>}<button type="button" onClick={handleFullscreen} aria-label="Prepnúť video na celú obrazovku">⛶</button></div></div>{resumePosition > 0 && <span className={`video-resume-notice${resumeToastVisible ? ' is-visible' : ''}`}>Pokračujeme od {formatTime(resumePosition)}</span>}</div>
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
