import type { RgbColor } from '../../shared/pixel/color'
import { clamp01, hashUnit, lerp, smoothStep } from '../../shared/pixel/rng'
import { writePixel } from '../shared-effects/output'
import type { ExplosionParameters } from './model'

/**
 * Field-based explosion bodies. Unlike the primitive-built shapes, each owns one scalar
 * field whose threshold is the silhouette and whose level is the thermal band, so the
 * outline and the colors always move together. Geometry is authored at radius 42 on a
 * 128px canvas and scales with `body.radius`.
 */

const TAU = Math.PI * 2
const REFERENCE_RADIUS = 42

/** Paints one heat value into the palette, hottest band first. */
function paintHeat(pixels: Uint8ClampedArray, width: number, height: number, x: number, y: number, palette: readonly RgbColor[], heat: number) {
  const band = Math.min(palette.length - 1, Math.max(0, Math.floor((1 - clamp01(heat)) * palette.length)))
  writePixel(pixels, width, height, x, y, palette[band])
}

/**
 * Billow burst: an asymmetric expanding front with rounded, notched billows, block-like
 * mid-life turnover, outward burnout, and thrown sparks. `lifecycle` runs 0→1.
 */
export function renderBillowBurstBody(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  parameters: ExplosionParameters,
  lifecycle: number,
): void {
  const time = lifecycle
  if (time <= 0 || time >= 1) return
  const { body, seed } = parameters
  const surface = parameters.surface.style === 'burningLayers' ? parameters.surface : { bandWarp: 0.45, edgeBreakup: 0.3 }
  const scale = body.radius / REFERENCE_RADIUS
  const cx = width / 2, cy = height / 2 + scale
  const half = Math.min(width, height) / 2
  const phase = hashUnit(seed, 2, 7) * TAU + body.rotation / 180 * Math.PI
  const jets = Array.from({ length: 3 }, (_, i) => ({
    direction: phase + i * TAU / 3 + (hashUnit(seed, i, 21) - 0.5) * 0.9,
    cosSpread: Math.cos(0.30 + hashUnit(seed, i, 22) * 0.20),
    reach: 0.7 + hashUnit(seed, i, 23) * 0.6,
  }))
  const expansion = 1 - (1 - clamp01(time / 0.65)) ** (2 + body.impulse * 0.8)
  const radius = scale * (3 + 40 * expansion + 4 * time)
  const burnout = smoothStep(clamp01((time - 0.35) / 0.64))
  const jetAge = smoothStep(clamp01((time - 0.18) / 0.4))
  const midRoll = body.churnAmount * smoothStep(clamp01((time - 0.18) / 0.14))
    * (1 - smoothStep(clamp01((time - 0.43) / 0.12)))
  const rollTravel = smoothStep(clamp01((time - 0.23) / 0.25))
  const blocks = [
    { x: -0.31, y: -0.22, rx: 0.28, ry: 0.21, turn: -0.3 },
    { x: 0.29, y: -0.08, rx: 0.22, ry: 0.28, turn: 0.4 },
    { x: -0.02, y: 0.39, rx: 0.3, ry: 0.18, turn: -0.15 },
  ].map((block, i) => ({ ...block,
    x: (block.x + (hashUnit(seed, i, 41) - 0.5) * 0.09) * (1 + 0.22 * rollTravel),
    y: (block.y + (hashUnit(seed, i, 42) - 0.5) * 0.09) * (1 + 0.22 * rollTravel),
    co: Math.cos(block.turn), si: Math.sin(block.turn),
  }))
  const billowAge = smoothStep(clamp01((time - 0.04) / 0.18))
  const billowTurn = phase + time * 1.4
  // Keeps the billows and thrown pieces clear of the canvas border at any radius.
  const edgeStart = Math.max(4, Math.min(54 * scale, half - 9))
  const edgeSpan = Math.max(2, Math.min(7 * scale, half - 2 - edgeStart))
  const debris = Array.from({ length: body.debrisCount }, (_, i) => {
    const age = clamp01((time - 0.06) / (0.5 + hashUnit(seed, i, 71) * 0.15))
    const angle = phase + i * TAU / body.debrisCount + (hashUnit(seed, i, 72) - 0.5) * (TAU / body.debrisCount) * 1.2
    // Every third piece is a larger chunk; the rest are small sparks.
    const size = i % 3 === 0 ? 2.2 + 1.8 * hashUnit(seed, i, 74) : 1.1 + 1.1 * hashUnit(seed, i, 74)
    // A longer canvas-safe flight speeds the piece up without shortening its fade.
    const reach = edgeStart * (0.72 + 0.28 * hashUnit(seed, i, 75))
    const flightReach = Math.min(half - size * scale - 2, reach + 8 * scale)
    const travel = age ** (0.8 + 0.4 * hashUnit(seed, i, 73))
    const distance = reach * 0.32 + (flightReach - reach * 0.32) * travel
    return {
      x: cx + Math.cos(angle) * distance,
      y: cy + Math.sin(angle) * distance * 0.93,
      size: age <= 0 || age >= 1 ? 0 : Math.max(1, size * scale * (1 - age) ** 0.7 * smoothStep(clamp01(age / 0.08))),
      heat: 0.8 - 0.55 * age,
    }
  })
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const dx = x - cx, dy = (y - cy) / 0.93
      const angle = Math.atan2(dy, dx)
      const outline = 0.96 + 0.08 * Math.cos(angle * 2 + phase) + 0.045 * Math.cos(angle * 3 - phase * 0.4)
      const radial = Math.hypot(dx, dy) / (radius * outline)
      const streamAngle = angle + 0.25 * Math.sin(angle * 3 + phase)
      let jet = 0
      for (const source of jets) {
        const peak = Math.max(0, (Math.cos(streamAngle - source.direction) - source.cosSpread) / (1 - source.cosSpread))
        jet = Math.max(jet, peak ** 1.4 * source.reach)
      }
      const edgeLift = smoothStep(clamp01(radial / 0.7))
      const contour = body.billow * edgeLift * (0.24 * jet * jetAge
        + 0.055 * Math.sin(streamAngle * 5 + radial * 6 - time * 9 + phase)
        + 0.025 * Math.sin(streamAngle * 9 - radial * 12 + time * 13 - phase))
      const curl = Math.min(1.3, radial ** 1.5) * (
        0.16 * Math.sin(streamAngle * 4 + phase) * Math.sin(radial * 9 - time * 11)
        + 0.065 * Math.sin(streamAngle * 7 - phase) * Math.sin(radial * 6 - time * 8))
      // Rounded bumps with sharp notches (sqrt|sin|) read as billowing fire, not lobes.
      const billow = billowAge * body.billow * edgeLift * (
        0.32 * Math.sqrt(Math.abs(Math.sin(streamAngle * 4.5 + billowTurn)))
        + 0.16 * Math.sqrt(Math.abs(Math.sin(streamAngle * 8.5 - billowTurn * 1.3 + 1.1))) - 0.3)
      // Chunky outline-only roughness; bands are left clean so it never reads as dither.
      const grit = billowAge * edgeLift * 0.07 * Math.sin(dx / scale * 0.7 + dy / scale * 0.45 + time * 11 + phase)
        * Math.sin(dx / scale * 0.4 - dy / scale * 0.8 - time * 9)
      let q = radial + curl - contour - billow
      let cooledBlock = 0, rolledFront = 0
      if (midRoll > 0) {
        const materialX = q * Math.cos(angle - phase)
        const materialY = q * Math.sin(angle - phase)
        for (let i = 0; i < blocks.length; i++) {
          const block = blocks[i]
          const u = (materialX - block.x) * block.co + (materialY - block.y) * block.si
          const v = -(materialX - block.x) * block.si + (materialY - block.y) * block.co
          const warpedU = u + 0.045 * Math.sin(v * 12 - time * 7 + i)
          const warpedV = v + 0.035 * Math.sin(u * 10 + time * 6 - i)
          const distance = Math.hypot(warpedU / block.rx, warpedV / block.ry)
          cooledBlock = Math.max(cooledBlock, 1 - smoothStep(clamp01((distance - 0.4) / 0.65)))
          const outerSide = smoothStep(clamp01(((materialX - block.x) * block.x + (materialY - block.y) * block.y + 0.03) / 0.12))
          const lip = smoothStep(clamp01((distance - 0.45) / 0.25)) * (1 - smoothStep(clamp01((distance - 0.9) / 0.4)))
          rolledFront = Math.max(rolledFront, lip * outerSide)
        }
        cooledBlock *= smoothStep(clamp01((q - 0.28) / 0.18))
        q -= midRoll * rolledFront * 0.05
      }
      // Burnout eats outward from the source while the outer front keeps advancing.
      const angularWeight = smoothStep(clamp01(q / 0.7))
      const cavity = burnout * 1.85 * (1 + angularWeight * (0.24 * Math.sin(angle * 2 + phase) + 0.16 * Math.cos(angle * 5 - phase)))
      const fractureAge = smoothStep(clamp01((time - 0.48) / 0.35))
      const fractureGate = smoothStep(clamp01((q - 0.64) / 0.3))
      const fracture = surface.edgeBreakup * fractureAge * fractureGate * 0.2
        * Math.max(0, Math.sin(streamAngle * 7 + q * 11 - time * 12 + phase)) ** 4
      const energy = 1 - q * q - cavity * (1 - smoothStep(clamp01(q / 0.93)))
        - burnout ** 3 * (0.24 + angularWeight * 0.15 * Math.sin(angle * 5 + phase))
        - smoothStep(clamp01((time - 0.8) / 0.2)) * 0.22 - fracture
        - midRoll * cooledBlock * 0.08
        - billowAge * 2 * smoothStep(clamp01((Math.hypot(x - cx, y - cy) - edgeStart) / edgeSpan))
      let chunk = 0, chunkHeat = 0
      for (const d of debris) {
        if (d.size < 0.5) continue
        const k = 1 - Math.hypot(x - d.x, y - d.y) / d.size
        if (k > chunk) { chunk = k; chunkHeat = d.heat }
      }
      // Grit may only carve the outline inward, never grow it.
      if (energy - grit > 0 && energy > 0) {
        const bandFlow = Math.sin(streamAngle * 4 + q * 10 - time * 11 + phase) * Math.cos(streamAngle * 3 - q * 5 + time * 5)
        const heat = (energy + surface.bandWarp * 0.22 * bandFlow * smoothStep(clamp01(q / 0.35)))
          * (1.06 + burnout * 1.6) * (1 - 0.35 * burnout ** 3)
          - midRoll * 0.22 * (1 - smoothStep(clamp01((q - 0.65) / 0.3)))
          - midRoll * cooledBlock * 0.63 + midRoll * rolledFront * 0.17
        paintHeat(pixels, width, height, x, y, parameters.palette, heat)
      }
      if (chunk > 0) paintHeat(pixels, width, height, x, y, parameters.palette, chunkHeat + chunk * 0.3 - burnout * 0.2)
    }
  }
}

