import type { PixelFrame } from '../../shared/pixel/frame'
import type { RgbColor } from '../../shared/pixel/color'
import { builtinPalette } from '../../shared/palette/library'
import { clamp01, hashUnit, smoothStep } from '../../shared/pixel/rng'
import { sampleFireballPalette } from './palette'
import { REFERENCE_VIEW, toReference, toTarget, type FireballView } from './view'

/**
 * Puff studies: fire is modelled as material, not as a shape cut from noise.
 * Every puff is a particle with a real trajectory, size, and temperature. One summed
 * metaball field owns the silhouette and the thermal bands, the way the flame's single
 * density field does; billows, necking and pinch-off emerge from particles separating.
 */
export interface PuffTuning {
  /** Explosion: number of primary fire masses. */
  readonly burstCount: number
  /** Explosion: how far the masses are thrown before drag stops them. */
  readonly burstReach: number
  /** Both: surface billows rolling over each mass (0 = smooth balls). */
  readonly billow: number
  /** Explosion: late upward drift of cooled material. */
  readonly buoyancy: number
  /** Fireball: number of masses shed per loop. */
  readonly trailCount: number
  /** Fireball: wake length relative to the canvas. */
  readonly trailLength: number
  /** Both: cooled material turns to smoke instead of dark embers. */
  readonly smoke: boolean
}

export const DEFAULT_PUFF_TUNING: PuffTuning = {
  burstCount: 9,
  burstReach: 0.6,
  billow: 0.6,
  buoyancy: 0.5,
  trailCount: 12,
  trailLength: 0.7,
  smoke: false,
}

const SIZE = 128
const TAU = Math.PI * 2
const fire = builtinPalette('flameGlow')
const smokeRamp = builtinPalette('smokeEmber')
/** Editable thermal palettes; defaults reproduce the reviewed particle study. */
export interface PuffPalette { readonly warm: readonly RgbColor[]; readonly smoke: readonly RgbColor[] }
export const DEFAULT_PUFF_PALETTE: PuffPalette = { warm: fire, smoke: smokeRamp }
/** Fire bands followed by the smoke tail used when `smoke` is enabled. */
export const PUFF_PALETTE: readonly RgbColor[] = [...fire, ...smokeRamp.slice(3)]

interface Puff {
  x: number
  y: number
  r: number
  /** 1 ≈ white-hot core, 0 ≈ cooled. May exceed 1 for the ignition core. */
  temp: number
  weight: number
  /** Lobe distortion carried in the puff's own frame, so it travels with the material. */
  lump: number
  spin: number
}

interface Field {
  density: Float32Array
  heat: Float32Array
}

function accumulate(puffs: readonly Puff[], width = SIZE, height = SIZE, view?: FireballView): Field {
  const density = new Float32Array(width * height)
  const heat = new Float32Array(width * height)
  for (const p of puffs) {
    if (p.r < 0.5 || p.weight <= 0) continue
    const reach = p.r * (1 + p.lump)
    for (let y = Math.max(1, Math.floor(p.y - reach)); y <= Math.min(height - 2, Math.ceil(p.y + reach)); y++) {
      for (let x = Math.max(1, Math.floor(p.x - reach)); x <= Math.min(width - 2, Math.ceil(p.x + reach)); x++) {
        if (view) {
          const reference = toReference(view, x, y)
          if (reference.x < 1 || reference.x >= 127 || reference.y < 1 || reference.y >= 127) continue
        }
        const dx = x - p.x, dy = y - p.y
        let d2 = (dx * dx + dy * dy) / (p.r * p.r)
        if (p.lump > 0 && d2 > 0.04) {
          const a = Math.atan2(dy, dx) + p.spin
          const scale = 1 + p.lump * (0.6 * Math.sin(a * 3) + 0.4 * Math.sin(a * 5 + 1.7))
          d2 /= scale * scale
        }
        if (d2 >= 1) continue
        const k = (1 - d2) * (1 - d2) * p.weight
        const i = y * width + x
        density[i] += k
        heat[i] += k * p.temp
      }
    }
  }
  return { density, heat }
}

