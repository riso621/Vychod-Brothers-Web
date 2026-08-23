import { motion, useReducedMotion } from 'framer-motion'
import CtaButton from './CtaButton'
import { aboutPath } from '../data'

const reveal = { hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0, transition: { duration: .75, ease: [.2, .7, .2, 1] } } }

export default function AboutStoryTeaser() {
  const reduceMotion = useReducedMotion()
  return <motion.section className="about-teaser" aria-labelledby="about-teaser-title" initial={reduceMotion ? false : 'hidden'} whileInView="visible" viewport={{ once: true, amount: .22 }} transition={{ staggerChildren: .1 }}>
    <div className="about-teaser-watermark" aria-hidden="true">VÝCHOD<br />BROTHERS</div>
    <motion.div className="about-teaser-image" variants={reveal} aria-hidden="true"><img src="/images/team/vychod-brothers-team-authentic.webp" alt="" loading="lazy" decoding="async" /></motion.div>
    <motion.div className="about-teaser-copy" variants={reveal}>
      <span>ODKIAĽ SME PRIŠLI</span>
      <h2 id="about-teaser-title">Začalo to<br /><em>jedným videom.</em></h2>
      <p>Bez scenára. Bez veľkého plánu. Jeden telefón, dedo, vnuk a nápad, ktorý mal byť iba pre zábavu. O pár hodín neskôr sme začínali chápať, že možno vzniká niečo väčšie.</p>
      <CtaButton href={aboutPath} icon="play" label="SPOZNAJ NÁŠ PRÍBEH" />
    </motion.div>
  </motion.section>
}
