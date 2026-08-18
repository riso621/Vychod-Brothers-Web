import { useEffect, useRef } from 'react'

function seeded(seed) {
  let value = seed >>> 0
  return () => ((value = Math.imul(value ^ value >>> 15, 1 | value) + 0x6d2b79f5 | 0, ((value ^ value >>> 14) >>> 0) / 4294967296))
}

function createVein(width, height, side, seed) {
  const random = seeded(seed)
  const direction = side === 'left' ? 1 : -1
  const origin = side === 'left' ? -10 : width + 10
  const points = [{ x: origin, y: height * (.08 + random() * .18) }]
  for (let index = 1; index <= 8; index += 1) {
    points.push({ x: origin + direction * width * (.035 * index + random() * .035), y: points[index - 1].y + height * (.075 + random() * .075) })
  }
  const branches = points.slice(2, -1).filter((_, index) => index % 2 === 0).map((point) => {
    const branchDirection = random() > .5 ? 1 : -1
    return [point, { x: point.x + direction * width * (.045 + random() * .055), y: point.y + branchDirection * height * (.035 + random() * .07) }, { x: point.x + direction * width * (.075 + random() * .07), y: point.y + branchDirection * height * (.07 + random() * .08) }]
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
      particles = Array.from({ length: width < 720 ? 24 : 58 }, () => ({ x: random() * width, y: random() * height, radius: .35 + random() * 1.15, speed: 2 + random() * 7, drift: (random() - .5) * 4, alpha: .22 + random() * .58, phase: random() * Math.PI * 2 }))
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
        context.strokeStyle = `rgba(242, 199, 24, ${pulse * .34})`
        context.lineWidth = 1.05
        context.shadowColor = 'rgba(255, 204, 25, .75)'
        context.shadowBlur = 7 + pulse * 8
        drawPath(context, vein.points)
        context.strokeStyle = `rgba(255, 225, 92, ${pulse * .24})`
        context.lineWidth = .65
        vein.branches.forEach((branch) => drawPath(context, branch))
        if (!reducedMotion.matches) {
          const segment = Math.floor((time * .00024 + index * .43) % .78 * (vein.points.length - 1))
          context.strokeStyle = 'rgba(255, 236, 139, .78)'
          context.lineWidth = 1.45
          context.shadowBlur = 15
          drawPath(context, vein.points.slice(segment, Math.min(segment + 3, vein.points.length)))
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
        context.shadowBlur = particle.radius * 5
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

  return <div className="public-cinematic-background" aria-hidden="true">
    <span className="public-cinematic-haze is-one" />
    <span className="public-cinematic-haze is-two" />
    <span className="public-cinematic-smoke" />
    <span className="public-cinematic-beams" />
    <span className="public-cinematic-pulse" />
    <canvas ref={canvasRef} className="public-cinematic-energy" />
    <span className="public-cinematic-grain" />
  </div>
}