/** Colour comes from the same field: mean temperature, brightened toward dense interiors. */
function resolve(field: Field, threshold: number, smoke: boolean, span = 0.9, palette: PuffPalette = DEFAULT_PUFF_PALETTE, width = SIZE, height = SIZE): PixelFrame {
  const fire = palette.warm
  const smokeRamp = palette.smoke
  const pixels = new Uint8ClampedArray(width * height * 4)
  for (let i = 0; i < field.density.length; i++) {
    const f = field.density[i]
    if (f <= threshold) continue
    const temp = field.heat[i] / f
    // Like the flame, heat falls to zero at the silhouette, so bands nest inside the outline.
    const interior = clamp01((f - threshold) / span)
    const h = temp * interior ** 0.55
    let color: RgbColor
    if (smoke && temp < 0.22) {
      color = sampleFireballPalette(smokeRamp, 3 + Math.min(2, Math.floor((1 - interior) * 3)), 6)
    } else {
      color = fire[Math.min(fire.length - 1, Math.max(0, Math.floor((1 - h) * fire.length)))]
    }
    pixels.set([color.r, color.g, color.b, 255], i * 4)
  }
  return { width, height, pixels }
}

/** Adds rolling surface billows around a mass; roll direction is per-mass. */
function billows(out: Puff[], parent: Puff, count: number, amount: number, roll: number, seed: number, id: number) {
  if (amount <= 0) return
  for (let j = 0; j < count; j++) {
    const a = hashUnit(seed, id * 7 + j, 91) * TAU + roll
    const offset = parent.r * (0.62 + 0.18 * hashUnit(seed, id * 7 + j, 92))
    out.push({
      x: parent.x + Math.cos(a) * offset,
      y: parent.y + Math.sin(a) * offset,
      r: parent.r * (0.42 + 0.14 * hashUnit(seed, id * 7 + j, 93)) * Math.sqrt(amount),
      temp: parent.temp * 0.82,
      weight: parent.weight * 0.9 * amount,
      lump: 0,
      spin: 0,
    })
  }
}

/** One-shot burst: ignition flash, masses thrown out and slowed by drag, rolling, cooling, rising, thinning. */
export function puffExplosion(time: number, seed: number, t: PuffTuning = DEFAULT_PUFF_TUNING): PixelFrame {
  if (time <= 0 || time >= 1) return { width: SIZE, height: SIZE, pixels: new Uint8ClampedArray(SIZE * SIZE * 4) }
  const cx = 64, cy = 70
  const puffs: Puff[] = []
  // Ignition core: a white-hot ball that swells quickly and hands over to the masses.
  const flashAge = clamp01(time / 0.14)
  puffs.push({ x: cx, y: cy, r: 5 + 17 * (1 - (1 - flashAge) ** 3), temp: 1.45 - 0.9 * smoothStep(clamp01((time - 0.08) / 0.3)),
    weight: 1.2 * (1 - smoothStep(clamp01((time - 0.12) / 0.35))), lump: 0.06, spin: time * 3 })
  const base = hashUnit(seed, 0, 11) * TAU
  const n = t.burstCount
  const inner = Math.max(2, Math.round(n / 3))
  for (let i = 0; i < n + inner; i++) {
    const core = i >= n
    const delay = hashUnit(seed, i, 12) * 0.07
    const age = clamp01((time - delay) / (0.95 - delay))
    if (age <= 0) continue
    const theta = core ? hashUnit(seed, i, 13) * TAU : base + (i / n) * TAU + (hashUnit(seed, i, 13) - 0.5) * (TAU / n) * 0.9
    // Slow inner masses keep the middle filled; outer masses carry the front.
    const speed = core ? 0.1 + 0.25 * hashUnit(seed, i, 14) : 0.5 + 0.5 * hashUnit(seed, i, 14)
    // Drag: most of the travel happens in the first quarter of the life.
    const travel = (12 + 46 * t.burstReach) * speed * (1 - Math.exp(-7 * age)) / (1 - Math.exp(-7))
    const rise = t.buoyancy * 20 * age * age
    const size = (core ? 13 : 10) + 6 * hashUnit(seed, i, 15)
    const fade = 1 - smoothStep(clamp01((age - 0.6) / 0.4))
    const mass: Puff = {
      x: cx + Math.cos(theta) * travel,
      y: cy + Math.sin(theta) * travel * 0.85 - rise,
      r: size * (0.35 + 0.8 * (1 - Math.exp(-5 * age))) * (0.55 + 0.45 * fade),
      // Fast outer masses cool first; the slow middle stays hot longest.
      temp: clamp01(1.2 - age ** 0.8 * (0.8 + 0.5 * speed)) * 1.1,
      weight: 1 - smoothStep(clamp01((age - 0.88) / 0.12)),
      lump: 0.1 + 0.1 * age,
      spin: hashUnit(seed, i, 16) * TAU + age * (hashUnit(seed, i, 17) < 0.5 ? -2 : 2),
    }
    puffs.push(mass)
    const roll = (hashUnit(seed, i, 18) < 0.5 ? -1 : 1) * age * TAU * 0.35
    billows(puffs, mass, 3, t.billow, roll, seed, i)
  }
  // Late thinning: rising threshold opens holes where the field is weakest (between masses).
  const threshold = 0.25 + 0.4 * smoothStep(clamp01((time - 0.6) / 0.4))
  return resolve(accumulate(puffs), threshold, t.smoke)
}

