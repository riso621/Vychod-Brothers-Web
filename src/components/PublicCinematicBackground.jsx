import { useEffect, useRef } from 'react'

const rng = (seed) => () => {
  seed |= 0
  seed = seed + 0x6d2b79f5 | 0
  let value = Math.imul(seed ^ seed >>> 15, 1 | seed)
  value = value + Math.imul(value ^ value >>> 7, 61 | value) ^ value
  return ((value ^ value >>> 14) >>> 0) / 4294967296
}

const layer = (width, height) => {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return { canvas, context: canvas.getContext('2d', { alpha: true }) }
}

function dustTexture(width, height, mobile, seed) {
  const output = layer(width, height)
  const random = rng(seed)
  const count = mobile ? 440 : 2100
  output.context.globalCompositeOperation = 'lighter'
  for (let index = 0; index < count; index += 1) {
    const bright = index % 19 === 0
    output.context.fillStyle = `rgba(255,${145 + Math.round(random() * 70)},${Math.round(random() * 30)},${.1 + random() * (bright ? .68 : .38)})`
    const size = .22 + random() * (bright ? 1.65 : .7)
    output.context.fillRect(random() * width, random() * height, size, size)
  }
  return output.canvas
}

function plasmaTexture(width, height, mobile) {
  const output = layer(width, height)
  const random = rng(60223 + width + height)
  const count = mobile ? 26 : 66
  output.context.globalCompositeOperation = 'lighter'
  for (let index = 0; index < count; index += 1) {
    const team = index < count * .82
    const x = team ? width * (.39 + random() * .43) : random() * width
    const y = team ? height * (.05 + random() * .5) : random() * height
    const radius = width * (.012 + random() * .065)
    const alpha = .018 + random() * .072
    const gradient = output.context.createRadialGradient(x, y, 0, x, y, radius)
    gradient.addColorStop(0, `rgba(255,220,111,${alpha})`)
    gradient.addColorStop(.15, `rgba(255,147,0,${alpha * .72})`)
    gradient.addColorStop(.48, `rgba(111,43,0,${alpha * .22})`)
    gradient.addColorStop(1, 'rgba(0,0,0,0)')
    output.context.fillStyle = gradient
    output.context.fillRect(x - radius, y - radius, radius * 2, radius * 2)
  }
  const filamentCount = mobile ? 18 : 54
  output.context.lineCap = 'round'
  output.context.lineJoin = 'round'
  for (let index = 0; index < filamentCount; index += 1) {
    const zone = random()
    const x = zone < .24
      ? width * random() * .16
      : zone < .48
        ? width * (.84 + random() * .16)
        : width * (.38 + random() * .47)
    const y = height * (.03 + random() * .62)
    const angle = random() * Math.PI * 2
    const distance = width * (.018 + random() * .07)
    const points = jaggedPath(
      { x, y },
      { x: x + Math.cos(angle) * distance, y: y + Math.sin(angle) * distance },
      12 + Math.floor(random() * 12),
      distance * .22,
      random,
    )
    output.context.strokeStyle = `rgba(255,112,0,${.035 + random() * .065})`
    output.context.lineWidth = 4 + random() * 4
    partialPath(output.context, points, 1)
    output.context.strokeStyle = `rgba(255,208,63,${.14 + random() * .24})`
    output.context.lineWidth = .35 + random() * .65
    partialPath(output.context, points, 1)
    if (index % 3 === 0) {
      const node = points[Math.floor(points.length * (.45 + random() * .45))]
      const nodeRadius = 2 + random() * 7
      const nodeGlow = output.context.createRadialGradient(node.x, node.y, 0, node.x, node.y, nodeRadius)
      nodeGlow.addColorStop(0, `rgba(255,255,223,${.55 + random() * .35})`)
      nodeGlow.addColorStop(.16, `rgba(255,184,16,${.32 + random() * .25})`)
      nodeGlow.addColorStop(1, 'rgba(255,107,0,0)')
      output.context.fillStyle = nodeGlow
      output.context.fillRect(node.x - nodeRadius, node.y - nodeRadius, nodeRadius * 2, nodeRadius * 2)
    }
  }
  return output.canvas
}

const interpolate = (start, end, progress) => ({
  x: start.x + (end.x - start.x) * progress,
  y: start.y + (end.y - start.y) * progress,
})

