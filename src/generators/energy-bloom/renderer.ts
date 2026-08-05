import type { PixelFrame } from '../../shared/pixel/frame'
import { clamp01, createXorshift32, hashUnit, lerp, smoothStep } from '../../shared/pixel/rng'
import { renderCore } from '../shared-effects/core'
import { angularDistance } from '../shared-effects/balanced'
import type { FragmentDescriptor } from '../shared-effects/fragments'
import { generateFragments, renderFragments } from '../shared-effects/fragments'
import { writePixel } from '../shared-effects/output'
import { paletteIndex } from '../shared-effects/palette'
import { renderShockwave } from '../shared-effects/shockwave'
import { dissolveAmount, formationGrowth, lifecycleAt } from '../shared-effects/timing'
import { renderTongues } from '../shared-effects/tongues'
import type { LobeView, SurfaceSample } from '../shared-effects/types'
import {
  assertValidBloomParameters,
  bloomShapeCount,
  type BloomParameters,
  type BloomSurfaceParameters,
} from './model'

interface DirectionDescriptor {
  readonly layer: number
  readonly angle: number
  readonly lengthScale: number
  readonly widthScale: number
  readonly delay: number
  readonly tongueNoise: number
  readonly curveSign: number
}

/** Renders a complete deterministic energy bloom or convergence animation. */
export function renderBloomFrames(parameters: BloomParameters): PixelFrame[] {
  assertValidBloomParameters(parameters)
  const fragments = generateFragments(parameters.palette, parameters.seed, parameters.fragments)
  const directions = generateDirections(parameters)
  return Array.from({ length: parameters.frameCount }, (_, frameIndex) => (
    renderBloomFrame(parameters, fragments, directions, frameIndex)
  ))
}

/** Renders one non-looping frame while preserving transparent endpoints. */
function renderBloomFrame(
  parameters: BloomParameters,
  fragments: readonly FragmentDescriptor[],
  directions: readonly DirectionDescriptor[],
  frameIndex: number,
): PixelFrame {
  const width = parameters.canvasWidth
  const height = parameters.canvasHeight
  const pixels = new Uint8ClampedArray(width * height * 4)
  if (frameIndex === 0 || frameIndex === parameters.frameCount - 1) return { width, height, pixels }
  const time = frameIndex / (parameters.frameCount - 1)
  const lifecycle = lifecycleAt(parameters.motion.mode, time)
  renderBloomBody(pixels, width, height, parameters, directions, time)
  const views = shapeViews(parameters, directions, time)
  const angles = views.map((view) => view.angle)
  renderShockwave(
    pixels, width, height, parameters.palette, parameters.motion.mode,
    parameters.body.radius, parameters.shockwave, angles, parameters.seed, time,
  )
  renderCore(pixels, width, height, parameters.palette, parameters.motion.mode, parameters.core, time)
  renderTongues(
    pixels, width, height, parameters.palette, parameters.motion.mode,
    parameters.tongues, views, 'energy', parameters.seed,
    dissolveAmount(parameters.motion, lifecycle), time,
  )
  renderFragments(
    pixels, width, height, parameters.palette, parameters.motion.mode,
    parameters.fragments, fragments, parameters.body.radius, 'shard', parameters.seed, time,
  )
  return { width, height, pixels }
}

/** Creates stable petal, ray, or corolla descriptors from the active shape. */
function generateDirections(parameters: BloomParameters): DirectionDescriptor[] {
  const random = createXorshift32(parameters.seed ^ 0x71e4a2d9)
  const unit = () => random() / 0x100000000
  const irregularity = parameters.body.shapeIrregularity
  const rotation = parameters.body.rotation / 180 * Math.PI
  const body = parameters.body
  if (body.shape === 'sharpStarburst') {
    return Array.from({ length: body.rayCount }, (_, index) => ({
      layer: 0,
      angle: rotation + index / body.rayCount * Math.PI * 2 + (unit() * 2 - 1) * (Math.PI / body.rayCount) * irregularity * 0.5,
      lengthScale: 1 + (unit() * 2 - 1) * 0.14 * irregularity,
      widthScale: 1 + (unit() * 2 - 1) * 0.14 * irregularity,
      delay: unit() * 0.08 * irregularity,
      tongueNoise: unit() * 2 - 1,
      curveSign: unit() < 0.5 ? -1 : 1,
    }))
  }
  if (body.shape === 'layeredCorolla') {
    return Array.from({ length: body.corollaLayers }, (_, layer) => (
      Array.from({ length: body.petalCount }, (_, index) => ({
        layer,
        angle: rotation + layer * (Math.PI / body.petalCount) + index / body.petalCount * Math.PI * 2
          + (unit() * 2 - 1) * (Math.PI / body.petalCount) * irregularity * 0.72,
        lengthScale: 1 + (unit() * 2 - 1) * 0.18 * irregularity,
        widthScale: 1 + (unit() * 2 - 1) * 0.16 * irregularity,
        delay: layer * body.layerDelay + unit() * 0.08 * irregularity,
        tongueNoise: unit() * 2 - 1,
        curveSign: unit() < 0.5 ? -1 : 1,
      }))
    )).flat()
  }
  return Array.from({ length: body.petalCount }, (_, index) => ({
    layer: 0,
    angle: rotation + index / body.petalCount * Math.PI * 2 + (unit() * 2 - 1) * (Math.PI / body.petalCount) * irregularity * 0.72,
    lengthScale: 1 + (unit() * 2 - 1) * 0.18 * irregularity,
    widthScale: 1 + (unit() * 2 - 1) * 0.16 * irregularity,
    delay: unit() * 0.08 * irregularity,
    tongueNoise: unit() * 2 - 1,
    curveSign: unit() < 0.5 ? -1 : 1,
  }))
}

