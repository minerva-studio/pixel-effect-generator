import { clamp01, hashUnit, smoothStep } from '../../shared/pixel/rng'
import type { LobeView } from '../shared-effects/types'
import type { ExplosionParameters } from './model'
import { DEFAULT_ROLLING_BURST_STAGGER } from './model'

interface RollingBallsTuning {
  readonly lobeCount: number
  readonly radius: number
  readonly churnAmount: number
  readonly shapeIrregularity: number
  readonly rotation: number
  readonly profile: 'hardShell' | 'moltenCore'
  readonly dissolveStart: number
  readonly burstStagger: number
}

const TAU = Math.PI * 2

function tuningFor(parameters: ExplosionParameters): RollingBallsTuning {
  return {
    ...parameters.body,
    profile: parameters.volume.enabled && parameters.volume.profile === 'moltenCore' ? 'moltenCore' : 'hardShell',
    dissolveStart: parameters.motion.dissolveStart,
    burstStagger: parameters.body.burstStagger ?? DEFAULT_ROLLING_BURST_STAGGER,
  }
}

interface Ball {
  readonly index: number
  readonly birth: number
  readonly death: number
  readonly angle: number
  readonly travel: number
  readonly radius: number
  readonly phase: number
  readonly spin: number
  readonly temperature: number
  readonly coolingLead: number
}

function ballsFor(seed: number, tuning: RollingBallsTuning): Ball[] {
  const count = Math.max(3, Math.min(9, Math.round(tuning.lobeCount)))
  const variation = clamp01(tuning.shapeIrregularity)
  const spread = Math.sqrt(variation)
  const stagger = clamp01(tuning.burstStagger)
  const rotation = tuning.rotation / 180 * Math.PI
  const outer = Array.from({ length: count - 1 }, (_, index) => index + 1)
  const sizeOrder = [...outer].sort((left, right) => hashUnit(seed, left, 21) - hashUnit(seed, right, 21))
  const travelOrder = [...outer].sort((left, right) => hashUnit(seed, left, 22) - hashUnit(seed, right, 22))
  return Array.from({ length: count }, (_, index) => {
    const ringIndex = index - 1
    const ringCount = count - 1
    const angle = index === 0 ? rotation : rotation + ringIndex * TAU / ringCount
      + (hashUnit(seed, index, 11) - 0.5) * TAU / ringCount * spread * 1.8
    const birth = 0.018 + index / (count - 1) * stagger * 0.6
      + (index === 0 ? 0 : (hashUnit(seed, index, 12) - 0.5) * spread * stagger * 0.12)
    const sizeRank = index === 0 ? 0.5 : sizeOrder.indexOf(index) / Math.max(1, ringCount - 1)
    const travelRank = index === 0 ? 0.5 : travelOrder.indexOf(index) / Math.max(1, ringCount - 1)
    const rank = index / (count - 1)
    const lateBridge = smoothStep(clamp01((rank - 0.5) / 0.25)) * clamp01((1 - rank) / 0.25)
    const earlyLifetimeWeight = Math.min(1, rank / 0.4) ** 2
    const lifetimeVariation = Math.min(0, (0.5 - hashUnit(seed, index, 20)) * 0.27 * spread * (1 - rank * rank) * earlyLifetimeWeight)
    const death = Math.min(0.98, 0.62 + 0.3 * rank ** 0.8 + 0.09 * lateBridge - 0.05 * (1 - rank) ** 1.5 + lifetimeVariation)
    return {
      index,
      birth,
      death,
      angle,
      travel: index === 0 ? 0 : tuning.radius * (0.55 + (travelRank - 0.5) * 0.55 * spread),
      radius: tuning.radius * (index === 0 ? 0.43 : 0.34 * (1 + (sizeRank - 0.5) * 1.2 * spread)),
      phase: hashUnit(seed, index, 15) * TAU,
      spin: hashUnit(seed, index, 16) < 0.5 ? -1 : 1,
      temperature: 1 + (hashUnit(seed, index, 17) - 0.5) * 0.8 * spread,
      coolingLead: 0.23 * Math.max(0, sizeRank - 0.5) * spread,
    }
  })
}

