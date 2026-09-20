import type { PixelFrame } from '../../shared/pixel/frame'
import { hashUnit } from '../../shared/pixel/rng'
import { assertValidFlameParameters, type FlameParameters } from './model'

const TAU = Math.PI * 2

/** Samples one complete loop without duplicating its first frame. */
export function renderFlameFrames(p: FlameParameters): PixelFrame[] {
  assertValidFlameParameters(p)
  return Array.from({ length: p.frameCount }, (_, i) => renderFlameFrame(p, i / p.frameCount))
}

/** Evaluates an arbitrary loop phase. Every temporal frequency is an integer. */
export function renderFlameFrame(p: FlameParameters, time: number): PixelFrame {
  assertValidFlameParameters(p)
  if (!Number.isFinite(time)) throw new RangeError('Flame time must be finite.')
  const phase = ((time % 1 + 1) % 1) * TAU * p.loopCycles
  const width = p.canvasWidth, height = p.canvasHeight
  const pixels = new Uint8ClampedArray(width * height * 4)
  const mask = new Uint8Array(width * height)
  const heat = new Float32Array(width * height)
  const rootY = height - 3, rootX = (width - 1) / 2
  // One advected density field owns both silhouette and color bands. Peaks emerge
  // from that field; there are no permanently assigned center or side tongues.
  const shapeWidth = p.shape === 'candle' ? 0.7 : p.shape === 'torch' ? 0.95 : 1.15
  const frequency = p.shape === 'candle' ? 1.5 : p.shape === 'torch' ? 2.4 : 3.5
  const intensity = p.turbulence * (p.shape === 'candle' ? 0.55 : 1)
  const a = hashUnit(p.seed, 0, 17) * TAU
  const b = hashUnit(p.seed, 1, 17) * TAU
  const flowPhase = phase * p.flowSpeed
  const baseFraction = p.baseWidth / p.width
  const top = Math.max(0, Math.floor(rootY - p.height * 1.16))
  const left = Math.max(0, Math.floor(rootX - p.width * 0.7))
  const right = Math.min(width - 1, Math.ceil(rootX + p.width * 0.7))
  for (let y = top; y <= rootY; y++) {
    const v = (rootY - y) / p.height
    const lift = Math.min(1, v * 4) ** 2
    const sway = p.sway * 0.24 * v * Math.sin(phase + a)
    const curl = intensity * 0.4 * v * Math.sin(v * 9 - flowPhase + a)
      + intensity * 0.12 * v * Math.sin(v * 19 - flowPhase * 2 + b)
    const breadth = Math.max(0.08, baseFraction * (1 - Math.min(v, 1))
      + shapeWidth * Math.sin(Math.min(v, 1) * Math.PI * 0.9) ** 0.8)
      * (1 + p.flicker * 0.08 * lift * Math.sin(v * 7 - phase + b))
    for (let x = left; x <= right; x++) {
      const u = (x - rootX) / (p.width * 0.5)
      const q = u - sway - curl
      const flow = 0.65 * Math.sin(q * frequency * 3 + v * 11 - flowPhase + a)
        + 0.35 * Math.sin(q * frequency * 5 - v * 17 + flowPhase * 2 + b)
      const split = Math.sin(q * frequency * 7 + v * 8 - flowPhase * 2 + b)
      const tipFade = Math.max(0, Math.min(1, (1.12 - v) / 0.25))
      const deformation = lift * tipFade * (intensity * 0.3 * flow + p.fork * intensity * 0.17 * split)
      const rough = p.roughness * 0.035 * lift * tipFade * Math.sin(u * 39 + v * 43 - flowPhase * 3 + a)
      const density = 1 - v - (q / breadth) ** 2 + deformation + rough
        + p.flicker * 0.06 * lift * tipFade * Math.sin(v * 8 - phase + a)
      if (density <= 0) continue
      const index = y * width + x
      mask[index] = 1
      heat[index] = Math.max(0, density + p.bandWarp * 0.1 * lift * flow)
    }
  }
  if (p.edgeBreakup > 0) erodeFlameEdge(mask, width, height, rootY, phase, p)
  // Keep the rooted body; edge breakup may retain a bounded number of small flame chips.
  const connected = new Uint8Array(mask.length)
  const queue: number[] = []
  for (let x = 0; x < width; x++) if (mask[rootY * width + x]) { queue.push(rootY * width + x); connected[rootY * width + x] = 1 }
  for (let head = 0; head < queue.length; head++) {
    const index = queue[head], x = index % width
    for (const next of [x > 0 ? index - 1 : -1, x < width - 1 ? index + 1 : -1, index - width, index + width]) {
      if (next >= 0 && next < mask.length && mask[next] && !connected[next]) { connected[next] = 1; queue.push(next) }
    }
  }
  if (p.edgeBreakup > 0) {
    const chipLimit = Math.ceil(p.edgeBreakup * 5)
    const chipSize = Math.max(2, Math.round(Math.min(p.width, p.height) * 0.07))
    const chips: number[][] = []
    for (let i = 0; i < mask.length; i++) {
      if (!mask[i] || connected[i]) continue
      const chip = [i]
      connected[i] = 1
      for (let head = 0; head < chip.length; head++) {
        const index = chip[head], x = index % width
        for (const next of [x > 0 ? index - 1 : -1, x < width - 1 ? index + 1 : -1, index - width, index + width]) {
          if (next >= 0 && next < mask.length && mask[next] && !connected[next]) { connected[next] = 1; chip.push(next) }
        }
      }
      if (chip.length >= 2 && chip.length <= chipSize * chipSize * 2) chips.push(chip)
    }
    chips.sort((a, b) => b.length - a.length || a[0] - b[0])
    for (const chip of chips.slice(0, chipLimit)) queue.push(...chip)
  }
  const paint = (index: number, band: number) => {
    const color = p.palette[Math.max(0, Math.min(p.palette.length - 1, band))]
    pixels.set([color.r, color.g, color.b, 255], index * 4)
  }
  for (const index of queue) {
    const level = Math.min(1, heat[index] * (0.65 + p.coreSize * 0.8))
    paint(index, Math.min(p.palette.length - 1, Math.floor((1 - level) * p.palette.length)))
  }
  if (p.sparksEnabled) for (let i = 0; i < p.sparkCount; i++) {
    const age = ((phase / TAU + hashUnit(p.seed, i, 61)) % 1 + 1) % 1
    if (age < 0.08 || age > 0.9) continue
    const side = hashUnit(p.seed, i, 62) * 2 - 1
    const x = Math.round(rootX + side * p.width * (0.15 + p.sparkSpread * age * 0.7) + Math.sin(phase + i) * age * 2)
    const y = Math.round(rootY - p.height * (0.5 + hashUnit(p.seed, i, 63) * 0.25) - age * p.sparkRise)
    if (x >= 0 && x < width && y >= 0 && y < height) paint(y * width + x, Math.floor(age * (p.palette.length - 1)))
  }
  return { width, height, pixels }
}