/** Seamless loop: a hot head sheds masses that slide around it and stream back, cooling and shrinking. */
export function puffFireball(time: number, seed: number, t: PuffTuning = DEFAULT_PUFF_TUNING, palette: PuffPalette = DEFAULT_PUFF_PALETTE, view: FireballView = REFERENCE_VIEW): PixelFrame {
  const phase = ((time % 1) + 1) % 1
  const hx = 94, hy = 64, headR = 14
  const puffs: Puff[] = []
  puffs.push({ x: hx, y: hy, r: headR * (1 + 0.04 * Math.sin(phase * TAU * 2)), temp: 0.95, weight: 1.3, lump: 0.05, spin: phase * TAU })
  // Bright core pushed toward the front.
  puffs.push({ x: hx + 4, y: hy, r: 8, temp: 1.35, weight: 1, lump: 0, spin: 0 })
  const m = t.trailCount
  const length = 20 + 60 * t.trailLength
  const wrap = 0.2
  for (let i = 0; i < m; i++) {
    const age = (phase + (i + 0.5 * hashUnit(seed, i, 31)) / m) % 1
    const side = (i % 2 === 0 ? 1 : -1) * (hashUnit(seed, i, 32) < 0.2 ? -1 : 1)
    const size = 8 + 3 * hashUnit(seed, i, 33)
    let puff: Puff
    if (age < wrap) {
      // Slides over the head surface from front to back.
      const s = age / wrap
      const theta = side * (0.4 + (Math.PI - 0.55) * smoothStep(s))
      const orbit = headR * 0.72
      puff = { x: hx + Math.cos(theta) * orbit, y: hy + Math.sin(theta) * orbit * 0.9, r: size * (0.7 + 0.3 * s), temp: 0.95, weight: 1, lump: 0.1, spin: s * 2 }
    } else {
      const b = (age - wrap) / (1 - wrap)
      const speed = 0.8 + 0.3 * hashUnit(seed, i, 34)
      const spread = 1 + hashUnit(seed, i, 35) * 5
      puff = {
        x: hx - headR * 0.72 - length * speed * b ** 0.85,
        y: hy + side * (Math.sin(0.15) * headR * 0.65 + spread * b) + 2 * Math.sin(b * 5 + i),
        r: size * (1 + 0.3 * b) * (1 - b * b) ** 0.7,
        temp: 0.95 - 0.9 * b ** 0.8,
        weight: 1,
        lump: 0.12 + 0.1 * b,
        spin: side * b * 3 + i,
      }
    }
    puffs.push(puff)
    billows(puffs, puff, 2, t.billow * 0.8, side * age * TAU, seed, i + 40)
  }
  // The head stacks several masses, so its bands need a deeper span to stay nested.
  const angle = Math.atan2(view.sin, view.cos)
  for (const puff of puffs) {
    const target = toTarget(view, puff.x, puff.y)
    puff.x = target.x
    puff.y = target.y
    puff.r *= view.scale
    puff.spin -= angle
  }
  return resolve(accumulate(puffs, view.width, view.height, view), 0.3, t.smoke, 1.9, palette, view.width, view.height)
}

export function renderPuffFrames(body: 'explosion' | 'fireball', seed: number, frameCount: number, tuning: PuffTuning = DEFAULT_PUFF_TUNING, palette: PuffPalette = DEFAULT_PUFF_PALETTE): PixelFrame[] {
  return Array.from({ length: frameCount }, (_, i) => body === 'explosion'
    ? puffExplosion(i / (frameCount - 1), seed, tuning)
    : puffFireball(i / frameCount, seed, tuning, palette))
}