/** Paints independently timed rolling fireballs in birth-ordered depth. */
export function renderRollingFireballBody(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  parameters: ExplosionParameters,
  time: number,
): void {
  if (time <= 0 || time >= 1) return
  const tuning = tuningFor(parameters)
  const seed = parameters.seed
  const palette = parameters.palette
  const owners = new Int8Array(width * height)
  const heats = new Float32Array(width * height)
  const churn = clamp01(tuning.churnAmount)
  const balls = ballsFor(seed, tuning)
  // Later births sit behind the first visible lobe throughout the explosion.
  const layers = [...balls].sort((back, front) => front.birth - back.birth || front.radius - back.radius)
  for (const [index, ball] of layers.entries()) {
    const rawAge = (time - ball.birth) / (ball.death - ball.birth)
    if (rawAge <= 0 || rawAge >= 1) continue
    const age = rawAge
    if (age >= 0.995) continue
    const travel = (1 - Math.exp(-2.4 * age)) / (1 - Math.exp(-2.4))
    const lift = smoothStep(clamp01((age - 0.55) / 0.45))
    const tangent = (age * 0.055 + Math.sin(age * 8 + ball.phase) * 0.025) * tuning.radius * churn
    const centerX = Math.cos(ball.angle) * ball.travel * travel - Math.sin(ball.angle) * tangent
    const centerY = Math.sin(ball.angle) * ball.travel * travel + Math.cos(ball.angle) * tangent - tuning.radius * 0.12 * lift
    const birthRank = ball.index / Math.max(1, tuning.lobeCount - 1)
    const coolingStart = Math.min(0.88, tuning.dissolveStart + 0.1 * birthRank ** 3) - ball.coolingLead
    const cooling = smoothStep(clamp01((age - coolingStart) / Math.max(0.05, 1 - coolingStart)))
    const erosion = Math.min(1, cooling * 1.02)
    const growth = 1 - Math.exp(-16 * age)
    const radius = ball.radius * growth * (1 - 0.2 * erosion - 0.1 * erosion * erosion)
    if (radius < 0.5) continue
    const threshold = 0.08 + 0.35 * erosion + 0.025 * smoothStep(clamp01((age - 0.82) / 0.18))
    const temperature = ball.temperature * (1.22 - 0.48 * age - 0.72 * cooling)
      * (tuning.profile === 'moltenCore' ? 1.16 : 1)
    const phase = ball.phase + ball.spin * age * TAU * (0.4 + churn * 0.8)
    const inward = Math.hypot(centerX, centerY)
    const inwardX = inward > 1 ? -centerX / inward : -0.7
    const inwardY = inward > 1 ? -centerY / inward : -0.7
    const hotX = inwardX * radius * 0.32 + Math.cos(phase) * radius * 0.17
    const hotY = inwardY * radius * 0.32 + Math.sin(phase) * radius * 0.17
    const extent = radius * 1.4
    for (let y = Math.max(1, Math.floor(height / 2 + centerY - extent)); y < Math.min(height - 1, Math.ceil(height / 2 + centerY + extent)); y += 1) {
      for (let x = Math.max(1, Math.floor(width / 2 + centerX - extent)); x < Math.min(width - 1, Math.ceil(width / 2 + centerX + extent)); x += 1) {
        const dx = x + 0.5 - width / 2 - centerX
        const dy = y + 0.5 - height / 2 - centerY
        const angle = Math.atan2(dy, dx)
        const warp = 1 + churn * (0.22 * Math.sin(3 * angle - phase) + 0.1 * Math.sin(5 * angle + phase * 0.7))
        const distanceSquared = (dx * dx + dy * dy) / (radius * radius * warp * warp)
        if (distanceSquared >= 1) continue
        const field = (1 - distanceSquared) ** 2
        const hole = cooling * 0.1 * (0.5 + 0.5 * Math.sin(dx * 0.48 + dy * 0.35 + phase))
        if (field <= threshold + hole) continue
        const interior = clamp01((field - threshold - hole) / (1 - threshold))
        const hotDistanceSquared = ((dx - hotX) ** 2 + (dy - hotY) ** 2) / (radius * radius)
        const hotspot = Math.exp(-hotDistanceSquared / 0.1)
        const light = clamp01(0.5 - (dx + dy) / Math.max(1, radius * 3))
        const flow = Math.sin(2 * angle - phase + Math.sqrt(distanceSquared) * 3)
          + 0.5 * Math.sin(4 * angle + phase * 0.8)
        const heat = interior ** 0.48 * temperature * (0.48 + hotspot * 0.52 + light * 0.08 + flow * churn * 0.12)
        const pixel = y * width + x
        // Rear heat survives under a front rim without merging the two fields.
        const sharedHeat = owners[pixel] === 0 ? heat : Math.max(heat, heats[pixel] * 0.72)
        const band = Math.min(palette.length - 1, Math.floor((1 - clamp01(sharedHeat)) * palette.length))
        const color = palette[band]
        const offset = pixel * 4
        pixels[offset] = color.r
        pixels[offset + 1] = color.g
        pixels[offset + 2] = color.b
        pixels[offset + 3] = color.a
        owners[pixel] = index + 1
        heats[pixel] = sharedHeat
      }
    }
  }
  const edge = palette[palette.length - 1]
  for (let y = 1; y < height - 1; y += 1) for (let x = 1; x < width - 1; x += 1) {
    const pixel = y * width + x
    const owner = owners[pixel]
    if (owner === 0) continue
    const neighbors = [owners[pixel - 1], owners[pixel + 1], owners[pixel - width], owners[pixel + width]]
    const exterior = neighbors.some((neighbor) => neighbor === 0)
    const seam = neighbors.some((neighbor) => neighbor > 0 && neighbor < owner)
    if (!exterior && (!seam || heats[pixel] >= 0.72)) continue
    const color = exterior ? edge : palette[palette.length - 2]
    const offset = pixel * 4
    pixels[offset] = color.r
    pixels[offset + 1] = color.g
    pixels[offset + 2] = color.b
    pixels[offset + 3] = color.a
  }
  renderRollingCinders(pixels, width, height, parameters, balls, time)
}

