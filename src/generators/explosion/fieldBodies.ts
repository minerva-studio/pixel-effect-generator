import type { RgbColor } from '../../shared/pixel/color'
import { clamp01, hashUnit, smoothStep } from '../../shared/pixel/rng'
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