interface Puff {
  x: number
  y: number
  r: number
  /** 1 ≈ white-hot, 0 ≈ cooled; may exceed 1 for the ignition core. */
  temp: number
  weight: number
  /** Lobe distortion carried in the puff's own frame, so it travels with the material. */
  lump: number
  spin: number
}

/**
 * Fire masses: an ignition flash, then masses thrown out and slowed by drag, rolling
 * billows, cooling, rising, and thinning. Puffs sum into one metaball field; necking and
 * breakup come from the masses separating rather than from noise. `lifecycle` runs 0→1.
 */
export function renderPuffClusterBody(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  parameters: ExplosionParameters,
  lifecycle: number,
): void {
  const time = lifecycle
  if (time <= 0 || time >= 1) return
  const { body, seed } = parameters
  const surface = parameters.surface.style === 'burningLayers' ? parameters.surface : { bandWarp: 0.45, edgeBreakup: 0.3 }
  const scale = body.radius / REFERENCE_RADIUS
  const cx = width / 2, cy = height / 2 + 6 * scale
  // Band flow scales the lobes each mass carries; 0.45 reproduces the reviewed study.
  const lumpScale = surface.bandWarp / 0.45
  const puffs: Puff[] = []
  const flashAge = clamp01(time / 0.14)
  puffs.push({ x: cx, y: cy, r: scale * (5 + 17 * (1 - (1 - flashAge) ** 3)),
    temp: 1.45 - 0.9 * smoothStep(clamp01((time - 0.08) / 0.3)),
    weight: 1.2 * (1 - smoothStep(clamp01((time - 0.12) / 0.35))), lump: 0.06 * lumpScale, spin: time * 3 })
  const base = hashUnit(seed, 0, 11) * TAU + body.rotation / 180 * Math.PI
  const n = body.massCount
  const inner = Math.max(2, Math.round(n / 3))
  for (let i = 0; i < n + inner; i++) {
    const core = i >= n
    const delay = hashUnit(seed, i, 12) * 0.07
    const age = clamp01((time - delay) / (0.95 - delay))
    if (age <= 0) continue
    const theta = core ? hashUnit(seed, i, 13) * TAU : base + (i / n) * TAU + (hashUnit(seed, i, 13) - 0.5) * (TAU / n) * 0.9
    // Slow inner masses keep the middle filled; outer masses carry the front.
    const speed = core ? 0.1 + 0.25 * hashUnit(seed, i, 14) : 0.5 + 0.5 * hashUnit(seed, i, 14)
    const travel = scale * (12 + 46 * body.throwDistance) * speed * (1 - Math.exp(-7 * age)) / (1 - Math.exp(-7))
    const size = scale * ((core ? 13 : 10) + 6 * hashUnit(seed, i, 15))
    const fade = 1 - smoothStep(clamp01((age - 0.6) / 0.4))
    const mass: Puff = {
      x: cx + Math.cos(theta) * travel,
      y: cy + Math.sin(theta) * travel * 0.85 - body.buoyancy * 20 * scale * age * age,
      r: size * (0.35 + 0.8 * (1 - Math.exp(-5 * age))) * (0.55 + 0.45 * fade),
      // Fast outer masses cool first; the slow middle stays hot longest.
      temp: clamp01(1.2 - age ** 0.8 * (0.8 + 0.5 * speed)) * 1.1,
      weight: 1 - smoothStep(clamp01((age - 0.88) / 0.12)),
      lump: (0.1 + 0.1 * age) * lumpScale,
      spin: hashUnit(seed, i, 16) * TAU + age * (hashUnit(seed, i, 17) < 0.5 ? -2 : 2),
    }
    puffs.push(mass)
    if (body.billow <= 0) continue
    const roll = (hashUnit(seed, i, 18) < 0.5 ? -1 : 1) * age * TAU * 0.35
    for (let j = 0; j < 3; j++) {
      const a = hashUnit(seed, i * 7 + j, 91) * TAU + roll
      const offset = mass.r * (0.62 + 0.18 * hashUnit(seed, i * 7 + j, 92))
      puffs.push({
        x: mass.x + Math.cos(a) * offset,
        y: mass.y + Math.sin(a) * offset,
        r: mass.r * (0.42 + 0.14 * hashUnit(seed, i * 7 + j, 93)) * Math.sqrt(body.billow),
        temp: mass.temp * 0.82,
        weight: mass.weight * 0.9 * body.billow,
        lump: 0,
        spin: 0,
      })
    }
  }
  const density = new Float32Array(width * height)
  const heatSum = new Float32Array(width * height)
  for (const p of puffs) {
    if (p.r < 0.5 || p.weight <= 0) continue
    const extent = p.r * (1 + p.lump)
    for (let y = Math.max(1, Math.floor(p.y - extent)); y <= Math.min(height - 2, Math.ceil(p.y + extent)); y++) {
      for (let x = Math.max(1, Math.floor(p.x - extent)); x <= Math.min(width - 2, Math.ceil(p.x + extent)); x++) {
        const dx = x - p.x, dy = y - p.y
        let d2 = (dx * dx + dy * dy) / (p.r * p.r)
        if (p.lump > 0 && d2 > 0.04) {
          const a = Math.atan2(dy, dx) + p.spin
          const lobes = 1 + p.lump * (0.6 * Math.sin(a * 3) + 0.4 * Math.sin(a * 5 + 1.7))
          d2 /= lobes * lobes
        }
        if (d2 >= 1) continue
        const k = (1 - d2) * (1 - d2) * p.weight
        density[y * width + x] += k
        heatSum[y * width + x] += k * p.temp
      }
    }
  }
  // Late thinning: a rising threshold opens holes where the field is weakest.
  const threshold = 0.25 + Math.min(0.9, surface.edgeBreakup * 4 / 3) * smoothStep(clamp01((time - 0.6) / 0.4))
  for (let i = 0; i < density.length; i++) {
    const f = density[i]
    if (f <= threshold) continue
    // Like the flame, heat falls to zero at the silhouette so bands nest inside the outline.
    const interior = clamp01((f - threshold) / 0.9)
    paintHeat(pixels, width, height, i % width, Math.floor(i / width), parameters.palette, heatSum[i] / f * interior ** 0.55)
  }
}