/** Resolves one petal/ray geometry for a descriptor at the current time. */
function directionGeometry(
  parameters: BloomParameters,
  direction: DirectionDescriptor,
  lifecycle: number,
): { readonly growth: number; readonly major: number; readonly minor: number; readonly centerDistance: number; readonly tipDistance: number } {
  const growth = formationGrowth(parameters.motion.mode, parameters.motion, lifecycle, direction.delay)
  const body = parameters.body
  if (body.shape === 'sharpStarburst') {
    const length = Math.max(0.75, body.radius * growth * lerp(0.85, 1.2, body.rayTaper) * direction.lengthScale)
    return { growth, major: length, minor: 0, centerDistance: 0, tipDistance: length }
  }
  const major = Math.max(0.75, body.radius * growth * lerp(0.3, 0.45, body.petalStretch) * direction.lengthScale * (1 - direction.layer * 0.12))
  const minor = Math.max(0.75, body.radius * growth * lerp(0.23, 0.15, body.petalStretch) * direction.widthScale * (1 - direction.layer * 0.1))
  const centerDistance = body.radius * growth * (0.34 + body.petalStretch * 0.14) * (0.72 + direction.layer * 0.26)
  return { growth, major, minor, centerDistance, tipDistance: centerDistance + major }
}

/** Draws the selected bloom body with the family surface treatment. */
function renderBloomBody(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  parameters: BloomParameters,
  directions: readonly DirectionDescriptor[],
  time: number,
): void {
  if (parameters.surface.coverage === 0) return
  const lifecycle = lifecycleAt(parameters.motion.mode, time)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sample = sampleShape(parameters, directions, x, y, lifecycle, time)
      if (!sample) continue
      const colorIndex = surfaceColorIndex(parameters, sample, x, y, lifecycle)
      if (colorIndex !== undefined) writePixel(pixels, width, height, x, y, parameters.palette[colorIndex])
    }
  }
  if (parameters.surface.style === 'celBands') {
    fillEnclosedCelHoles(pixels, width, height, parameters.palette[Math.min(1, parameters.palette.length - 1)])
  }
}

/** Fills transparent regions that cannot reach the canvas edge, preserving edge-only cel erosion. */
function fillEnclosedCelHoles(pixels: Uint8ClampedArray, width: number, height: number, color: { readonly r: number; readonly g: number; readonly b: number }): void {
  const outside = new Uint8Array(width * height)
  const queue: number[] = []
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    if (x !== 0 && y !== 0 && x !== width - 1 && y !== height - 1) continue
    const index = y * width + x
    if (pixels[index * 4 + 3] === 0 && !outside[index]) {
      outside[index] = 1
      queue.push(index)
    }
  }
  while (queue.length > 0) {
    const current = queue.pop()!
    const x = current % width
    const y = Math.floor(current / width)
    for (const [nextX, nextY] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
      if (nextX < 0 || nextY < 0 || nextX >= width || nextY >= height) continue
      const next = nextY * width + nextX
      if (outside[next] || pixels[next * 4 + 3] !== 0) continue
      outside[next] = 1
      queue.push(next)
    }
  }
  for (let index = 0; index < outside.length; index += 1) {
    if (outside[index] || pixels[index * 4 + 3] !== 0) continue
    writePixel(pixels, width, height, index % width, Math.floor(index / width), color)
  }
}

