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

function displaceLine(start, end, depth, roughness, random) {
  if (depth === 0) return [start, end]
  const dx = end.x - start.x
  const dy = end.y - start.y
  const length = Math.hypot(dx, dy) || 1
  const midpoint = {
    x: (start.x + end.x) / 2 - dy / length * (random() - .5) * roughness,
    y: (start.y + end.y) / 2 + dx / length * (random() - .5) * roughness,
  }
  const left = displaceLine(start, midpoint, depth - 1, roughness * .55, random)
  const right = displaceLine(midpoint, end, depth - 1, roughness * .55, random)
  return [...left.slice(0, -1), ...right]
}

function createLightning(width, height, position, seed) {
  const random = randomFrom(seed)
  let start
  let end
  if (position === 'left') {
    start = { x: width * (-.015 + random() * .075), y: height * (-.04 + random() * .18) }
    end = { x: width * (.015 + random() * .12), y: height * (.58 + random() * .46) }
  } else if (position === 'right') {
    start = { x: width * (1.015 - random() * .075), y: height * (-.04 + random() * .18) }
    end = { x: width * (.985 - random() * .12), y: height * (.58 + random() * .46) }
  } else {
    const direction = random() > .5 ? 1 : -1
    start = { x: width * (.54 + random() * .17), y: height * (.08 + random() * .29) }
    end = { x: start.x + direction * width * (.055 + random() * .14), y: start.y + height * ((random() - .34) * .2) }
  }
  const points = displaceLine(start, end, position === 'center' ? 6 : 7, width * (position === 'center' ? .028 : .046), random)
  const branches = []
  const branchCount = position === 'center' ? 4 : 7
  for (let index = 0; index < branchCount; index += 1) {
    const pointIndex = 3 + Math.floor(random() * Math.max(2, points.length - 7))
    const origin = points[pointIndex]
    const parentNext = points[Math.min(pointIndex + 1, points.length - 1)]
    const angle = Math.atan2(parentNext.y - origin.y, parentNext.x - origin.x) + (random() > .5 ? 1 : -1) * (.55 + random() * .8)
    const length = width * (.018 + random() * (position === 'center' ? .045 : .075))
    const branchEnd = { x: origin.x + Math.cos(angle) * length, y: origin.y + Math.sin(angle) * length }
    branches.push(displaceLine(origin, branchEnd, 4, width * .018, random))
  }
  return { points, branches, phase: random() * Math.PI * 2, speed: .000055 + random() * .00007 }
}

function strokePolyline(context, points) {
  context.beginPath()
  context.moveTo(points[0].x, points[0].y)
  for (let index = 1; index < points.length; index += 1) context.lineTo(points[index].x, points[index].y)
  context.stroke()
}

