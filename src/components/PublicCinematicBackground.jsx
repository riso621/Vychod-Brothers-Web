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
  const startX = side === 'left' ? -14 : width + 14
  const startY = height * (.04 + random() * .84)
  const reach = width * (.14 + random() * .18)
  const verticalDrift = height * ((random() - .5) * .34)
  const points = Array.from({ length: 12 }, (_, index) => {
    const progress = index / 11
    const taper = Math.sin(progress * Math.PI)
    return {
      x: startX + direction * reach * progress + (random() - .5) * width * .018 * taper,
      y: startY + verticalDrift * progress + (random() - .5) * height * .06 * taper,
    }
  })
  const branches = points.slice(2, -2).filter((_, index) => index % 3 === 0).map((point) => {
    const length = width * (.025 + random() * .045)
    const rise = height * ((random() - .5) * .075)
    return [point, { x: point.x + direction * length * .48, y: point.y + rise * .4 }, { x: point.x + direction * length, y: point.y + rise }]
  })
  return { points, branches, phase: random() * Math.PI * 2, speed: .00014 + random() * .00012 }
}

function strokePath(context, points) {
  context.beginPath()
  context.moveTo(points[0].x, points[0].y)
  for (let index = 1; index < points.length; index += 1) context.lineTo(points[index].x, points[index].y)
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
      const pixelRatio = Math.min(window.devicePixelRatio || 1, mobile ? 1 : 1.35)
      canvas.width = Math.round(width * pixelRatio)
      canvas.height = Math.round(height * pixelRatio)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
      bolts = [
        ...Array.from({ length: mobile ? 4 : 7 }, (_, index) => createBolt(width, height, 'left', 1103 + index * 739)),
        ...Array.from({ length: mobile ? 4 : 7 }, (_, index) => createBolt(width, height, 'right', 4909 + index * 887)),
      ]
      const random = randomFrom(27183)
      particles = Array.from({ length: mobile ? 56 : 154 }, () => {
        const spark = random() > .82
        return {
          x: random() * width,
          y: random() * height,
          size: spark ? 1.45 + random() * 1.85 : .5 + random() * 1.15,
          velocity: 4 + random() * 14,
          drift: (random() - .5) * 8,
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
        context.strokeStyle = `rgba(245, 197, 18, ${pulse * .84})`
        context.lineWidth = 1.02
        context.shadowColor = 'rgba(255, 190, 8, .9)'
        context.shadowBlur = 14 + pulse * 22
        strokePath(context, bolt.points)
        context.strokeStyle = `rgba(255, 223, 82, ${pulse * .5})`
        context.lineWidth = .66
        bolt.branches.forEach((branch) => strokePath(context, branch))

        if (!motionPreference.matches && index % 2 === 0) {
          const progress = (time * bolt.speed * .72 + bolt.phase) % 1
          const segment = Math.min(Math.floor(progress * (bolt.points.length - 2)), bolt.points.length - 3)
          context.strokeStyle = 'rgba(255, 245, 186, .9)'
          context.lineWidth = 1.15
          context.shadowBlur = 24
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
        context.fillStyle = `rgba(255, 198, 28, ${particle.alpha * shimmer})`
        context.shadowColor = 'rgba(255, 181, 6, .92)'
        context.shadowBlur = particle.spark ? 17 : 6
        context.beginPath()
        context.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2)
        context.fill()
      })
      context.shadowBlur = 0
      if (!motionPreference.matches) animationFrame = requestAnimationFrame(draw)
    }

    const restart = () => {
      cancelAnimationFrame(animationFrame)
      lastFrame = 0
      draw()
    }
    resize()
    draw()
    window.addEventListener('resize', resize, { passive: true })
    motionPreference.addEventListener('change', restart)
    return () => {
      cancelAnimationFrame(animationFrame)
      window.removeEventListener('resize', resize)
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
      <span className="cinematic-pulse" />
    </div>
    <div className="cinematic-energy" aria-hidden="true">
      <canvas ref={canvasRef} />
    </div>
  </>
}
