import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { membershipBenefits, plans } from '../data'

export default function MembershipSection() {
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
      <motion.section
        className="membership membership-v2"
        id="clenstvo"
        initial={{ opacity: 0, y: 28 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.12 }}
        transition={{ duration: 0.8 }}
      >
        <header className="membership-intro">
          <span className="membership-kicker">ČLENSTVO · ČOSKORO</span>
          <h2>BUĎ PRI TOM<br /><em>O KROK SKÔR.</em></h2>
          <p>Extra obsah, premiéry a pohľad za kameru. Bez záväzkov — jednoducho podpora tvorby, ktorú chceš vidieť.</p>
        </header>

        <div className="membership-plans">
          {plans.map((plan) => (
            <motion.article className={`membership-plan ${plan.popular ? 'is-vip' : ''}`} whileHover={{ y: -4 }} key={plan.id}>
              {plan.popular && <span className="membership-badge">NAJOBĽÚBENEJŠIE</span>}
              <div className="plan-heading">
                <span>{plan.name}</span>
                <p>{plan.description}</p>
              </div>
              <div className="membership-price"><strong>{plan.price}</strong><small>/ {plan.period}</small></div>
              <ul>{plan.perks.map((perk) => <li key={perk}><i aria-hidden="true">✓</i>{perk}</li>)}</ul>
              <button type="button" onClick={() => setIsOpen(true)}>{plan.button}<span aria-hidden="true">→</span></button>
            </motion.article>
          ))}
        </div>

        <div className="membership-assurances">
          {membershipBenefits.map((benefit) => (
            <div className="assurance" key={benefit.id}>
              <span aria-hidden="true">{benefit.icon}</span>
              <div><strong>{benefit.title}</strong><small>{benefit.detail}</small></div>
            </div>
          ))}
        </div>
      </motion.section>

      <AnimatePresence>
        {isOpen && (
          <motion.div className="membership-modal" role="presentation" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => event.target === event.currentTarget && setIsOpen(false)}>
            <motion.div className="membership-dialog" role="dialog" aria-modal="true" aria-labelledby="membership-dialog-title" initial={{ opacity: 0, y: 18, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.98 }} transition={{ duration: 0.25 }}>
              <button ref={closeButtonRef} className="modal-close" type="button" aria-label="Zavrieť" onClick={() => setIsOpen(false)}>×</button>
              <span>VÝCHOD BROTHERS</span>
              <h2 id="membership-dialog-title">Členstvo pripravujeme</h2>
              <p>Pracujeme na posledných detailoch. Platby zatiaľ nie sú aktívne.</p>
              <button className="modal-confirm" type="button" onClick={() => setIsOpen(false)}>Rozumiem</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