/** Samples the active petal, star, or corolla silhouette. */
function sampleShape(
  parameters: BloomParameters,
  directions: readonly DirectionDescriptor[],
  x: number,
  y: number,
  lifecycle: number,
  time: number,
): SurfaceSample | undefined {
  const centerX = parameters.canvasWidth / 2
  const centerY = parameters.canvasHeight / 2
  const dx = x + 0.5 - centerX
  const dy = y + 0.5 - centerY
  const distance = Math.hypot(dx, dy)
  if (parameters.body.shape === 'sharpStarburst') return sampleStarburst(parameters, directions, dx, dy, distance, lifecycle)
  const baseGrowth = formationGrowth(parameters.motion.mode, parameters.motion, lifecycle)
  const baseRadius = Math.max(0.5, parameters.body.radius * 0.19 * baseGrowth)
  let best: SurfaceSample | undefined = distance <= baseRadius && baseRadius > 0
    ? { depth: 1 - distance / baseRadius, axis: 0, directionIndex: 0 }
    : undefined
  directions.forEach((direction, index) => {
    const geometry = directionGeometry(parameters, direction, lifecycle)
    if (geometry.growth <= 0) return
    const localX = dx * Math.cos(direction.angle) + dy * Math.sin(direction.angle) - geometry.centerDistance
    const localY = -dx * Math.sin(direction.angle) + dy * Math.cos(direction.angle)
    const normalized = Math.sqrt((localX / geometry.major) ** 2 + (localY / geometry.minor) ** 2)
    if (normalized > 1) return
    const candidate = {
      depth: 1 - normalized,
      axis: clamp01((localX + geometry.major) / (geometry.major * 2)),
      directionIndex: index,
    }
    if (!best || candidate.depth > best.depth) best = candidate
  })
  return best
}

/** Samples controlled tapered star rays expanding from the shared center. */
function sampleStarburst(
  parameters: BloomParameters,
  directions: readonly DirectionDescriptor[],
  dx: number,
  dy: number,
  distance: number,
  lifecycle: number,
): SurfaceSample | undefined {
  const baseGrowth = formationGrowth(parameters.motion.mode, parameters.motion, lifecycle)
  const baseRadius = Math.max(0.5, parameters.body.radius * 0.18 * baseGrowth)
  if (distance <= baseRadius) return { depth: 1 - distance / baseRadius, axis: 0, directionIndex: 0 }
  const angle = Math.atan2(dy, dx)
  let best: SurfaceSample | undefined
  directions.forEach((direction, index) => {
    const geometry = directionGeometry(parameters, direction, lifecycle)
    if (geometry.growth <= 0) return
    const delta = angularDistance(angle, direction.angle)
    const halfWidth = Math.PI / directions.length * 0.5
    if (delta > halfWidth) return
    const taper = lerp(0.7, 2.2, parameters.body.rayTaper)
    const extent = geometry.tipDistance * (1 - delta / halfWidth) ** taper
    if (distance > extent || extent <= 0) return
    const candidate = { depth: 1 - distance / extent, axis: distance / extent, directionIndex: index }
    if (!best || candidate.depth > best.depth) best = candidate
  })
  return best
}

/** Selects a palette band or removes a pixel according to the active surface. */
function surfaceColorIndex(
  parameters: BloomParameters,
  sample: SurfaceSample,
  x: number,
  y: number,
  lifecycle: number,
): number | undefined {
  const surface = parameters.surface
  const coverageInset = (1 - surface.coverage) * 0.32
  if (sample.depth < coverageInset) return undefined
  const dissolve = dissolveAmount(parameters.motion, lifecycle)
  switch (surface.style) {
    case 'celBands': return celBand(parameters, surface, sample, x, y, dissolve)
    case 'moltenCavities': return moltenBand(parameters, surface, sample, x, y, dissolve)
    case 'crystalShards': return crystalBand(parameters, surface, sample, x, y, dissolve)
    case 'gridNoise': return gridNoiseBand(parameters, sample, x, y, dissolve)
    case 'pixelNoise': return pixelNoiseBand(parameters, sample, x, y, dissolve)
  }
}

/** Produces solid bands and continuous low-frequency edge erosion. */
function celBand(
  parameters: BloomParameters,
  surface: Extract<BloomSurfaceParameters, { style: 'celBands' }>,
  sample: SurfaceSample,
  x: number,
  y: number,
  dissolve: number,
): number | undefined {
  const field = interpolatedNoise(parameters.seed ^ 0x194f3a7d, x / 13, y / 13)
  const erosion = dissolve * (0.16 + surface.edgeBreakup * 0.38) * lerp(0.82, 1.18, field)
  if (sample.depth < erosion) return undefined
  const band = sample.axis * 0.72 + (1 - sample.depth) * 0.28 + (field - 0.5) * surface.bandWarp * 0.18
  return paletteIndex(parameters.palette, band)
}

