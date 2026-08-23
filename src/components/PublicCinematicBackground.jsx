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

function displacedLine(start, end, depth, roughness, random) {
  if (depth === 0) return [start, end]
  const dx = end.x - start.x
  const dy = end.y - start.y
  const length = Math.hypot(dx, dy) || 1
  const midpoint = {
    x: (start.x + end.x) / 2 - dy / length * (random() - .5) * roughness,
    y: (start.y + end.y) / 2 + dx / length * (random() - .5) * roughness,
  }
  const left = displacedLine(start, midpoint, depth - 1, roughness * .53, random)
  const right = displacedLine(midpoint, end, depth - 1, roughness * .53, random)
  return [...left.slice(0, -1), ...right]
}

function createBolt(width, height, placement, seed) {
  const random = randomFrom(seed)
  let start
  let end
  if (placement === 'left') {
    start = { x: width * (-.01 + random() * .06), y: height * (-.02 + random() * .12) }
    end = { x: width * (.035 + random() * .09), y: height * (.67 + random() * .3) }
  } else if (placement === 'right') {
    start = { x: width * (1.01 - random() * .06), y: height * (-.02 + random() * .12) }
    end = { x: width * (.965 - random() * .09), y: height * (.67 + random() * .3) }
  } else {
    const direction = random() > .5 ? 1 : -1
    start = { x: width * (.53 + random() * .2), y: height * (.08 + random() * .27) }
    end = {
      x: start.x + direction * width * (.05 + random() * .13),
      y: start.y + height * ((random() - .35) * .2),
    }
  }
  const depth = placement === 'team' ? 6 : 7
  const points = displacedLine(start, end, depth, width * (placement === 'team' ? .026 : .043), random)
  const branches = []
  const branchCount = placement === 'team' ? 4 : 6
  for (let index = 0; index < branchCount; index += 1) {
    const pointIndex = 4 + Math.floor(random() * Math.max(2, points.length - 9))
    const origin = points[pointIndex]
    const next = points[Math.min(pointIndex + 1, points.length - 1)]
    const angle = Math.atan2(next.y - origin.y, next.x - origin.x)
      + (random() > .5 ? 1 : -1) * (.62 + random() * .72)
    const branchLength = width * (.018 + random() * (placement === 'team' ? .04 : .065))
    const branchEnd = {
      x: origin.x + Math.cos(angle) * branchLength,
      y: origin.y + Math.sin(angle) * branchLength,
    }
    branches.push(displacedLine(origin, branchEnd, 4, width * .014, random))
  }
  return { points, branches, alpha: .52 + random() * .42, phase: random() * Math.PI * 2 }
}

function strokePath(context, points) {
  context.beginPath()
  context.moveTo(points[0].x, points[0].y)
  for (let index = 1; index < points.length; index += 1) context.lineTo(points[index].x, points[index].y)
  context.stroke()
}

function drawBolt(context, bolt, intensity) {
  const paths = [bolt.points, ...bolt.branches]
  context.save()
  context.lineCap = 'round'
  context.lineJoin = 'round'
  paths.forEach((points, index) => {
    const scale = index === 0 ? 1 : .5
    context.shadowColor = 'rgba(255, 132, 0, .8)'
    context.shadowBlur = 26 * intensity * scale
    context.strokeStyle = `rgba(255, 118, 0, ${.14 * intensity * scale})`
    context.lineWidth = 16 * scale
    strokePath(context, points)
    context.shadowBlur = 12 * intensity * scale
    context.strokeStyle = `rgba(255, 175, 8, ${.54 * intensity * scale})`
    context.lineWidth = 3.2 * scale
    strokePath(context, points)
    context.shadowBlur = 4 * intensity * scale
    context.strokeStyle = `rgba(255, 248, 205, ${.92 * intensity * scale})`
    context.lineWidth = .85 * scale
    strokePath(context, points)
  })
  context.restore()
}

function makeLayer(width, height) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return { canvas, context: canvas.getContext('2d', { alpha: true }) }
}

