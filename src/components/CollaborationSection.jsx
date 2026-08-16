import { useMemo, useState } from 'react'
import { stats } from '../data'
import { supabase } from '../lib/supabase'
import { formatSocialCount } from '../lib/social-stats'
import { useSocialStats } from '../hooks/useSocialStats'

const budgetOptions = [250, 500, 1000, 2000, 5000]
const formatBudget = (value) => `${new Intl.NumberFormat('sk-SK').format(value)} €`

function Icon({ type }) {
  const paths = {
    bolt: <path d="m13 2-8 12h7l-1 8 8-12h-7z" />,
    target: <><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="m15 9 5-5"/></>,
    handshake: <><path d="m8 12 3 3a2 2 0 0 0 3 0l5-5"/><path d="m3 8 5-3 4 3 4-2 5 3-3 7-4 3-6-1-5-6z"/></>,
    crown: <path d="m3 7 4 4 5-7 5 7 4-4-2 12H5z" />,
    shield: <><path d="M12 3 4 6v5c0 5 3.4 8.5 8 10 4.6-1.5 8-5 8-10V6z"/><path d="m9 12 2 2 4-5"/></>,
    send: <><path d="m3 11 18-8-8 18-2-8z"/><path d="m11 13 5-5"/></>,
    youtube: <><rect x="3" y="6" width="18" height="12" rx="3"/><path d="m10 9 5 3-5 3z"/></>,
    instagram: <><rect x="4" y="4" width="16" height="16" rx="4"/><circle cx="12" cy="12" r="4"/><path d="M17.5 6.5h.01"/></>,
    tiktok: <><path d="M14 4v11a4 4 0 1 1-3-3.87"/><path d="M14 4c1 3 3 4 6 4"/></>,
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[type]}</svg>
}

export default function CollaborationSection() {
  const socialStats = useSocialStats()
  const [budget, setBudget] = useState(1250)
  const [submitting, setSubmitting] = useState(false)
  const [status, setStatus] = useState('')
  const socialProof = useMemo(() => [
    ['youtube', 'youtube-subscribers', 'Odberateľov na YouTube'],
    ['instagram', 'instagram-followers', 'Sledovateľov na Instagrame'],
    ['tiktok', 'tiktok-followers', 'Sledovateľov na TikToku'],
  ].map(([icon, id, label]) => ({ icon, label, value: formatSocialCount(socialStats.data[stats.find((item) => item.id === id)?.platform]?.followers) || '—' })), [socialStats.data])

  const submit = async (event) => {
    event.preventDefault()
    if (submitting) return
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    const email = String(form.get('email') || '').trim()
    const message = String(form.get('message') || '').trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || message.length < 10) {
      setStatus('Skontrolujte e-mail a správu.')
      return
    }
    setSubmitting(true)
    setStatus('')
    const payload = { ...Object.fromEntries(form.entries()), budget: formatBudget(budget) }
    const { data, error } = await supabase.functions.invoke('collaboration-submit', { body: payload })
    if (error || data?.error) setStatus(data?.error || 'Ponuku sa nepodarilo odoslať. Skúste to neskôr.')
    else {
      formElement.reset()
      setBudget(1250)
      setStatus('Ďakujeme. Vaša ponuka na spoluprácu bola odoslaná.')
    }
    setSubmitting(false)
  }

  return <section className="collaboration-section" id="kontakt" aria-labelledby="collaboration-heading">
    <div className="collaboration-main">
      <div className="collaboration-intro">
        <span className="collaboration-eyebrow">SPOLUPRÁCE / PARTNERSTVÁ</span>
        <h2 id="collaboration-heading">Poďme vytvoriť<br />niečo silné.</h2>
        <p>Máte značku, produkt alebo nápad, ktorý zapadá do sveta Východ Brothers? Napíšte nám konkrétnu ponuku.</p>
        <div className="collaboration-budget">
          <div className="collaboration-budget-heading"><span>€</span><div><strong>AKÝ JE VÁŠ ROZPOČET?</strong><small>Pomôže nám to pripraviť pre vás presnejšiu ponuku.</small></div></div>
          <output htmlFor="collaboration-budget-range">{formatBudget(budget)}</output>
          <div className="collaboration-range-row"><small>250 €</small><input id="collaboration-budget-range" type="range" min="250" max="10000" step="250" value={budget} onChange={(event) => setBudget(Number(event.target.value))} style={{ '--range-progress': `${((budget - 250) / 9750) * 100}%` }} aria-label="Rozpočet spolupráce" /><small>10 000 €</small></div>
          <div className="collaboration-range-points" aria-hidden="true"><span>250</span><span>1k</span><span>2k</span><span>5k</span><span>10k</span></div>
          <div className="collaboration-budget-buttons">{budgetOptions.map((value) => <button type="button" className={budget === value ? 'is-active' : ''} onClick={() => setBudget(value)} key={value}>{formatBudget(value)}{value === 5000 ? '+' : ''}</button>)}</div>
        </div>
        <div className="collaboration-benefits">
          {[
            ['bolt', 'Rýchla odpoveď', '24–48h'], ['target', 'Reálne čísla', 'a dosah'],
            ['handshake', 'Profesionálna', 'spolupráca'], ['crown', 'Tvoríme obsah,', 'čo funguje'],
          ].map(([icon, title, copy]) => <div key={title}><span><Icon type={icon} /></span><strong>{title}</strong><small>{copy}</small></div>)}
        </div>
      </div>
      <form className="collaboration-form" onSubmit={submit} noValidate>
        <label>Meno<input name="name" placeholder="Vaše meno" required minLength="2" maxLength="120" /></label>
        <label>Firma / značka <small>voliteľné</small><input name="company" placeholder="Názov firmy alebo značky" maxLength="160" /></label>
        <label>E-mail<input name="email" type="email" placeholder="Váš e-mail" required maxLength="254" /></label>
        <label>Telefón <small>voliteľné</small><input name="phone" type="tel" placeholder="Váš telefón" maxLength="40" /></label>
        <label className="is-wide">Predmet spolupráce<input name="subject" placeholder="O čo ide?" required minLength="2" maxLength="180" /></label>
        <label className="is-wide">Správa<textarea name="message" placeholder={'Popíšte prosím vašu predstavu o spolupráci...\nČím viac detailov, tým lepšie.'} required minLength="10" maxLength="5000" rows="6" /></label>
        <input type="hidden" name="budget" value={formatBudget(budget)} />
        <label className="collaboration-honeypot" aria-hidden="true">Web<input name="website" tabIndex="-1" autoComplete="off" /></label>
        <div className="collaboration-privacy"><Icon type="shield" /><span>Vaše údaje sú u nás v bezpečí a nepoužijeme ich na iné účely.</span></div>
        <button className="collaboration-submit" type="submit" disabled={submitting}>{submitting ? 'ODOSIELAM…' : <>ODOSLAŤ PONUKU <Icon type="send" /></>}</button>
        <p className="collaboration-status" role="status" aria-live="polite">{status}</p>
      </form>
    </div>
    <div className="collaboration-proof">
      {socialProof.map((item) => <div className="collaboration-proof-stat" key={item.icon}><Icon type={item.icon} /><div><strong>{item.value}</strong><small>{item.label}</small></div></div>)}
      <blockquote>Spolupracujeme len s tým, čomu veríme.<br />Kvalita, dôvera a výsledky na prvom mieste.<cite>Východ Brothers</cite></blockquote>
    </div>
  </section>
}