function jaggedPath(start, end, segments, spread, random) {
  const points = [start]
  const dx = end.x - start.x
  const dy = end.y - start.y
  const length = Math.hypot(dx, dy) || 1
  let previous = 0
  for (let index = 1; index < segments; index += 1) {
    const progress = index / segments
    const anchor = interpolate(start, end, progress)
    const offset = previous * .28 + (random() - .5) * spread * Math.sin(progress * Math.PI)
    previous = offset
    points.push({
      x: anchor.x - dy / length * offset + (random() - .5) * spread * .16,
      y: anchor.y + dx / length * offset + (random() - .5) * spread * .16,
    })
  }
  points.push(end)
  return points
}

function endpoints(width, height, placement, size, random) {
  if (placement === 'left') {
    const start = { x: width * (-.015 + random() * .045), y: height * (.03 + random() * .58) }
    return { start, end: { x: width * (.075 + random() * size * .38), y: start.y + height * ((random() - .5) * size) } }
  }
  if (placement === 'right') {
    const start = { x: width * (1.015 - random() * .045), y: height * (.03 + random() * .58) }
    return { start, end: { x: width * (.925 - random() * size * .38), y: start.y + height * ((random() - .5) * size) } }
  }
  const start = { x: width * (.43 + random() * .37), y: height * (.08 + random() * .38) }
  const angle = (random() - .5) * Math.PI * 1.6
  const distance = width * size * (.28 + random() * .52)
  return { start, end: { x: start.x + Math.cos(angle) * distance, y: start.y + Math.sin(angle) * distance * .72 } }
}

function lightning(width, height, now, kind, placement, random) {
  const config = kind === 'burst'
      ? { size: .34, segments: 34, branches: 10, lifetime: 1350, strength: 1 }
    : kind === 'medium'
      ? { size: .2, segments: 25, branches: 6, lifetime: 920, strength: .7 }
      : { size: .095, segments: 17, branches: 3, lifetime: 560, strength: .38 }
  const { start, end } = endpoints(width, height, placement, config.size, random)
  const main = jaggedPath(start, end, config.segments, width * config.size * .28, random)
  const branches = Array.from({ length: config.branches }, () => {
    const originIndex = 2 + Math.floor(random() * Math.max(2, main.length - 5))
    const origin = main[originIndex]
    const previous = main[Math.max(0, originIndex - 1)]
    const angle = Math.atan2(origin.y - previous.y, origin.x - previous.x)
      + (random() > .5 ? 1 : -1) * (.5 + random() * 1.05)
    const distance = width * config.size * (.13 + random() * .34)
    const branchEnd = { x: origin.x + Math.cos(angle) * distance, y: origin.y + Math.sin(angle) * distance }
    return {
      points: jaggedPath(origin, branchEnd, Math.max(5, Math.round(config.segments * .48)), width * config.size * .13, random),
      delay: .14 + random() * .3,
      strength: .36 + random() * .38,
    }
  })
  return {
    main, branches, born: now, kind, placement,
    lifetime: config.lifetime * (.82 + random() * .38),
    strength: config.strength * (.78 + random() * .32),
  }
}

function partialPath(context, points, progress) {
  if (progress <= 0 || points.length < 2) return
  const target = Math.min(points.length - 1, progress * (points.length - 1))
  const full = Math.floor(target)
  context.beginPath()
  context.moveTo(points[0].x, points[0].y)
  for (let index = 1; index <= full; index += 1) context.lineTo(points[index].x, points[index].y)
  if (full < points.length - 1) {
    const next = interpolate(points[full], points[full + 1], target - full)
    context.lineTo(next.x, next.y)
  }
  context.stroke()
}

function eventState(event, now) {
  const age = Math.max(0, (now - event.born) / event.lifetime)
  const growth = 1 - (1 - Math.min(1, age / .3)) ** 3
  const pulse = age < .52 ? .78 + Math.sin(age * Math.PI * 18) * .18 : 1
  const decay = age < .54 ? 1 : Math.max(0, 1 - (age - .54) / .46)
  return { age, growth, intensity: event.strength * pulse * decay }
}