function createDustLayer(width, height, mobile, seed) {
  const layer = makeLayer(width, height)
  const random = randomFrom(seed)
  const count = mobile ? 360 : 1320
  for (let index = 0; index < count; index += 1) {
    const x = random() * width
    const y = random() * height
    const size = .3 + random() * 1.2
    const alpha = .13 + random() * .55
    layer.context.fillStyle = `rgba(255, 171, 10, ${alpha})`
    layer.context.fillRect(x, y, size, size)
  }
  return layer.canvas
}

function createPlasmaLayer(width, height, mobile) {
  const layer = makeLayer(width, height)
  const random = randomFrom(61873)
  const count = mobile ? 24 : 58
  layer.context.globalCompositeOperation = 'screen'
  for (let index = 0; index < count; index += 1) {
    const teamCloud = index < count * .78
    const x = teamCloud ? width * (.4 + random() * .42) : random() * width
    const y = teamCloud ? height * (.04 + random() * .5) : random() * height
    const radius = width * (.018 + random() * .082)
    const alpha = .025 + random() * .095
    const gradient = layer.context.createRadialGradient(x, y, 0, x, y, radius)
    gradient.addColorStop(0, `rgba(255, 209, 72, ${alpha})`)
    gradient.addColorStop(.18, `rgba(255, 133, 0, ${alpha * .75})`)
    gradient.addColorStop(.48, `rgba(111, 43, 0, ${alpha * .26})`)
    gradient.addColorStop(1, 'rgba(0,0,0,0)')
    layer.context.fillStyle = gradient
    layer.context.fillRect(x - radius, y - radius, radius * 2, radius * 2)
  }
  const nodeCount = mobile ? 12 : 38
  for (let index = 0; index < nodeCount; index += 1) {
    const x = index < nodeCount * .7 ? width * (.38 + random() * .48) : random() * width
    const y = random() * height * .72
    const radius = 3 + random() * 10
    const glow = layer.context.createRadialGradient(x, y, 0, x, y, radius)
    glow.addColorStop(0, `rgba(255, 250, 208, ${.45 + random() * .42})`)
    glow.addColorStop(.15, `rgba(255, 179, 8, ${.32 + random() * .3})`)
    glow.addColorStop(1, 'rgba(255, 118, 0, 0)')
    layer.context.fillStyle = glow
    layer.context.fillRect(x - radius, y - radius, radius * 2, radius * 2)
  }
  return layer.canvas
}

