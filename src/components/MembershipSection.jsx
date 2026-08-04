import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { membershipPlans } from '../lib/membership'

export default function MembershipSection({ standalone = false }) {
  const [isOpen, setIsOpen] = useState(false)
  const closeButtonRef = useRef(null)

  useEffect(() => {
    if (!isOpen) return undefined
    closeButtonRef.current?.focus()
    const closeOnEscape = (event) => event.key === 'Escape' && setIsOpen(false)
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [isOpen])

  return (
    <>
      <motion.section className={`membership-v3${standalone ? ' is-standalone' : ''}`} id="clenstvo" initial={{ opacity: 0, y: 28 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.08 }} transition={{ duration: 0.8 }}>
        <header className="membership-v3-heading">
          <span>VÝCHOD BROTHERS · MEMBERSHIP</span>
          <h1>{standalone ? 'ČLENSTVO' : 'VIAC Z NÁŠHO SVETA.'}</h1>
          <p>Tri úrovne. Jeden svet príbehov, humoru a obsahu spoza kamery. Platby spustíme neskôr — systém účtov a prístupov je pripravený.</p>
        </header>
        <div className="membership-v3-grid">
          {membershipPlans.map((plan) => (
            <motion.article className={`membership-v3-card is-${plan.id}${plan.popular ? ' is-popular' : ''}`} whileHover={{ y: -6 }} key={plan.id}>
              {plan.popular && <span className="membership-v3-popular">NAJOBĽÚBENEJŠIE</span>}
              <span className="membership-v3-icon" aria-hidden="true">{plan.icon}</span>
              <div><small>PLÁN</small><h2>{plan.name}</h2><p>{plan.description}</p></div>
              <div className="membership-v3-price"><strong>COMING SOON</strong><small>Cena bude oznámená</small></div>
              <ul>{plan.perks.map((perk) => <li key={perk}><i aria-hidden="true">✓</i>{perk}</li>)}</ul>
              <button type="button" onClick={() => setIsOpen(true)}>{plan.id === 'free' ? 'Aktuálne dostupné' : 'Stať sa členom'}<span aria-hidden="true">→</span></button>
            </motion.article>
          ))}
        </div>
      </motion.section>

      <AnimatePresence>{isOpen && <motion.div className="membership-modal" role="presentation" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => event.target === event.currentTarget && setIsOpen(false)}><motion.div className="membership-dialog" role="dialog" aria-modal="true" aria-labelledby="membership-dialog-title" initial={{ opacity: 0, y: 18, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: .98 }}><button ref={closeButtonRef} className="modal-close" type="button" aria-label="Zavrieť" onClick={() => setIsOpen(false)}>×</button><span>VÝCHOD BROTHERS</span><h2 id="membership-dialog-title">Členstvo pripravujeme</h2><p>Účty a prístupy sú pripravené. Platby zatiaľ nie sú aktívne.</p><button className="modal-confirm" type="button" onClick={() => setIsOpen(false)}>Rozumiem</button></motion.div></motion.div>}</AnimatePresence>
    </>
  )
}
