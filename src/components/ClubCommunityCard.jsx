import { motion } from 'framer-motion'
import CtaButton from './CtaButton'

const benefits = [
  'Exkluzívne videá a zákulisie',
  'Bonusy a predčasné prístupy',
  'Všetok budúci členský obsah',
]

function CommunityIcon() {
  return <svg viewBox="0 0 64 64" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="32" cy="20" r="9" /><circle cx="14" cy="25" r="6.5" /><circle cx="50" cy="25" r="6.5" /><path d="M17 51c0-10 6-16 15-16s15 6 15 16" /><path d="M3 50c0-8 4-13 11-13 3 0 5 1 7 3M61 50c0-8-4-13-11-13-3 0-5 1-7 3" /></svg>
}

function CheckIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="m8 12 2.5 2.5L16 9" /></svg>
}

export default function ClubCommunityCard({ count, loading, error }) {
  const formattedCount = count === null ? '—' : new Intl.NumberFormat('sk-SK').format(count)
  return (
    <motion.section className="club-community" aria-labelledby="club-community-title" initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: .25 }} transition={{ duration: .65 }}>
      <div className="club-community-main">
        <div className="club-community-icon"><CommunityIcon /></div>
        <div className="club-community-count">
          <span id="club-community-title">SÚČASŤOU CLUBU JE UŽ</span>
          <strong className={loading ? 'is-loading' : ''} aria-live="polite" aria-label={loading ? 'Načítavam počet členov' : error ? 'Počet členov momentálne nie je dostupný' : `${formattedCount} členov Clubu`}>{formattedCount}</strong>
          <b>ČLENOV</b>
          {error && <small>Aktuálny počet momentálne nie je dostupný.</small>}
        </div>
      </div>
      <ul className="club-community-benefits">
        {benefits.map((benefit) => <li key={benefit}><CheckIcon /><span>{benefit}</span></li>)}
      </ul>
      <CtaButton className="club-community-cta" href="/clenstvo" icon="crown" label="OBJAVIŤ ČLENSTVO" fullWidth />
    </motion.section>
  )
}
