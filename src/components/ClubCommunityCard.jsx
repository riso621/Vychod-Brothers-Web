import { motion } from 'framer-motion'
function CommunityIcon() {
  return <svg viewBox="0 0 64 64" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="32" cy="20" r="9" /><circle cx="14" cy="25" r="6.5" /><circle cx="50" cy="25" r="6.5" /><path d="M17 51c0-10 6-16 15-16s15 6 15 16" /><path d="M3 50c0-8 4-13 11-13 3 0 5 1 7 3M61 50c0-8-4-13-11-13-3 0-5 1-7 3" /></svg>
}

function VideoIcon() {
  return <svg viewBox="0 0 64 64" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><rect x="8" y="13" width="48" height="38" rx="6" /><path d="M8 24h48M17 13l7 11M32 13l7 11M47 13l7 11" /><path d="m28 32 11 6-11 6V32Z" /></svg>
}

function CountItem({ type, count, loading, error, label }) {
  const formattedCount = count === null ? '—' : new Intl.NumberFormat('sk-SK').format(count)
  const Icon = type === 'members' ? CommunityIcon : VideoIcon
  return <div className="club-count-item">
    <div className="club-count-icon"><Icon /></div>
    <div className="club-count-copy">
      <strong className={loading ? 'is-loading' : ''} aria-live="polite" aria-label={loading ? `Načítavam ${label.toLowerCase()}` : error ? `${label} momentálne nie sú dostupné` : `${formattedCount} ${label.toLowerCase()}`}>{formattedCount}</strong>
      <span>{label}</span>
    </div>
  </div>
}

export default function ClubCommunityCard({ memberCount, videoCount, loading, error }) {
  return (
    <motion.section className="club-community" aria-label="Aktuálne štatistiky Východ Brothers Clubu" initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: .25 }} transition={{ duration: .55 }}>
      <CountItem type="members" count={memberCount} loading={loading} error={error} label="ČLENOV" />
      <CountItem type="videos" count={videoCount} loading={loading} error={error} label="VIDEÍ" />
    </motion.section>
  )
}
