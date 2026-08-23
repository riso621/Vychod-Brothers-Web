import { useEffect, useRef } from 'react'

function randomFrom(seed) {
  let value = seed >>> 0
  return () => {
    value += 0x6d2b79f5
    let result = value
    result = Math.imul(result ^ result >>> 15, result | 1)
    result ^= result + Math.imul(result ^ result >>> 7, result | 61)
    return ((result ^ result >>> 14) >>> 0) / 4294967296
  }
}

function createBolt(width, height, side, seed) {
  const random = randomFrom(seed)
  const direction = side === 'left' ? 1 : -1
  const startX = side === 'left' ? -18 : width + 18
  const startY = height * (.06 + random() * .82)
  const reach = width * (.22 + random() * .19)
  const verticalDrift = height * ((random() - .5) * .42)
  const pointCount = 19
  let previousNoise = 0
  const points = Array.from({ length: pointCount }, (_, index) => {
    const progress = index / (pointCount - 1)
    const taper = Math.sin(progress * Math.PI)
    previousNoise = previousNoise * .42 + (random() - .5) * .58
    return {
      x: startX + direction * reach * progress + previousNoise * width * .028 * taper,
      y: startY + verticalDrift * progress + (random() - .5) * height * .045 * taper,
    }
  })
  const branches = points.slice(3, -3).filter(() => random() > .62).map((point) => {
    const length = width * (.035 + random() * .07)
    const rise = height * ((random() - .5) * .12)
    return Array.from({ length: 6 }, (_, index) => {
      const progress = index / 5
      return {
        x: point.x + direction * length * progress + (random() - .5) * width * .008,
        y: point.y + rise * progress + (random() - .5) * height * .016,
      }
    })
  })
  return { points, branches, phase: random() * Math.PI * 2, speed: .00009 + random() * .00008 }
}

function strokePath(context, points) {
  context.beginPath()
  context.moveTo(points[0].x, points[0].y)
  for (let index = 1; index < points.length - 1; index += 1) {
    const midpointX = (points[index].x + points[index + 1].x) / 2
    const midpointY = (points[index].y + points[index + 1].y) / 2
    context.quadraticCurveTo(points[index].x, points[index].y, midpointX, midpointY)
  }
  context.lineTo(points.at(-1).x, points.at(-1).y)
  context.stroke()
}

