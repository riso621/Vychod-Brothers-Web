import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'

const INTRO_KEY = 'vb-cinematic-intro-seen'

export default function CinematicIntro() {
  const reduceMotion = useReducedMotion()
  const [visible, setVisible] = useState(() => !sessionStorage.getItem(INTRO_KEY))

  useEffect(() => {
    if (!visible) return undefined
    const duration = reduceMotion ? 350 : 3000
    const timer = window.setTimeout(() => {
      sessionStorage.setItem(INTRO_KEY, '1')
      setVisible(false)
    }, duration)
    return () => window.clearTimeout(timer)
  }, [reduceMotion, visible])

  const closeIntro = () => {
    sessionStorage.setItem(INTRO_KEY, '1')
    setVisible(false)
  }

  return <AnimatePresence>{visible && <motion.div className="vb-intro" initial={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: .42 }} aria-label="Východ Brothers" role="status">
    <div className="vb-intro-flare" />
    <motion.div className="vb-intro-mark" animate={{ scale: [1, 1, 1.025] }} transition={{ delay: reduceMotion ? 0 : 2.7, duration: .25 }}><motion.span initial={{ opacity: 0, x: 18, filter: 'blur(12px)' }} animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }} transition={{ delay: reduceMotion ? 0 : .3, duration: reduceMotion ? .1 : .7 }}>V</motion.span><motion.i initial={{ opacity: 0, x: -42, filter: 'blur(16px)' }} animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }} transition={{ delay: reduceMotion ? 0 : 1, duration: reduceMotion ? .1 : .8 }}>B</motion.i></motion.div>
    <motion.div className="vb-intro-name" initial={{ opacity: 0, letterSpacing: '.7em' }} animate={{ opacity: 1, letterSpacing: '.28em' }} transition={{ opacity: { delay: reduceMotion ? 0 : 1.8, duration: .35 }, letterSpacing: { delay: reduceMotion ? 0 : 1.8, duration: .45 } }}>VÝCHOD BROTHERS</motion.div>
    <motion.div className="vb-intro-line" initial={{ scaleX: 0, opacity: 0 }} animate={{ scaleX: 1, opacity: 1 }} transition={{ delay: reduceMotion ? 0 : 2.3, duration: .4 }} />
    <button className="vb-intro-skip" type="button" onClick={closeIntro}>Preskočiť intro</button>
  </motion.div>}</AnimatePresence>
}
