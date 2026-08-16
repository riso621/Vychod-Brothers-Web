import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { canAccessMembership } from '../lib/membership'
import TrailerModal from './TrailerModal'

const labels = { member: 'ČLENSKÉ', vip: 'ČLENSKÉ' }
const prices = { member: '5,99 € / mesiac', vip: '5,99 € / mesiac' }
const reveal = { hidden: { opacity: 0, y: 22 }, visible: { opacity: 1, y: 0, transition: { duration: .65, ease: [.2, .7, .2, 1] } } }

function Artwork({ url }) {
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [url])

  if (!url || failed) return <span className="members-showcase-fallback" aria-hidden="true"><b>VB</b><small>EXKLUZÍVNA PREMIÉRA</small></span>
  return <img src={url} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} />
}

function LockIcon() {
  return <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M9 14v-3a7 7 0 0 1 14 0v3" /><rect x="6" y="14" width="20" height="15" rx="4" /><path d="M16 20v4" /></svg>
}

function CardVisual({ video, thumbnailUrl, unlocked }) {
  return <>
    <Artwork url={thumbnailUrl} />
    <span className="members-showcase-gradient" />
    {unlocked
      ? <span className="members-showcase-play"><i aria-hidden="true">▶</i><b>PREHRAŤ</b></span>
      : <span className="members-showcase-lock"><i><LockIcon /></i><em>{labels[video.accessLevel]}</em><strong>{prices[video.accessLevel]}</strong></span>}
    <span className="members-showcase-meta"><span><b>{video.title}</b><small>{video.duration || '—'}</small></span><em className={`access-${video.accessLevel}`}>{labels[video.accessLevel]}</em></span>
  </>
}

function PremiumShowcaseCard({ video, thumbnailUrl, unlocked, onPlayTrailer }) {
  const visual = <CardVisual video={video} thumbnailUrl={thumbnailUrl} unlocked={unlocked} />

  return <motion.article className={`members-showcase-card ${unlocked ? 'is-unlocked' : 'is-locked'}`} initial="hidden" whileInView="visible" viewport={{ once: true, amount: .2 }} variants={reveal}>
    {unlocked
      ? <a className="members-showcase-art" href={`/videos/${video.slug}`} aria-label={`Pozrieť video ${video.title}`}>{visual}</a>
      : video.trailerStreamVideoId
        ? <div className="members-showcase-art has-trailer">{visual}<button className="members-showcase-trailer" type="button" onClick={onPlayTrailer}><span aria-hidden="true">▶</span><b>POZRIEŤ UKÁŽKU</b><small>ZDARMA</small></button></div>
        : <details className="members-showcase-art"><summary aria-label={`Zobraziť členstvo pre video ${video.title}`}>{visual}</summary><a className="members-showcase-cta" href="/clenstvo">Stať sa členom <span aria-hidden="true">→</span></a></details>}
  </motion.article>
}

export default function PremiumShowcase({ videos, thumbnailUrls, profile, session, isAdmin }) {
  const [trailerVideo, setTrailerVideo] = useState(null)
  if (!videos.length) return null

  const returnTo = trailerVideo ? `/videos/${trailerVideo.slug}` : '/videos'
  const membershipHref = session ? `/checkout/club?returnTo=${encodeURIComponent(returnTo)}` : `/?auth=register&next=${encodeURIComponent(`/checkout/club?returnTo=${returnTo}`)}`

  return <><section className={`members-showcase count-${videos.length}`} aria-labelledby="members-showcase-heading">
    <header className="members-showcase-heading"><div><span>ORIGINÁLNA TVORBA · BONUSY · PREMIÉRY</span><h2 id="members-showcase-heading">Len pre členov</h2><p>Príbehy a momenty, ktoré vo verejnom feede neuvidíš.</p></div><a href="/clenstvo">Objaviť členstvo <span aria-hidden="true">→</span></a></header>
    <div className="members-showcase-row">{videos.map((video) => <PremiumShowcaseCard video={video} thumbnailUrl={thumbnailUrls.get(video.thumbnail)} unlocked={canAccessMembership(video.accessLevel, profile, isAdmin)} onPlayTrailer={() => setTrailerVideo(video)} key={video.id} />)}</div>
  </section>{trailerVideo && <TrailerModal video={trailerVideo} membershipHref={membershipHref} onClose={() => setTrailerVideo(null)} />}</>
}
