import { useEffect, useRef } from 'react'

function seeded(seed) {
  let value = seed >>> 0
  return () => ((value = Math.imul(value ^ value >>> 15, 1 | value) + 0x6d2b79f5 | 0, ((value ^ value >>> 14) >>> 0) / 4294967296))
}

function createVein(width, height, side, seed) {
  const random = seeded(seed)
  const direction = side === 'left' ? 1 : -1
  const origin = side === 'left' ? -10 : width + 10
  const points = [{ x: origin, y: height * (.03 + random() * .12) }]
  for (let index = 1; index <= 14; index += 1) {
    points.push({ x: origin + direction * width * (.012 * index + random() * .026), y: points[index - 1].y + height * (.045 + random() * .038) })
  }
  const branches = points.slice(2, -1).filter((_, index) => index % 3 === 0).map((point) => {
    const branchDirection = random() > .5 ? 1 : -1
    return [point, { x: point.x + direction * width * (.022 + random() * .035), y: point.y + branchDirection * height * (.018 + random() * .035) }, { x: point.x + direction * width * (.045 + random() * .04), y: point.y + branchDirection * height * (.045 + random() * .045) }]
  })
  return { points, branches, phase: random() * Math.PI * 2 }
}

function drawPath(context, points) {
  context.beginPath()
  context.moveTo(points[0].x, points[0].y)
  points.slice(1).forEach((point) => context.lineTo(point.x, point.y))
  context.stroke()
}

export default function PublicCinematicBackground() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined
    const context = canvas.getContext('2d', { alpha: true })
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let frame = 0
    let width = 0
    let height = 0
    let veins = []
    let particles = []
    let lastTime = 0

    const resize = () => {
      width = window.innerWidth
      height = window.innerHeight
      const dpr = Math.min(window.devicePixelRatio || 1, width < 720 ? 1 : 1.4)
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      context.setTransform(dpr, 0, 0, dpr, 0, 0)
      veins = [createVein(width, height, 'left', 9271), createVein(width, height, 'right', 4813)]
      const random = seeded(71237)
      particles = Array.from({ length: width < 720 ? 34 : 88 }, () => {
        const bright = random() > .84
        return { x: random() * width, y: random() * height, radius: bright ? 1.35 + random() * 1.15 : .45 + random() * 1.15, speed: 2 + random() * 8, drift: (random() - .5) * 5, alpha: bright ? .62 + random() * .32 : .24 + random() * .48, phase: random() * Math.PI * 2, bright }
      })
    }

    const render = (time = 0) => {
      if (!reducedMotion.matches && time - lastTime < 32) {
        frame = requestAnimationFrame(render)
        return
      }
      const delta = lastTime ? Math.min((time - lastTime) / 1000, .08) : 0
      lastTime = time
      context.clearRect(0, 0, width, height)
      veins.forEach((vein, index) => {
        const pulse = reducedMotion.matches ? .62 : .48 + Math.sin(time * .00034 + vein.phase) * .2
        context.save()
        context.lineCap = 'round'
        context.lineJoin = 'round'
        context.strokeStyle = `rgba(242, 199, 24, ${pulse * .48})`
        context.lineWidth = .9
        context.shadowColor = 'rgba(255, 204, 25, .9)'
        context.shadowBlur = 9 + pulse * 11
        drawPath(context, vein.points)
        context.strokeStyle = `rgba(255, 225, 92, ${pulse * .24})`
        context.lineWidth = .65
        vein.branches.forEach((branch) => drawPath(context, branch))
        if (!reducedMotion.matches) {
          const segment = Math.floor((time * .00024 + index * .43) % .78 * (vein.points.length - 1))
          context.strokeStyle = 'rgba(255, 239, 153, .9)'
          context.lineWidth = 1.25
          context.shadowBlur = 19
          drawPath(context, vein.points.slice(segment, Math.min(segment + 3, vein.points.length)))
          const flare = vein.points[Math.min(segment + 1, vein.points.length - 1)]
          context.fillStyle = 'rgba(255, 244, 181, .94)'
          context.shadowColor = 'rgba(255, 205, 28, .96)'
          context.shadowBlur = 24
          context.beginPath()
          context.arc(flare.x, flare.y, 1.75, 0, Math.PI * 2)
          context.fill()
        }
        context.restore()
      })
      particles.forEach((particle) => {
        if (!reducedMotion.matches) {
          particle.y -= particle.speed * delta
          particle.x += particle.drift * delta
          if (particle.y < -8) particle.y = height + 8
          if (particle.x < -8) particle.x = width + 8
          if (particle.x > width + 8) particle.x = -8
        }
        const shimmer = reducedMotion.matches ? .65 : .55 + Math.sin(time * .0011 + particle.phase) * .35
        context.beginPath()
        context.fillStyle = `rgba(255, 205, 51, ${particle.alpha * shimmer})`
        context.shadowColor = 'rgba(255, 190, 21, .8)'
        context.shadowBlur = particle.bright ? particle.radius * 8 : particle.radius * 5
        context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2)
        context.fill()
      })
      context.shadowBlur = 0
      if (!reducedMotion.matches) frame = requestAnimationFrame(render)
    }

    resize()
    render()
    window.addEventListener('resize', resize, { passive: true })
    const handleMotionChange = () => {
      cancelAnimationFrame(frame)
      lastTime = 0
      render()
    }
    reducedMotion.addEventListener('change', handleMotionChange)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', resize)
      reducedMotion.removeEventListener('change', handleMotionChange)
    }
  }, [])

  return <>
    <div className="public-cinematic-background public-cinematic-back" aria-hidden="true">
      <span className="public-cinematic-haze is-one" />
      <span className="public-cinematic-haze is-two" />
      <span className="public-cinematic-pulse" />
      <span className="public-cinematic-grain" />
    </div>
    <div className="public-cinematic-atmosphere" aria-hidden="true">
      <span className="public-cinematic-smoke" />
      <span className="public-cinematic-beams" />
      <span className="public-cinematic-atmosphere-glow is-left" />
      <span className="public-cinematic-atmosphere-glow is-right" />
    </div>
    <div className="public-cinematic-edge" aria-hidden="true">
      <canvas ref={canvasRef} className="public-cinematic-energy" />
    </div>
  </>
}