/** Cuts periodic, seed-stable blocks into the outer shell without eroding the anchored root. */
function erodeFlameEdge(mask: Uint8Array, width: number, height: number, rootY: number, phase: number, p: FlameParameters): void {
  const distance = new Uint16Array(mask.length)
  const boundary: number[] = []
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue
    const x = i % width, y = Math.floor(i / width)
    if (x === 0 || x === width - 1 || y === 0 || y === height - 1 || !mask[i - 1] || !mask[i + 1] || !mask[i - width] || !mask[i + width]) {
      distance[i] = 1
      boundary.push(i)
    }
  }
  const depth = Math.max(1, Math.min(p.width, p.height) * 0.17) * p.edgeBreakup
  for (let head = 0; head < boundary.length; head++) {
    const i = boundary[head], x = i % width
    if (distance[i] > depth) continue
    for (const n of [x > 0 ? i - 1 : -1, x < width - 1 ? i + 1 : -1, i - width, i + width]) {
      if (n >= 0 && n < mask.length && mask[n] && !distance[n]) { distance[n] = distance[i] + 1; boundary.push(n) }
    }
  }
  const cell = Math.max(2, Math.round(Math.min(p.width, p.height) * 0.07))
  const rows = Math.ceil(p.height * 1.2 / cell) + 2
  const scroll = (phase / TAU % 1) * rows
  for (const i of boundary) {
    const y = Math.floor(i / width)
    const rise = (rootY - y) / p.height
    if (rise < 0.12) continue
    const x = i % width
    const gy = Math.floor((rootY - y) / cell - scroll)
    const wrappedY = (gy % rows + rows) % rows
    const noise = hashUnit(p.seed ^ 0x5f31, Math.floor(x / cell), wrappedY)
    const localDepth = depth * Math.min(1, (rise - 0.12) * 4) * (0.5 + noise * 0.5)
    if (noise > 0.48 - p.edgeBreakup * 0.25 && distance[i] <= localDepth) mask[i] = 0
  }
}
