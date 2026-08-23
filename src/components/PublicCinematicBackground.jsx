import { useEffect, useRef } from 'react'

const randomBetween = (min, max) => min + Math.random() * (max - min)

function createParticles(width, height, mobile) {
  return Array.from({ length: mobile ? 14 : 38 }, (_, index) => ({
    x: Math.random() * width,
    y: Math.random() * height,
    vx: randomBetween(-0.006, 0.012),
    vy: randomBetween(-0.028, -0.008),
    radius: index < (mobile ? 2 : 6) ? randomBetween(1.1, 1.8) : randomBetween(.35, .9),
    alpha: randomBetween(.24, .72),
    phase: Math.random() * Math.PI * 2,
  }))
}

function createLightning(width, height, now, mobile) {
  const fromRight = Math.random() > .5
  const start = {
    x: fromRight ? width * randomBetween(.83, 1.02) : width * randomBetween(-.02, .17),
    y: height * randomBetween(.12, .72),
  }
  const end = {
    x: fromRight ? width * randomBetween(.64, .82) : width * randomBetween(.18, .36),
    y: start.y + height * randomBetween(-.12, .12),
  }
  const count = mobile ? 8 : 13
  const points = [start]
  for (let index = 1; index < count; index += 1) {
    const progress = index / count
    points.push({
      x: start.x + (end.x - start.x) * progress + randomBetween(-width * .014, width * .014),
      y: start.y + (end.y - start.y) * progress + randomBetween(-height * .032, height * .032),
    })
  }
  points.push(end)
  return { points, born: now, lifetime: randomBetween(620, 940) }
}

function drawPartialPath(context, points, progress) {
  const last = Math.max(1, Math.min(points.length - 1, Math.ceil(progress * (points.length - 1))))
  context.beginPath()
  context.moveTo(points[0].x, points[0].y)
  for (let index = 1; index <= last; index += 1) context.lineTo(points[index].x, points[index].y)
  context.stroke()
}

export default function PublicCinematicBackground() {
  const canvasRef = useRef(null)
  const haloRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const halo = haloRef.current
    if (!canvas || !halo) return undefined

    const context = canvas.getContext('2d', { alpha: true, desynchronized: true })
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    let frame = 0
    let width = 1
    let height = 1
    let mobile = false
    let particles = []
    let lightning = null
    let nextLightning = 0
    let lastTime = 0
    let haloEnergy = 0

    const resize = () => {
      mobile = window.innerWidth < 720
      const dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1 : 1.5)
      const resolution = mobile ? .72 : .82
      width = Math.max(1, Math.round(window.innerWidth * dpr * resolution))
      height = Math.max(1, Math.round(window.innerHeight * dpr * resolution))
      canvas.width = width
      canvas.height = height
      canvas.style.width = `${window.innerWidth}px`
      canvas.style.height = `${window.innerHeight}px`
      particles = createParticles(width, height, mobile)
      lightning = null
      nextLightning = 0
    }

    const drawLightning = (event, time) => {
      const age = (time - event.born) / event.lifetime
      if (age < 0 || age > 1) return
      const growth = Math.min(1, age / .28)
      const fade = age < .48 ? 1 : Math.max(0, 1 - (age - .48) / .52)
      const pulse = fade * (.72 + Math.sin(age * Math.PI * 17) * .18)
      context.save()
      context.globalCompositeOperation = 'lighter'
      context.lineJoin = 'round'
      context.lineCap = 'round'
      context.strokeStyle = `rgba(255,143,8,${.17 * pulse})`
      context.lineWidth = mobile ? 4 : 7
      drawPartialPath(context, event.points, growth)
      context.strokeStyle = `rgba(255,215,82,${.54 * pulse})`
      context.lineWidth = mobile ? 1 : 1.6
      drawPartialPath(context, event.points, growth)
      context.strokeStyle = `rgba(255,252,221,${.76 * pulse})`
      context.lineWidth = .45
      drawPartialPath(context, event.points, growth)
      context.restore()
      haloEnergy = Math.max(haloEnergy, pulse * .08)
    }

    const renderStatic = () => {
      context.clearRect(0, 0, width, height)
      halo.style.setProperty('--halo-energy', '0')
    }

    const draw = (time) => {
      const delta = Math.min(34, Math.max(0, time - lastTime || 16.7))
      lastTime = time
      context.clearRect(0, 0, width, height)
      context.globalCompositeOperation = 'lighter'

      particles.forEach((particle) => {
        particle.x += particle.vx * delta
        particle.y += particle.vy * delta
        if (particle.y < -4) particle.y = height + 4
        if (particle.x < -4) particle.x = width + 4
        if (particle.x > width + 4) particle.x = -4
        const shimmer = .72 + Math.sin(time * .00065 + particle.phase) * .28
        context.globalAlpha = particle.alpha * shimmer
        context.fillStyle = particle.radius > 1 ? '#fff1b8' : '#ffb20c'
        context.fillRect(particle.x, particle.y, particle.radius, particle.radius)
      })

      if (!nextLightning) nextLightning = time + randomBetween(2400, 5200)
      if (!lightning && time >= nextLightning) {
        lightning = createLightning(width, height, time, mobile)
        nextLightning = time + randomBetween(mobile ? 6500 : 4300, mobile ? 11000 : 8800)
      }
      if (lightning) {
        drawLightning(lightning, time)
        if (time - lightning.born > lightning.lifetime) lightning = null
      }

      haloEnergy *= Math.pow(.9, delta / 16.7)
      halo.style.setProperty('--halo-energy', haloEnergy.toFixed(3))
      context.globalAlpha = 1
      context.globalCompositeOperation = 'source-over'
      if (!document.hidden) frame = requestAnimationFrame(draw)
    }

    const restart = () => {
      cancelAnimationFrame(frame)
      lastTime = 0
      if (motionQuery.matches) renderStatic()
      else frame = requestAnimationFrame(draw)
    }
    const handleVisibility = () => {
      cancelAnimationFrame(frame)
      if (!document.hidden) restart()
    }

    resize()
    restart()
    window.addEventListener('resize', resize, { passive: true })
    document.addEventListener('visibilitychange', handleVisibility)
    motionQuery.addEventListener('change', restart)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', resize)
      document.removeEventListener('visibilitychange', handleVisibility)
      motionQuery.removeEventListener('change', restart)
    }
  }, [])

  return <>
    <div className="cinematic-backdrop" aria-hidden="true" />
    <div className="cinematic-atmosphere" aria-hidden="true">
      <span className="cinematic-smoke" />
      <span ref={haloRef} className="cinematic-hero-halo" />
      <span className="cinematic-body-smoke" />
    </div>
    <div className="cinematic-energy" aria-hidden="true"><canvas ref={canvasRef} /></div>
  </>
}