interface SmokePuff {
  readonly x: number
  readonly y: number
  readonly radius: number
  readonly weight: number
  readonly temperature: number
  readonly phase: number
}

function smokeNoise(seed: number, x: number, y: number): number {
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const tx = smoothStep(x - x0)
  const ty = smoothStep(y - y0)
  return lerp(
    lerp(hashUnit(seed, x0, y0), hashUnit(seed, x0 + 1, y0), tx),
    lerp(hashUnit(seed, x0, y0 + 1), hashUnit(seed, x0 + 1, y0 + 1), tx),
    ty,
  )
}

/** Renders smoke and its short-lived ember bed from one density and heat field. */
export function renderSmokeBurstBody(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  parameters: ExplosionParameters,
  lifecycle: number,
): void {
  const time = lifecycle
  if (time <= 0 || time >= 1) return
  const { body, seed, palette } = parameters
  const radius = body.radius
  const scale = radius / REFERENCE_RADIUS
  const centerX = width / 2
  const centerY = height / 2 + radius * 0.12
  const rotation = body.rotation / 180 * Math.PI
  const soot = parameters.surface.style === 'rollingSoot' ? parameters.surface.sootAmount : 0.38
  const rise = body.smokeRise * radius * time * time
  const count = body.smokeCount
  const puffs: SmokePuff[] = []
  for (let index = 0; index < count; index += 1) {
    const rank = count === 1 ? 0 : index / (count - 1) * 2 - 1
    const irregularity = body.shapeIrregularity
    const direction = -Math.PI / 2 + rank * body.smokeSpread * 0.85
      + (hashUnit(seed, index, 501) - 0.5) * irregularity * 0.45 + rotation
    const drag = (1 - Math.exp(-6.5 * time)) / (1 - Math.exp(-6.5))
    const distance = radius * (0.66 + 0.12 * hashUnit(seed, index, 502)) * drag
    const x = centerX + Math.cos(direction) * distance
      + (hashUnit(seed, index, 516) - 0.5) * irregularity * radius * 0.18 * drag
    const y = centerY + Math.sin(direction) * distance * 0.8 - rise
      + (hashUnit(seed, index, 517) - 0.5) * irregularity * radius * 0.12 * drag
    const baseSize = radius * (0.45 + 0.1 * hashUnit(seed, index, 503)) * (0.32 + 0.88 * (1 - Math.exp(-7 * time)))
    const breakup = body.smokeMotion === 'particulate' ? smoothStep(clamp01((time - 0.51) / 0.48)) : 0
    const expiry = 0.91 + hashUnit(seed, index, 504) * 0.07
    const coolingStart = parameters.motion.dissolveStart + (hashUnit(seed, index, 505) - 0.5) * 0.08
    const burnout = smoothStep(clamp01((time - coolingStart) / Math.max(0.05, expiry - coolingStart)))
    const size = baseSize * (1 - 0.57 * burnout)
    const weight = Math.max(0, (1 - burnout) * (1 - breakup * 0.95))
    const temperature = clamp01(0.72 - time * (0.3 + (soot - 0.38) * 0.28)
      - 0.18 * smoothStep(clamp01((time - 0.15) / 0.5)))
    const phase = hashUnit(seed, index, 506) * TAU + time * (index % 2 ? 1.5 : -1.5)
    puffs.push({ x, y, radius: size, weight, temperature, phase })
    for (let billow = 0; billow < 3; billow += 1) {
      const angle = phase + billow * TAU / 3
      puffs.push({
        x: x + Math.cos(angle) * size * 0.65,
        y: y + Math.sin(angle) * size * 0.65,
        radius: size * 0.55,
        weight: weight * 0.7,
        temperature: temperature * 0.92,
        phase: angle,
      })
    }
    if (body.smokeMotion === 'billowing' && time > 0.5) {
      const wispAge = clamp01((time - 0.5) / 0.48)
      const wispFade = 1 - smoothStep(clamp01((time - (0.86 + hashUnit(seed, index, 515) * 0.05)) / 0.085))
      puffs.push({
        x: x + Math.cos(direction) * radius * 0.17 * wispAge,
        y: y - radius * (0.12 + body.smokeRise * 0.35) * wispAge,
        radius: baseSize * 0.28 * (1 - 0.45 * wispAge),
        weight: 0.55 * wispFade,
        temperature: 0.22 * (1 - wispAge),
        phase,
      })
    }
    if (body.smokeMotion !== 'particulate' || time <= 0.51) continue
    const split = clamp01((time - 0.51) / 0.47)
    const children = 4 + Math.floor(hashUnit(seed, index, 507) * 3)
    for (let child = 0; child < children; child += 1) {
      const item = index * 7 + child
      const childAge = clamp01((split - child * 0.055) / Math.max(0.1, 1 - child * 0.055))
      if (childAge <= 0) continue
      const childExpiry = 0.93 + hashUnit(seed, item, 508) * 0.065
      const fade = 1 - smoothStep(clamp01((time - (0.7 + child * 0.025)) / Math.max(0.05, childExpiry - 0.7 - child * 0.025)))
      const angle = direction + (hashUnit(seed, item, 509) - 0.5) * 2.5
      const travel = radius * (0.2 + hashUnit(seed, item, 510) * 0.36) * (1 - Math.exp(-4 * childAge))
      puffs.push({
        x: x + Math.cos(angle) * travel,
        y: y + Math.sin(angle) * travel - rise * 0.18 * childAge,
        radius: baseSize * (0.27 + 0.13 * hashUnit(seed, item, 511)) * (1 - 0.58 * childAge),
        weight: fade * (0.8 + 0.3 * hashUnit(seed, item, 512)),
        temperature: temperature * (0.8 - 0.5 * childAge),
        phase: angle,
      })
    }
  }
  // Tiny wisps persist after the main field has burnt away, without a connecting base.
  if (time > 0.72 && time < 0.99) for (let index = 0; index < count; index += 1) {
    const expiry = 0.98 + hashUnit(seed, index, 518) * 0.015
    const fade = 1 - smoothStep(clamp01((time - 0.92) / (expiry - 0.92)))
    puffs.push({
      x: centerX + (hashUnit(seed, index, 519) - 0.5) * radius * 1.7,
      y: centerY - radius * (0.35 + time * 0.7) + (hashUnit(seed, index, 520) - 0.5) * radius * 0.6,
      radius: radius * (0.1 + hashUnit(seed, index, 521) * 0.06) * (1 - 0.3 * time),
      weight: 0.7 * fade,
      temperature: 0.18,
      phase: hashUnit(seed, index, 522) * TAU,
    })
  }
  const density = new Float32Array(width * height)
  const heat = new Float32Array(width * height)
  for (const puff of puffs) {
    if (puff.weight <= 0.01 || puff.radius <= 0.5) continue
    const extent = puff.radius * 1.3
    for (let y = Math.max(1, Math.floor(puff.y - extent)); y < Math.min(height - 1, Math.ceil(puff.y + extent)); y += 1) {
      for (let x = Math.max(1, Math.floor(puff.x - extent)); x < Math.min(width - 1, Math.ceil(puff.x + extent)); x += 1) {
        const dx = x + 0.5 - puff.x
        const dy = y + 0.5 - puff.y
        const angle = Math.atan2(dy, dx)
        const warp = 1 + 0.09 * Math.sin(3 * angle + puff.phase) + 0.05 * Math.sin(5 * angle - puff.phase)
        const d2 = (dx * dx + dy * dy) / (puff.radius * puff.radius * warp * warp)
        if (d2 >= 1) continue
        const value = (1 - d2) ** 2 * puff.weight
        const offset = y * width + x
        density[offset] += value
        heat[offset] += value * puff.temperature
      }
    }
  }
  const dissolve = smoothStep(clamp01((time - parameters.motion.dissolveStart) / Math.max(0.05, 0.97 - parameters.motion.dissolveStart)))
  const threshold = 0.17 + dissolve * (body.smokeMotion === 'particulate' ? 0.12 : 0.11)
  const emberFade = 1 - smoothStep(clamp01((time - 0.16) / 0.34))
  const emberX = centerX + (hashUnit(seed, 0, 513) - 0.5) * radius * 0.22
  const emberY = centerY + radius * (0.08 - time * 0.16)
  const texturedDensity = new Float32Array(density.length)
  for (let y = 1; y < height - 1; y += 1) for (let x = 1; x < width - 1; x += 1) {
    const offset = y * width + x
    if (density[offset] <= 0) continue
    const texture = smokeNoise(seed ^ 0x5d48a1b3, x / (7 * scale), y / (7 * scale))
    texturedDensity[offset] = density[offset] * (0.82 + texture * 0.34)
    if (emberFade > 0) {
      const dx = (x + 0.5 - emberX) / (radius * 0.44)
      const dy = (y + 0.5 - emberY) / (radius * 0.3)
      const glow = 1 - smoothStep(clamp01(dx * dx + dy * dy))
      heat[offset] += density[offset] * emberFade * glow * (0.32 + texture * 0.18)
    }
  }
  for (let y = 1; y < height - 1; y += 1) for (let x = 1; x < width - 1; x += 1) {
    const offset = y * width + x
    const value = texturedDensity[offset]
    if (value <= threshold) continue
    const texture = (value / density[offset] - 0.82) / 0.34
    const interior = clamp01((value - threshold) / 1.25)
    const light = (centerX - x + centerY - y) / (radius * 3)
    const warmth = clamp01((heat[offset] / density[offset] + (texture - 0.5) * 0.18 + light * 0.045) * interior ** 0.3)
    const edge = texturedDensity[offset - 1] <= threshold || texturedDensity[offset + 1] <= threshold
      || texturedDensity[offset - width] <= threshold || texturedDensity[offset + width] <= threshold
    if (!edge) paintHeat(pixels, width, height, x, y, palette, warmth)
    else {
      const lit = texturedDensity[offset - 1] <= threshold || texturedDensity[offset - width] <= threshold
      writePixel(pixels, width, height, x, y, palette[palette.length - (lit ? 2 : 1)])
    }
  }
}