function drawLightning(context, lightning, intensity) {
  const paths = [lightning.points, ...lightning.branches]
  context.save()
  context.lineCap = 'round'
  context.lineJoin = 'round'
  context.globalCompositeOperation = 'screen'
  paths.forEach((points, index) => {
    const branchScale = index === 0 ? 1 : .56
    context.shadowColor = 'rgba(255, 137, 0, .96)'
    context.shadowBlur = 48 * intensity * branchScale
    context.strokeStyle = `rgba(255, 126, 0, ${.1 * intensity * branchScale})`
    context.lineWidth = 22 * branchScale
    strokePolyline(context, points)
    context.shadowBlur = 22 * intensity * branchScale
    context.strokeStyle = `rgba(255, 166, 0, ${.5 * intensity * branchScale})`
    context.lineWidth = 4.8 * branchScale
    strokePolyline(context, points)
    context.shadowBlur = 7 * intensity * branchScale
    context.strokeStyle = `rgba(255, 246, 199, ${.95 * intensity * branchScale})`
    context.lineWidth = 1.18 * branchScale
    strokePolyline(context, points)
  })
  context.restore()
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
    let lastFrame = 0
    let lightnings = []
    let clouds = []
    let particles = []

    const resize = () => {
      width = window.innerWidth
      height = window.innerHeight
      const mobile = width < 720
      const pixelRatio = Math.min(window.devicePixelRatio || 1, mobile ? 1 : 1.3)
      canvas.width = Math.round(width * pixelRatio)
      canvas.height = Math.round(height * pixelRatio)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
      lightnings = [
        ...Array.from({ length: mobile ? 2 : 4 }, (_, index) => createLightning(width, height, 'left', 1301 + index * 977)),
        ...Array.from({ length: mobile ? 2 : 4 }, (_, index) => createLightning(width, height, 'right', 4603 + index * 1061)),
        ...Array.from({ length: mobile ? 3 : 9 }, (_, index) => createLightning(width, height, 'center', 8101 + index * 1217)),
      ]
      const random = randomFrom(29713)
      clouds = Array.from({ length: mobile ? 25 : 70 }, (_, index) => ({
        x: index < (mobile ? 18 : 54) ? width * (.37 + random() * .46) : random() * width,
        y: index < (mobile ? 18 : 54) ? height * (.035 + random() * .53) : random() * height,
        radius: width * (.018 + random() * .09),
        alpha: .022 + random() * .09,
        phase: random() * Math.PI * 2,
        driftX: (random() - .5) * 13,
        driftY: (random() - .5) * 9,
      }))
      const dustCount = mobile ? 500 : 2300
      const sparkCount = mobile ? 68 : 280
      const bokehCount = mobile ? 18 : 68
      particles = Array.from({ length: dustCount + sparkCount + bokehCount }, (_, index) => {
        const type = index < dustCount ? 'dust' : index < dustCount + sparkCount ? 'spark' : 'bokeh'
        return {
          type,
          x: random() * width,
          y: random() * height,
          size: type === 'dust' ? .35 + random() * .95 : type === 'spark' ? .9 + random() * 2.35 : 2.5 + random() * 6,
          alpha: type === 'dust' ? .18 + random() * .52 : type === 'spark' ? .58 + random() * .4 : .07 + random() * .16,
          speed: type === 'dust' ? .7 + random() * 3.2 : type === 'spark' ? 2 + random() * 8 : .2 + random() * 1.2,
          drift: (random() - .5) * (type === 'spark' ? 7 : 3),
          phase: random() * Math.PI * 2,
        }
      })
    }

    const draw = (time = 0) => {
      const frameInterval = width < 720 ? 40 : 32
      if (!motionPreference.matches && time - lastFrame < frameInterval) {
        animationFrame = requestAnimationFrame(draw)
        return
      }
      const delta = lastFrame ? Math.min((time - lastFrame) / 1000, .08) : 0
      lastFrame = time
      context.clearRect(0, 0, width, height)
      context.save()
      context.globalCompositeOperation = 'screen'
      clouds.forEach((cloud) => {
        const breathe = motionPreference.matches ? .72 : .68 + Math.sin(time * .00012 + cloud.phase) * .22
        const x = cloud.x + Math.sin(time * .000035 + cloud.phase) * cloud.driftX
        const y = cloud.y + Math.cos(time * .000028 + cloud.phase) * cloud.driftY
        const gradient = context.createRadialGradient(x, y, 0, x, y, cloud.radius)
        gradient.addColorStop(0, `rgba(255, 187, 22, ${cloud.alpha * breathe})`)
        gradient.addColorStop(.24, `rgba(231, 118, 0, ${cloud.alpha * .58 * breathe})`)
        gradient.addColorStop(.62, `rgba(96, 42, 0, ${cloud.alpha * .16 * breathe})`)
        gradient.addColorStop(1, 'rgba(0,0,0,0)')
        context.fillStyle = gradient
        context.fillRect(x - cloud.radius, y - cloud.radius, cloud.radius * 2, cloud.radius * 2)
      })
      context.restore()

      lightnings.forEach((lightning) => {
        const wave = .5 + Math.sin(time * lightning.speed + lightning.phase) * .5
        const occasionalPulse = Math.pow(Math.max(0, Math.sin(time * lightning.speed * .37 + lightning.phase * 1.7)), 12)
        const intensity = motionPreference.matches ? .68 : .34 + wave * .58 + occasionalPulse * .78
        drawLightning(context, lightning, intensity)
      })

      particles.forEach((particle) => {
        if (!motionPreference.matches) {
          particle.y -= particle.speed * delta
          particle.x += particle.drift * delta
          if (particle.y < -12) particle.y = height + 12
          if (particle.x < -12) particle.x = width + 12
          if (particle.x > width + 12) particle.x = -12
        }
        const shimmer = motionPreference.matches ? .65 : .62 + Math.sin(time * .0007 + particle.phase) * .36
        context.save()
        context.globalCompositeOperation = 'screen'
        context.fillStyle = `rgba(255, 174, 9, ${particle.alpha * shimmer})`
        context.shadowColor = 'rgba(255, 139, 0, .95)'
        context.shadowBlur = particle.type === 'spark' ? 15 : particle.type === 'bokeh' ? 22 : 3
        context.beginPath()
        context.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2)
        context.fill()
        if (particle.type === 'spark' && particle.size > 2.25) {
          context.strokeStyle = `rgba(255, 239, 164, ${particle.alpha * shimmer * .78})`
          context.lineWidth = .55
          context.beginPath()
          context.moveTo(particle.x - 6, particle.y)
          context.lineTo(particle.x + 6, particle.y)
          context.moveTo(particle.x, particle.y - 6)
          context.lineTo(particle.x, particle.y + 6)
          context.stroke()
        }
        context.restore()
      })
      if (!motionPreference.matches && !document.hidden) animationFrame = requestAnimationFrame(draw)
    }

    const restart = () => {
      cancelAnimationFrame(animationFrame)
      lastFrame = 0
      draw()
    }
    const handleVisibility = () => {
      cancelAnimationFrame(animationFrame)
      if (!document.hidden) restart()
    }
    resize()
    draw()
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
      <span className="cinematic-body-smoke" />
      <span className="cinematic-pulse" />
    </div>
    <div className="cinematic-energy" aria-hidden="true">
      <canvas ref={canvasRef} />
    </div>
  </>
}
