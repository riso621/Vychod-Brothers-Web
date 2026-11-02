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

  return <AnimatePresence>{visible && <motion.div className="vb-intro" initial={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: .42 }} aria-label="Východ Brothers" role="status">
    <div className="vb-intro-flare" />
    <motion.div className="vb-intro-mark" initial={{ opacity: 0, scale: .72, filter: 'blur(18px)' }} animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }} transition={{ duration: reduceMotion ? .15 : 1.05, ease: [.16, 1, .3, 1] }}><span>V</span><i>B</i></motion.div>
    <motion.div className="vb-intro-name" initial={{ opacity: 0, letterSpacing: '.7em' }} animate={{ opacity: 1, letterSpacing: '.28em' }} transition={{ delay: reduceMotion ? 0 : 1.15, duration: .8 }}>VÝCHOD BROTHERS</motion.div>
    <motion.div className="vb-intro-line" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: reduceMotion ? 0 : .7, duration: 1.5 }} />
  </motion.div>}</AnimatePresence>
}
