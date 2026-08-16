import { useMemo } from 'react'
import { stats } from '../data'
import CtaButton from './CtaButton'

const proofItems = [
  ['youtube-subscribers', 'YouTube'],
  ['instagram-followers', 'Instagram'],
  ['tiktok-followers', 'TikTok'],
]

function SocialIcon({ name }) {
  if (name === 'YouTube') return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6" width="18" height="12" rx="3"/><path d="m10 9 5 3-5 3z"/></svg>
  if (name === 'Instagram') return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="4"/><circle cx="12" cy="12" r="4"/><path d="M17.5 6.5h.01"/></svg>
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4v11a4 4 0 1 1-3-3.87M14 4c1 3 3 4 6 4"/></svg>
}

export default function CollaborationTeaser() {
  const socialProof = useMemo(() => proofItems.map(([id, label]) => ({
    id,
    label,
    value: stats.find((item) => item.id === id)?.value || '—',
  })), [])

  return <section className="collaboration-teaser" id="kontakt" aria-labelledby="collaboration-teaser-heading">
    <div className="collaboration-teaser-copy">
      <span>SPOLUPRÁCE / PARTNERSTVÁ</span>
      <h2 id="collaboration-teaser-heading">Poďme vytvoriť<br />niečo silné.</h2>
      <p>Máte značku, produkt alebo nápad, ktorý patrí do sveta Východ Brothers? Pošlite nám konkrétnu ponuku.</p>
      <CtaButton className="collaboration-main-cta" href="/spolupraca" icon="handshake" label="MÁM ZÁUJEM O SPOLUPRÁCU" />
    </div>
    <div className="collaboration-teaser-proof" aria-label="Dosah Východ Brothers">
      {socialProof.map((item) => <div key={item.id}><SocialIcon name={item.label} /><strong>{item.value}</strong><small>{item.label}</small></div>)}
    </div>
  </section>
}