/** Produces a bright shell around a bounded number of molten cavities. */
function moltenBand(
  parameters: BloomParameters,
  surface: Extract<BloomSurfaceParameters, { style: 'moltenCavities' }>,
  sample: SurfaceSample,
  x: number,
  y: number,
  dissolve: number,
): number | undefined {
  if (sample.depth < 0.14) return parameters.palette.length - 1
  const field = interpolatedNoise(parameters.seed ^ 0xa5c31e27, x / surface.cavityScale, y / surface.cavityScale)
  const threshold = 0.08 + surface.cavityAmount * 0.48 + dissolve * 0.18
  if (field < threshold) return undefined
  if (field < threshold + 0.09) return 0
  const molten = clamp01((field - threshold) / Math.max(0.01, 1 - threshold))
  return paletteIndex(parameters.palette, (1 - molten) * 0.58 + sample.axis * 0.3)
}

/** Produces crystal plates separated by stable one- or two-pixel cracks. */
function crystalBand(
  parameters: BloomParameters,
  surface: Extract<BloomSurfaceParameters, { style: 'crystalShards' }>,
  sample: SurfaceSample,
  x: number,
  y: number,
  dissolve: number,
): number | undefined {
  const cell = surface.chunkSize
  const row = Math.floor(y / cell)
  const shiftedX = x + (row % 2) * Math.floor(cell / 2) + Math.floor(hashUnit(parameters.seed, row, 1) * 3)
  const localX = ((shiftedX % cell) + cell) % cell
  const localY = ((y + Math.floor(hashUnit(parameters.seed, Math.floor(x / cell), 2) * 3)) % cell + cell) % cell
  if ((localX < surface.crackWidth || localY < surface.crackWidth) && sample.depth < 0.82) return undefined
  const cellHash = hashUnit(parameters.seed ^ 0x632be59b, Math.floor(shiftedX / cell), row)
  if (cellHash < dissolve * 0.78) return undefined
  return paletteIndex(parameters.palette, sample.axis * 0.62 + cellHash * 0.28 + (1 - sample.depth) * 0.1)
}

/** Applies fixed four-pixel grid rejection inside the shared shape. */
function gridNoiseBand(
  parameters: BloomParameters,
  sample: SurfaceSample,
  x: number,
  y: number,
  dissolve: number,
): number | undefined {
  const cluster = hashUnit(parameters.seed ^ 0x9e3779b9, Math.floor(x / 4), Math.floor(y / 4))
  if (cluster > parameters.surface.coverage * (1 - dissolve * 0.7)) return undefined
  return paletteIndex(parameters.palette, sample.axis * 0.7 + (1 - sample.depth) * 0.3)
}

/** Applies fixed one-pixel erosion inside the shared shape. */
function pixelNoiseBand(
  parameters: BloomParameters,
  sample: SurfaceSample,
  x: number,
  y: number,
  dissolve: number,
): number | undefined {
  const survival = parameters.surface.coverage * (1 - dissolve)
  if (hashUnit(parameters.seed ^ 0x9e3779b9, x, y) > survival - (1 - sample.depth) * 0.18) return undefined
  return paletteIndex(parameters.palette, sample.axis * 0.68 + (1 - sample.depth) * 0.32)
}

/** Samples smooth deterministic low-frequency noise. */
function interpolatedNoise(seed: number, x: number, y: number): number {
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const tx = smoothStep(x - x0)
  const ty = smoothStep(y - y0)
  const top = lerp(hashUnit(seed, x0, y0), hashUnit(seed, x0 + 1, y0), tx)
  const bottom = lerp(hashUnit(seed, x0, y0 + 1), hashUnit(seed, x0 + 1, y0 + 1), tx)
  return lerp(top, bottom, ty)
}

/** Resolves balanced tip directions for the active shape at one point in time. */
function shapeViews(
  parameters: BloomParameters,
  directions: readonly DirectionDescriptor[],
  time: number,
): LobeView[] {
  const lifecycle = lifecycleAt(parameters.motion.mode, time)
  return directions.map((direction) => {
    const geometry = directionGeometry(parameters, direction, lifecycle)
    return {
      angle: direction.angle,
      tipDistance: geometry.tipDistance,
      growth: geometry.growth,
      lengthScale: direction.lengthScale,
      tongueNoise: direction.tongueNoise,
      curveSign: direction.curveSign,
    }
  })
}

export { bloomShapeCount }