/** Gives optional shared tongues the live tips of the same fireballs as the body. */
export function rollingFireballViews(parameters: ExplosionParameters, time: number): LobeView[] {
  const tuning = tuningFor(parameters)
  return ballsFor(parameters.seed, tuning).map((ball) => {
    const age = (time - ball.birth) / (ball.death - ball.birth)
    const growth = age > 0 && age < 1 ? 1 - Math.exp(-16 * age) : 0
    const travel = (1 - Math.exp(-2.4 * clamp01(age))) / (1 - Math.exp(-2.4))
    return {
      angle: ball.angle + ball.spin * clamp01(age) * TAU * (0.4 + tuning.churnAmount * 0.8),
      tipDistance: growth ? ball.travel * travel + ball.radius * growth : 0,
      growth,
      lengthScale: ball.radius / (tuning.radius * 0.325),
      tongueNoise: hashUnit(parameters.seed, ball.index, 18) * 2 - 1,
      curveSign: ball.spin,
    }
  })
}

/** Leaves brief radial embers as individual fireballs burn out. */
function renderRollingCinders(pixels: Uint8ClampedArray, width: number, height: number, parameters: ExplosionParameters, balls: readonly Ball[], time: number): void {
  for (const ball of balls) {
    const launch = ball.death - 0.13
    const end = Math.min(0.985, ball.death + 0.05)
    if (time <= launch || time >= end) continue
    const age = (time - launch) / (end - launch)
    const distance = ball.travel * (0.8 + 0.5 * age) + ball.radius * (0.3 + 0.5 * age)
    const centerX = width / 2 + Math.cos(ball.angle) * distance
    const centerY = height / 2 + Math.sin(ball.angle) * distance - parameters.body.radius * 0.06 * age
    const radius = Math.max(0.4, ball.radius * 0.08 * (1 - age))
    const color = parameters.palette[Math.min(parameters.palette.length - 1, Math.floor(parameters.palette.length * (0.6 + 0.4 * age)))]
    if (radius < 0.7) {
      const x = Math.round(centerX - 0.5)
      const y = Math.round(centerY - 0.5)
      if (x >= 0 && x < width && y >= 0 && y < height) {
        const offset = (y * width + x) * 4
        pixels[offset] = color.r
        pixels[offset + 1] = color.g
        pixels[offset + 2] = color.b
        pixels[offset + 3] = color.a
      }
      continue
    }
    for (let y = Math.max(0, Math.floor(centerY - radius)); y < Math.min(height, Math.ceil(centerY + radius)); y += 1) {
      for (let x = Math.max(0, Math.floor(centerX - radius)); x < Math.min(width, Math.ceil(centerX + radius)); x += 1) {
        if ((x + 0.5 - centerX) ** 2 + (y + 0.5 - centerY) ** 2 > radius * radius) continue
        const offset = (y * width + x) * 4
        pixels[offset] = color.r
        pixels[offset + 1] = color.g
        pixels[offset + 2] = color.b
        pixels[offset + 3] = color.a
      }
    }
  }
}