export default function PublicCinematicBackground() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined
    const context = canvas.getContext('2d', { alpha: true })
    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)')
    let animationFrame = 0
    let width = 0
    let height = 0
    let bolts = []
    let particles = []
    let lastFrame = 0

    const resize = () => {
      width = window.innerWidth
      height = window.innerHeight
      const mobile = width < 720
      const pixelRatio = Math.min(window.devicePixelRatio || 1, mobile ? 1 : 1.45)
      canvas.width = Math.round(width * pixelRatio)
      canvas.height = Math.round(height * pixelRatio)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
      bolts = [
        ...Array.from({ length: mobile ? 3 : 5 }, (_, index) => createBolt(width, height, 'left', 1103 + index * 739)),
        ...Array.from({ length: mobile ? 3 : 5 }, (_, index) => createBolt(width, height, 'right', 4909 + index * 887)),
      ]
      const random = randomFrom(27183)
      particles = Array.from({ length: mobile ? 68 : 230 }, () => {
        const spark = random() > .78
        return {
          x: random() * width,
          y: random() * height,
          size: spark ? 1.35 + random() * 2.15 : .4 + random() * 1.05,
          velocity: 3 + random() * 12,
          drift: (random() - .5) * 10,
          alpha: spark ? .7 + random() * .28 : .3 + random() * .52,
          phase: random() * Math.PI * 2,
          spark,
        }
      })
    }

    const draw = (time = 0) => {
      if (!motionPreference.matches && time - lastFrame < 32) {
        animationFrame = requestAnimationFrame(draw)
        return
      }
      const delta = lastFrame ? Math.min((time - lastFrame) / 1000, .08) : 0
      lastFrame = time
      context.clearRect(0, 0, width, height)

      bolts.forEach((bolt, index) => {
        const pulse = motionPreference.matches ? .42 : .3 + (.5 + Math.sin(time * bolt.speed + bolt.phase) * .5) * .36
        context.save()
        context.lineCap = 'round'
        context.lineJoin = 'round'
        context.strokeStyle = `rgba(245, 184, 10, ${pulse * .88})`
        context.lineWidth = 1.15
        context.shadowColor = 'rgba(255, 190, 8, .9)'
        context.shadowBlur = 12 + pulse * 24
        strokePath(context, bolt.points)
        context.strokeStyle = `rgba(255, 224, 91, ${pulse * .48})`
        context.lineWidth = .62
        bolt.branches.forEach((branch) => strokePath(context, branch))

        if (!motionPreference.matches && index % 2 === 0) {
          const progress = (time * bolt.speed * .72 + bolt.phase) % 1
          const segment = Math.min(Math.floor(progress * (bolt.points.length - 2)), bolt.points.length - 3)
          context.strokeStyle = 'rgba(255, 245, 186, .9)'
          context.lineWidth = 1.15
          context.shadowBlur = 30
          strokePath(context, bolt.points.slice(segment, segment + 3))
          const flare = bolt.points[segment + 1]
          context.fillStyle = 'rgba(255, 249, 205, .96)'
          context.beginPath()
          context.arc(flare.x, flare.y, 1.6, 0, Math.PI * 2)
          context.fill()
        }
        context.restore()
      })

      particles.forEach((particle) => {
        if (!motionPreference.matches) {
          particle.y -= particle.velocity * delta
          particle.x += particle.drift * delta
          if (particle.y < -10) particle.y = height + 10
          if (particle.x < -10) particle.x = width + 10
          if (particle.x > width + 10) particle.x = -10
        }
        const shimmer = motionPreference.matches ? .55 : .48 + Math.sin(time * .0013 + particle.phase) * .4
        context.fillStyle = `rgba(255, 198, 28, ${Math.min(1, particle.alpha * shimmer * 1.32)})`
        context.shadowColor = 'rgba(255, 181, 6, .92)'
        context.shadowBlur = particle.spark ? 17 : 6
        context.beginPath()
        context.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2)
        context.fill()
      })
      context.shadowBlur = 0
      if (!motionPreference.matches && !document.hidden) animationFrame = requestAnimationFrame(draw)
    }

    const restart = () => {
      cancelAnimationFrame(animationFrame)
      lastFrame = 0
      draw()
    }
    resize()
    draw()
    const handleVisibility = () => {
      cancelAnimationFrame(animationFrame)
      if (!document.hidden) restart()
    }
    window.addEventListener('resize', resize, { passive: true })
    document.addEventListener('visibilitychange', handleVisibility)
    motionPreference.addEventListener('change', restart)
    return () => {
      cancelAnimationFrame(animationFrame)
      window.removeEventListener('resize', resize)
      document.removeEventListener('visibilitychange', handleVisibility)
      motionPreference.removeEventListener('change', restart)
    }
  }, [])

  return <>
    <div className="cinematic-backdrop" aria-hidden="true">
      <span className="cinematic-haze cinematic-haze--left" />
      <span className="cinematic-haze cinematic-haze--right" />
      <span className="cinematic-grain" />
    </div>
    <div className="cinematic-atmosphere" aria-hidden="true">
      <span className="cinematic-smoke" />
      <span className="cinematic-beams" />
      <span className="cinematic-glow cinematic-glow--left" />
      <span className="cinematic-glow cinematic-glow--right" />
      <span className="cinematic-hero-halo" />
      <span className="cinematic-pulse" />
    </div>
    <div className="cinematic-energy" aria-hidden="true">
      <canvas ref={canvasRef} />
    </div>
  </>
}
