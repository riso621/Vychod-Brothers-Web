import { useEffect, useRef } from 'react'

const randomBetween = (min, max) => min + Math.random() * (max - min)

function createParticles(width, height, mobile) {
  const count = mobile ? 18 : 54
  return Array.from({ length: count }, (_, index) => ({
    x: Math.random() * width,
    y: Math.random() * height,
    vx: randomBetween(-0.008, 0.014),
    vy: randomBetween(-0.03, -0.006),
    depth: index < count * .58 ? 0 : index < count * .88 ? 1 : 2,
    radius: index < count * .58 ? randomBetween(.28, .58) : index < count * .88 ? randomBetween(.6, 1.05) : randomBetween(1.3, 2.1),
    alpha: index < count * .58 ? randomBetween(.14, .38) : randomBetween(.28, .7),
    phase: Math.random() * Math.PI * 2,
  }))
}

function createJaggedPath(start, end, count, width, height) {
  const points = [start]
  for (let index = 1; index < count; index += 1) {
    const progress = index / count
    points.push({
      x: start.x + (end.x - start.x) * progress + randomBetween(-width * .014, width * .014),
      y: start.y + (end.y - start.y) * progress + randomBetween(-height * .03, height * .03),
    })
  }
  points.push(end)
  return points
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
  const points = createJaggedPath(start, end, mobile ? 8 : 14, width, height)
  const branchCount = mobile ? 1 : Math.floor(randomBetween(2, 5))
  const branches = Array.from({ length: branchCount }, () => {
    const originIndex = Math.floor(randomBetween(3, points.length - 2))
    const origin = points[originIndex]
    const previous = points[originIndex - 1]
    const direction = Math.atan2(origin.y - previous.y, origin.x - previous.x)
    const angle = direction + (Math.random() > .5 ? 1 : -1) * randomBetween(.65, 1.18)
    const distance = width * randomBetween(.025, mobile ? .055 : .085)
    const branchEnd = { x: origin.x + Math.cos(angle) * distance, y: origin.y + Math.sin(angle) * distance }
    return {
      points: createJaggedPath(origin, branchEnd, mobile ? 4 : 7, width * .45, height * .45),
      delay: randomBetween(.18, .42),
      strength: randomBetween(.42, .72),
    }
  })
  return { points, branches, born: now, lifetime: randomBetween(720, 1080) }
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
    let eventSparks = []
    let nextLightning = 0
    let lastTime = 0
    let haloEnergy = 0

    const resize = () => {
      mobile = window.innerWidth < 720
      const dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1 : 1.5)
      const resolution = mobile ? .72 : window.innerWidth >= 3200 ? .46 : window.innerWidth >= 2200 ? .6 : .82
      width = Math.max(1, Math.round(window.innerWidth * dpr * resolution))
      height = Math.max(1, Math.round(window.innerHeight * dpr * resolution))
      canvas.width = width
      canvas.height = height
      canvas.style.width = `${window.innerWidth}px`
      canvas.style.height = `${window.innerHeight}px`
      particles = createParticles(width, height, mobile)
      lightning = null
      eventSparks = []
      nextLightning = 0
    }

    const emitEventSparks = (event, now) => {
      const anchor = event.points[Math.floor(event.points.length * randomBetween(.45, .85))]
      const amount = mobile ? 4 : 11
      eventSparks.push(...Array.from({ length: amount }, () => ({
        x: anchor.x,
        y: anchor.y,
        vx: randomBetween(-.085, .085),
        vy: randomBetween(-.13, .04),
        born: now + randomBetween(0, 100),
        lifetime: randomBetween(420, 850),
        radius: randomBetween(.7, 1.75),
      })))
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
      const paths = [{ points: event.points, delay: 0, strength: 1 }, ...event.branches]
      paths.forEach((path) => {
        const pathGrowth = Math.max(0, Math.min(1, (growth - path.delay) / Math.max(.2, 1 - path.delay)))
        if (!pathGrowth) return
        const intensity = pulse * path.strength
        context.strokeStyle = `rgba(255,126,0,${.16 * intensity})`
        context.lineWidth = (mobile ? 4 : 8) * path.strength
        drawPartialPath(context, path.points, pathGrowth)
        context.strokeStyle = `rgba(255,211,66,${.56 * intensity})`
        context.lineWidth = (mobile ? 1 : 1.7) * path.strength
        drawPartialPath(context, path.points, pathGrowth)
        context.strokeStyle = `rgba(255,253,226,${.82 * intensity})`
        context.lineWidth = Math.max(.35, .55 * path.strength)
        drawPartialPath(context, path.points, pathGrowth)
      })
      context.restore()
      haloEnergy = Math.max(haloEnergy, pulse * .11)
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
        particle.x += particle.vx * delta * (1 + particle.depth * .45)
        particle.y += particle.vy * delta * (1 + particle.depth * .38)
        if (particle.y < -4) particle.y = height + 4
        if (particle.x < -4) particle.x = width + 4
        if (particle.x > width + 4) particle.x = -4
        const shimmer = .72 + Math.sin(time * .00065 + particle.phase) * .28
        context.globalAlpha = particle.alpha * shimmer
        context.fillStyle = particle.depth === 2 ? '#fff0b0' : '#ffb20c'
        if (particle.depth === 2) {
          context.beginPath()
          context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2)
          context.fill()
        } else context.fillRect(particle.x, particle.y, particle.radius, particle.radius)
      })

      if (!nextLightning) nextLightning = time + randomBetween(2400, 5200)
      if (!lightning && time >= nextLightning) {
        lightning = createLightning(width, height, time, mobile)
        emitEventSparks(lightning, time)
        nextLightning = time + randomBetween(mobile ? 7000 : 4000, mobile ? 12000 : 9000)
      }
      if (lightning) {
        drawLightning(lightning, time)
        if (time - lightning.born > lightning.lifetime) lightning = null
      }

      eventSparks = eventSparks.filter((spark) => time - spark.born < spark.lifetime)
      eventSparks.forEach((spark) => {
        const age = time - spark.born
        if (age < 0) return
        spark.x += spark.vx * delta
        spark.y += spark.vy * delta
        const life = Math.min(1, age / spark.lifetime)
        context.globalAlpha = Math.sin(life * Math.PI) * .86
        context.fillStyle = spark.radius > 1.25 ? '#fff5d0' : '#ffc22e'
        context.fillRect(spark.x, spark.y, spark.radius, spark.radius)
      })

      haloEnergy *= Math.pow(.9, delta / 16.7)
      halo.style.setProperty('--halo-energy', haloEnergy.toFixed(3))
      document.documentElement.style.setProperty('--cinematic-energy', haloEnergy.toFixed(3))
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
      document.documentElement.style.removeProperty('--cinematic-energy')
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
