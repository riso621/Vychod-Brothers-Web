import { useState } from 'react'
import { motion } from 'framer-motion'
import CtaButton from './CtaButton'

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function NewsletterSection() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState('idle')

  const handleSubmit = (event) => {
    event.preventDefault()
    const normalizedEmail = email.trim()

    if (!normalizedEmail) {
      setStatus('error')
      setMessage('Zadaj svoj e-mail.')
      return
    }

    if (!emailPattern.test(normalizedEmail)) {
      setStatus('error')
      setMessage('Zadaj e-mail v správnom formáte.')
      return
    }

    setStatus('success')
    setMessage('Newsletter pripravujeme. Ďakujeme za záujem.')
    setEmail('')
  }

  return (
    <motion.section
      className="newsletter-section"
      id="newsletter"
      aria-labelledby="newsletter-title"
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 0.7, ease: [0.2, 0.7, 0.2, 1] }}
    >
      <div className="newsletter-section__copy">
        <span className="newsletter-section__eyebrow">VÝCHOD BROTHERS · NOVINKY</span>
        <h2 id="newsletter-title">Nezmeškaj <em>nové video</em></h2>
        <p>Nové videá, budúci exkluzívny obsah aj prvé informácie o pripravovanom merchi — priamo do tvojej schránky.</p>
      </div>

      <form className="newsletter-form" onSubmit={handleSubmit} noValidate>
        <label className="sr-only" htmlFor="newsletter-email">E-mailová adresa</label>
        <div className="newsletter-form__row">
          <input
            id="newsletter-email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="tvoj@email.sk"
            value={email}
            aria-invalid={status === 'error'}
            aria-describedby="newsletter-status"
            onChange={(event) => {
              setEmail(event.target.value)
              if (status !== 'idle') {
                setStatus('idle')
                setMessage('')
              }
            }}
          />
          <CtaButton type="submit" variant="primary" icon="mail" label="ODOBERAŤ" />
        </div>
        <p className={`newsletter-form__status is-${status}`} id="newsletter-status" aria-live="polite">{message}</p>
      </form>
    </motion.section>
  )
}