function drawLightning(context, event, state) {
  if (state.intensity <= .01) return
  const paths = [{ points: event.main, delay: 0, strength: 1 }, ...event.branches]
  context.save()
  context.globalCompositeOperation = 'lighter'
  context.lineCap = 'round'
  context.lineJoin = 'round'
  paths.forEach((path, index) => {
    const progress = Math.max(0, Math.min(1, (state.growth - path.delay) / Math.max(.15, 1 - path.delay)))
    if (!progress) return
    const scale = index === 0 ? 1 : path.strength
    const intensity = state.intensity * scale
    context.strokeStyle = `rgba(255,119,0,${.12 * intensity})`
    context.lineWidth = (event.kind === 'burst' ? 14 : event.kind === 'medium' ? 10 : 6) * scale
    partialPath(context, path.points, progress)
    context.strokeStyle = `rgba(255,184,18,${.5 * intensity})`
    context.lineWidth = (event.kind === 'burst' ? 3.4 : event.kind === 'medium' ? 2.4 : 1.5) * scale
    partialPath(context, path.points, progress)
    context.strokeStyle = `rgba(255,252,222,${.9 * intensity})`
    context.lineWidth = (event.kind === 'burst' ? 1.05 : .72) * scale
    partialPath(context, path.points, progress)
  })
  const tip = event.main[Math.min(event.main.length - 1, Math.floor(state.growth * (event.main.length - 1)))]
  const radius = (event.kind === 'burst' ? 23 : event.kind === 'medium' ? 14 : 8) * state.intensity
  if (tip && radius > 1) {
    const glow = context.createRadialGradient(tip.x, tip.y, 0, tip.x, tip.y, radius)
    glow.addColorStop(0, `rgba(255,255,226,${.85 * state.intensity})`)
    glow.addColorStop(.16, `rgba(255,190,24,${.55 * state.intensity})`)
    glow.addColorStop(1, 'rgba(255,112,0,0)')
    context.fillStyle = glow
    context.fillRect(tip.x - radius, tip.y - radius, radius * 2, radius * 2)
  }
  context.restore()
}

function ambientParticles(width, height, mobile, random) {
  return Array.from({ length: mobile ? 24 : 64 }, (_, index) => ({
    x: random() * width, y: random() * height,
    vx: (random() - .5) * .07, vy: -.035 - random() * .12,
    size: index < (mobile ? 3 : 10) ? 1.3 + random() * 1.3 : .4 + random() * .8,
    alpha: .24 + random() * .58, phase: random() * Math.PI * 2,
  }))
}