export default function PublicCinematicBackground() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined
    const context = canvas.getContext('2d', { alpha: true })
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let animationFrame = 0
    let width = 0
    let height = 0
    let dustFar
    let dustNear
    let plasma
    let lightningLayer
    let bolts = []
    let activeSparks = []
    let lastLightningDraw = 0

    const rebuildBolts = (mobile) => {
      bolts = [
        ...Array.from({ length: mobile ? 1 : 3 }, (_, index) => createBolt(width, height, 'left', 1301 + index * 977)),
        ...Array.from({ length: mobile ? 1 : 3 }, (_, index) => createBolt(width, height, 'right', 4603 + index * 1061)),
        ...Array.from({ length: mobile ? 2 : 6 }, (_, index) => createBolt(width, height, 'team', 8101 + index * 1217)),
      ]
    }

    const resize = () => {
      const mobile = window.innerWidth < 720
      const renderScale = mobile ? .72 : window.innerWidth > 2200 ? .7 : .82
      width = Math.max(1, Math.round(window.innerWidth * renderScale))
      height = Math.max(1, Math.round(window.innerHeight * renderScale))
      canvas.width = width
      canvas.height = height
      canvas.style.width = `${window.innerWidth}px`
      canvas.style.height = `${window.innerHeight}px`
      dustFar = createDustLayer(width, height, mobile, 19111)
      dustNear = createDustLayer(width, height, mobile, 38921)
      plasma = createPlasmaLayer(width, height, mobile)
      lightningLayer = makeLayer(width, height)
      rebuildBolts(mobile)
      const random = randomFrom(92717)
      activeSparks = Array.from({ length: mobile ? 26 : 78 }, (_, index) => ({
        x: random() * width,
        y: random() * height,
        size: index < (mobile ? 4 : 14) ? 1.4 + random() * 1.8 : .55 + random() * 1.25,
        alpha: .42 + random() * .55,
        speed: .7 + random() * 2.8,
        drift: (random() - .5) * 1.8,
        phase: random() * Math.PI * 2,
      }))
    }

    const renderLightning = (time) => {
      const lightningContext = lightningLayer.context
      lightningContext.clearRect(0, 0, width, height)
      lightningContext.globalCompositeOperation = 'screen'
      bolts.forEach((bolt, index) => {
        const slowPulse = .5 + Math.sin(time * (.00006 + index * .000002) + bolt.phase) * .5
        const flash = Math.pow(Math.max(0, Math.sin(time * .000021 + bolt.phase * 1.73)), 14)
        drawBolt(lightningContext, bolt, bolt.alpha * (.34 + slowPulse * .64 + flash * .66))
      })
    }

    const draw = (time = 0) => {
      if (time - lastLightningDraw > 90 || !lastLightningDraw) {
        renderLightning(time)
        lastLightningDraw = time
      }
      const subtleMotion = reducedMotion.matches ? 0 : 1
      const driftA = Math.sin(time * .000026) * 6 * subtleMotion
      const driftB = Math.cos(time * .000019) * 8 * subtleMotion
      const plasmaBreath = reducedMotion.matches ? .76 : .7 + Math.sin(time * .00011) * .1
      const lightningBreath = reducedMotion.matches ? .82 : .84 + Math.sin(time * .00017) * .1
      context.clearRect(0, 0, width, height)
      context.globalCompositeOperation = 'source-over'
      context.globalAlpha = .55
      context.drawImage(dustFar, driftA, driftB)
      context.drawImage(dustFar, driftA - width, driftB)
      context.globalCompositeOperation = 'screen'
      context.globalAlpha = plasmaBreath
      context.drawImage(plasma, driftB * .35, driftA * .28)
      context.globalAlpha = lightningBreath
      context.drawImage(lightningLayer.canvas, 0, 0)
      context.globalAlpha = .72
      context.drawImage(dustNear, driftB * .45, -driftA * .45)
      context.drawImage(dustNear, driftB * .45, -driftA * .45 - height)

      activeSparks.forEach((spark) => {
        if (!reducedMotion.matches) {
          spark.y -= spark.speed * .32
          spark.x += spark.drift * .18
          if (spark.y < -8) spark.y = height + 8
          if (spark.x < -8) spark.x = width + 8
          if (spark.x > width + 8) spark.x = -8
        }
        const shimmer = reducedMotion.matches ? .7 : .62 + Math.sin(time * .00065 + spark.phase) * .35
        context.globalAlpha = spark.alpha * shimmer
        context.fillStyle = spark.size > 1.4 ? '#fff0b5' : '#ffb20c'
        context.fillRect(spark.x, spark.y, spark.size, spark.size)
        if (spark.size > 1.4) {
          context.globalAlpha *= .5
          context.fillRect(spark.x - 4, spark.y + spark.size / 2, spark.size + 8, .65)
          context.fillRect(spark.x + spark.size / 2, spark.y - 4, .65, spark.size + 8)
        }
      })
      context.globalAlpha = 1
      context.globalCompositeOperation = 'source-over'
      if (!reducedMotion.matches && !document.hidden) animationFrame = requestAnimationFrame(draw)
    }

    const restart = () => {
      cancelAnimationFrame(animationFrame)
      lastLightningDraw = 0
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
    reducedMotion.addEventListener('change', restart)
    return () => {
      cancelAnimationFrame(animationFrame)
      window.removeEventListener('resize', resize)
      document.removeEventListener('visibilitychange', handleVisibility)
      reducedMotion.removeEventListener('change', restart)
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
