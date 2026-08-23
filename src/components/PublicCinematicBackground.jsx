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

function createVein(width, height, side, seed) {
  const random = randomFrom(seed)
  const origin = {
    x: side === 'left' ? width * (-.015 + random() * .08) : width * (1.015 - random() * .08),
    y: height * (.08 + random() * .78),
  }
  const makePath = (start, length, angle, segments) => {
    const points = [start]
    let current = start
    let currentAngle = angle
    for (let index = 0; index < segments; index += 1) {
      currentAngle += (random() - .5) * .92
      const step = length / segments * (.64 + random() * .72)
      current = {
        x: current.x + Math.cos(currentAngle) * step,
        y: current.y + Math.sin(currentAngle) * step,
      }
      points.push(current)
    }
    return points
  }
  const trunk = makePath(origin, width * (.1 + random() * .12), (side === 'left' ? 0 : Math.PI) + (random() - .5) * 1.25, 8 + Math.floor(random() * 5))
  const branches = []
  trunk.slice(1, -1).forEach((point, index) => {
    if (random() < .43) return
    const parent = trunk[index + 1]
    const previous = trunk[index]
    const parentAngle = Math.atan2(parent.y - previous.y, parent.x - previous.x)
    const branchAngle = parentAngle + (random() > .5 ? 1 : -1) * (.48 + random() * .78)
    const branch = makePath(point, width * (.025 + random() * .065), branchAngle, 4 + Math.floor(random() * 4))
    branches.push(branch)
    if (random() > .64 && branch.length > 4) {
      const twigOrigin = branch[2 + Math.floor(random() * (branch.length - 3))]
      branches.push(makePath(twigOrigin, width * (.012 + random() * .028), branchAngle + (random() - .5) * 1.7, 3 + Math.floor(random() * 3)))
    }
  })
  return { points: trunk, branches, phase: random() * Math.PI * 2, speed: .00007 + random() * .00007 }
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
    let veins = []
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
      veins = [
        ...Array.from({ length: mobile ? 4 : 11 }, (_, index) => createVein(width, height, 'left', 1103 + index * 739)),
        ...Array.from({ length: mobile ? 4 : 11 }, (_, index) => createVein(width, height, 'right', 4909 + index * 887)),
      ]
      const random = randomFrom(27183)
      particles = Array.from({ length: mobile ? 120 : 560 }, () => {
        const depth = random()
        const spark = depth > .83
        const flare = depth > .96
        return {
          x: random() * width,
          y: random() * height,
          size: flare ? 2.4 + random() * 2.1 : spark ? 1.05 + random() * 1.7 : .42 + random() * 1.02,
          velocity: 1.5 + depth * 13,
          drift: (random() - .5) * (4 + depth * 10),
          alpha: flare ? .96 : spark ? .64 + random() * .34 : .32 + random() * .5,
          phase: random() * Math.PI * 2,
          spark,
          flare,
          depth,
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

      veins.forEach((vein, index) => {
        const pulse = motionPreference.matches ? .42 : .16 + (.5 + Math.sin(time * vein.speed + vein.phase) * .5) * .7
        context.save()
        context.lineCap = 'round'
        context.lineJoin = 'round'
        context.strokeStyle = `rgba(242, 171, 4, ${pulse * .88})`
        context.lineWidth = 1.15 + (index % 3) * .27
        context.shadowColor = 'rgba(255, 190, 8, .9)'
        context.shadowBlur = 11 + pulse * 27
        strokePath(context, vein.points)
        context.strokeStyle = `rgba(255, 225, 104, ${pulse * .62})`
        context.lineWidth = .58 + (index % 2) * .22
        vein.branches.forEach((branch) => strokePath(context, branch))
        vein.branches.forEach((branch, branchIndex) => {
          if ((branchIndex + index) % 3 !== 0) return
          const node = branch.at(-1)
          context.fillStyle = `rgba(255, 229, 124, ${pulse * .72})`
          context.shadowBlur = 18 + pulse * 18
          context.beginPath()
          context.arc(node.x, node.y, .8 + pulse * 1.25, 0, Math.PI * 2)
          context.fill()
        })

        if (!motionPreference.matches && index % 2 === 0) {
          const progress = (time * vein.speed * .46 + vein.phase) % 1
          const segment = Math.min(Math.floor(progress * (vein.points.length - 2)), vein.points.length - 3)
          context.strokeStyle = 'rgba(255, 245, 186, .9)'
          context.lineWidth = 1.35
          context.shadowBlur = 30
          strokePath(context, vein.points.slice(segment, segment + 3))
          const flare = vein.points[segment + 1]
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
        context.shadowBlur = particle.flare ? 28 : particle.spark ? 15 : 4
        context.beginPath()
        context.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2)
        context.fill()
        if (particle.flare) {
          context.strokeStyle = `rgba(255, 225, 101, ${Math.max(0, shimmer * .7)})`
          context.lineWidth = .65
          context.beginPath()
          context.moveTo(particle.x - 8, particle.y)
          context.lineTo(particle.x + 8, particle.y)
          context.moveTo(particle.x, particle.y - 8)
          context.lineTo(particle.x, particle.y + 8)
          context.stroke()
        }
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
      <span className="cinematic-body-smoke" />
      <span className="cinematic-pulse" />
    </div>
    <div className="cinematic-energy" aria-hidden="true">
      <canvas ref={canvasRef} />
    </div>
  </>
}