export default function PublicCinematicBackground() {
  const canvasRef = useRef(null)
  const haloRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const halo = haloRef.current
    if (!canvas || !halo) return undefined
    const context = canvas.getContext('2d', { alpha: true })
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const random = rng((Date.now() ^ 0x7a91b3) >>> 0)
    let frame = 0
    let width = 0
    let height = 0
    let mobile = false
    let dustFar
    let dustNear
    let plasma
    let ambient = []
    let sparks = []
    let events = []
    let nextEvent = 0
    let nextBurst = 0
    let energy = 0
    let lastTime = 0

    const emitSparks = (event, now) => {
      const cap = mobile ? 30 : 88
      const amount = event.kind === 'burst' ? (mobile ? 8 : 24) : event.kind === 'medium' ? (mobile ? 4 : 11) : 3
      const origin = event.main[Math.floor(event.main.length * (.45 + random() * .45))]
      for (let index = 0; index < amount && sparks.length < cap; index += 1) {
        const angle = random() * Math.PI * 2
        const speed = .018 + random() * .075
        sparks.push({
          x: origin.x, y: origin.y,
          vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - .02,
          born: now + random() * 110, lifetime: 420 + random() * 620,
          size: .55 + random() * (event.kind === 'burst' ? 2.2 : 1.25),
          alpha: .45 + random() * .5,
        })
      }
    }

    const spawn = (now, forcedKind) => {
      const roll = random()
      const kind = forcedKind || (roll < .58 ? 'micro' : roll < .92 ? 'medium' : 'burst')
      const placementRoll = random()
      const placement = placementRoll < .27 ? 'left' : placementRoll < .54 ? 'right' : 'team'
      const event = lightning(width, height, now, kind, placement, random)
      events.push(event)
      emitSparks(event, now)
      if (placement === 'team' || kind === 'burst') energy = Math.max(energy, kind === 'burst' ? .32 : .14)
    }

    const resize = () => {
      mobile = innerWidth < 720
      const scale = mobile ? .72 : innerWidth > 2200 ? .68 : .8
      width = Math.max(1, Math.round(innerWidth * scale))
      height = Math.max(1, Math.round(innerHeight * scale))
      canvas.width = width
      canvas.height = height
      canvas.style.width = `${innerWidth}px`
      canvas.style.height = `${innerHeight}px`
      dustFar = dustTexture(width, height, mobile, 19111)
      dustNear = dustTexture(width, height, mobile, 38921)
      plasma = plasmaTexture(width, height, mobile)
      ambient = ambientParticles(width, height, mobile, random)
      sparks = []
      events = []
      nextEvent = 0
      nextBurst = 0
    }

    const staticFrame = () => {
      context.clearRect(0, 0, width, height)
      context.globalAlpha = .52
      context.drawImage(dustFar, 0, 0)
      context.globalCompositeOperation = 'lighter'
      context.globalAlpha = .72
      context.drawImage(plasma, 0, 0)
      const event = lightning(width, height, 0, 'medium', 'team', rng(9911))
      drawLightning(context, event, { age: .5, growth: 1, intensity: .46 })
      context.globalAlpha = .6
      context.drawImage(dustNear, 0, 0)
      context.globalAlpha = 1
      context.globalCompositeOperation = 'source-over'
      halo.style.opacity = '.82'
      halo.style.transform = 'scale(1)'
    }

    const draw = (time) => {
      const delta = Math.min(34, Math.max(0, time - lastTime || 16.7))
      lastTime = time
      if (!nextEvent) nextEvent = time + 120
      if (!nextBurst) nextBurst = time + 4200 + random() * 5200
      if (time >= nextEvent && events.length < (mobile ? 3 : 6)) {
        spawn(time)
        nextEvent = time + 280 + random() * (mobile ? 960 : 620)
      }
      if (time >= nextBurst && events.length < (mobile ? 3 : 6)) {
        spawn(time, 'burst')
        nextBurst = time + 5100 + random() * 7600
      }
      events = events.filter((event) => time - event.born < event.lifetime)
      sparks = sparks.filter((spark) => time - spark.born < spark.lifetime)
      energy *= Math.pow(.88, delta / 16.7)

      const x = Math.sin(time * .000024) * 5
      const y = Math.cos(time * .000019) * 6
      context.clearRect(0, 0, width, height)
      context.globalCompositeOperation = 'source-over'
      context.globalAlpha = .5
      context.drawImage(dustFar, x, y)
      context.drawImage(dustFar, x - width, y)
      context.globalCompositeOperation = 'lighter'
      context.globalAlpha = .61 + Math.sin(time * .00009) * .055 + energy * .22
      context.drawImage(plasma, y * .23, x * .2)
      events.forEach((event) => drawLightning(context, event, eventState(event, time)))

      ambient.forEach((spark) => {
        spark.x += spark.vx * delta
        spark.y += spark.vy * delta
        if (spark.y < -5) spark.y = height + 5
        if (spark.x < -5) spark.x = width + 5
        if (spark.x > width + 5) spark.x = -5
        context.globalAlpha = spark.alpha * (.62 + Math.sin(time * .0007 + spark.phase) * .32)
        context.fillStyle = spark.size > 1.25 ? '#fff3c4' : '#ffad08'
        context.fillRect(spark.x, spark.y, spark.size, spark.size)
      })
      sparks.forEach((spark) => {
        const age = Math.max(0, time - spark.born)
        if (!age) return
        spark.x += spark.vx * delta
        spark.y += spark.vy * delta
        const alpha = spark.alpha * Math.sin(Math.min(1, age / spark.lifetime) * Math.PI)
        context.globalAlpha = alpha
        context.fillStyle = spark.size > 1.35 ? '#fff7d9' : '#ffc228'
        context.fillRect(spark.x, spark.y, spark.size, spark.size)
        if (spark.size > 1.35) {
          context.globalAlpha = alpha * .34
          context.fillRect(spark.x - 4, spark.y + spark.size / 2, spark.size + 8, .55)
          context.fillRect(spark.x + spark.size / 2, spark.y - 4, .55, spark.size + 8)
        }
      })
      const breath = .5 + Math.sin(time * .00048) * .5
      halo.style.opacity = String(Math.min(1, .74 + breath * .08 + energy))
      halo.style.transform = `scale(${(.985 + breath * .018 + energy * .05).toFixed(4)})`
      context.globalAlpha = .52
      context.drawImage(dustNear, -y * .28, x * .32)
      context.drawImage(dustNear, -y * .28, x * .32 - height)
      context.globalAlpha = 1
      context.globalCompositeOperation = 'source-over'
      if (!document.hidden) frame = requestAnimationFrame(draw)
    }

    const restart = () => {
      cancelAnimationFrame(frame)
      lastTime = 0
      if (reducedMotion.matches) staticFrame()
      else frame = requestAnimationFrame(draw)
    }
    const visibility = () => {
      cancelAnimationFrame(frame)
      if (!document.hidden) restart()
    }
    resize()
    restart()
    addEventListener('resize', resize, { passive: true })
    document.addEventListener('visibilitychange', visibility)
    reducedMotion.addEventListener('change', restart)
    return () => {
      cancelAnimationFrame(frame)
      removeEventListener('resize', resize)
      document.removeEventListener('visibilitychange', visibility)
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
      <span ref={haloRef} className="cinematic-hero-halo" />
      <span className="cinematic-body-smoke" />
      <span className="cinematic-pulse" />
    </div>
    <div className="cinematic-energy" aria-hidden="true"><canvas ref={canvasRef} /></div>
  </>
}
