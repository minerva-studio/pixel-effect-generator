import type { PixelFrame } from '../../shared/pixel/frame'
import { clamp01, createXorshift32, hashUnit, lerp, smoothStep } from '../../shared/pixel/rng'
import { renderCore } from '../shared-effects/core'
import { generateFragments, renderFragments } from '../shared-effects/fragments'
import { writePixel } from '../shared-effects/output'
import { paletteIndex } from '../shared-effects/palette'
import { renderShockwave } from '../shared-effects/shockwave'
import { dissolveAmount, formationGrowth, legacyRadialProgress, lifecycleAt } from '../shared-effects/timing'
import { renderTongues } from '../shared-effects/tongues'
import type { FragmentDescriptor } from '../shared-effects/fragments'
import type { LobeView, SurfaceSample } from '../shared-effects/types'
import {
  assertValidExplosionParameters,
  explosionShapeCount,
  type ExplosionParameters,
  type ExplosionSurfaceParameters,
} from './model'

interface BlobDescriptor {
  readonly angle: number
  readonly radiusScale: number
  readonly delay: number
  readonly tongueNoise: number
  readonly curveSign: number
}

/** Renders a complete deterministic combustion explosion or implosion animation. */
export function renderExplosionFrames(parameters: ExplosionParameters): PixelFrame[] {
  assertValidExplosionParameters(parameters)
  const fragments = generateFragments(parameters.palette, parameters.seed, parameters.fragments)
  const blobs = parameters.body.shape === 'billowingFireball' ? generateBlobs(parameters) : []
  return Array.from({ length: parameters.frameCount }, (_, frameIndex) => (
    renderExplosionFrame(parameters, fragments, blobs, frameIndex)
  ))
}

/** Renders one non-looping frame while preserving transparent endpoints. */
function renderExplosionFrame(
  parameters: ExplosionParameters,
  fragments: readonly FragmentDescriptor[],
  blobs: readonly BlobDescriptor[],
  frameIndex: number,
): PixelFrame {
  const width = parameters.canvasWidth
  const height = parameters.canvasHeight
  const pixels = new Uint8ClampedArray(width * height * 4)
  if (frameIndex === 0 || frameIndex === parameters.frameCount - 1) return { width, height, pixels }
  const time = frameIndex / (parameters.frameCount - 1)
  const lifecycle = lifecycleAt(parameters.motion.mode, time)
  const legacyBody = parameters.body.shape === 'legacyRadial' && parameters.surface.style === 'retroPixel'
  if (legacyBody) renderLegacyPixelNoiseBody(pixels, width, height, parameters, time)
  else renderModernBody(pixels, width, height, parameters, blobs, time)
  const views = shapeViews(parameters, blobs, time)
  renderShockwave(
    pixels, width, height, parameters.palette, parameters.motion.mode,
    parameters.body.radius, parameters.shockwave, time,
  )
  renderCore(pixels, width, height, parameters.palette, parameters.motion.mode, parameters.core, time)
  renderTongues(
    pixels, width, height, parameters.palette, parameters.motion.mode,
    parameters.tongues, views, 'fire', parameters.seed,
    dissolveAmount(parameters.motion, lifecycle), time,
  )
  renderFragments(
    pixels, width, height, parameters.palette, parameters.motion.mode,
    parameters.fragments, fragments, parameters.body.radius, 'char', parameters.seed, time,
  )
  return { width, height, pixels }
}

/** Creates evenly distributed fireball blobs whose variation vanishes at zero irregularity. */
function generateBlobs(parameters: ExplosionParameters): BlobDescriptor[] {
  const count = explosionShapeCount(parameters.body.shape)
  const random = createXorshift32(parameters.seed ^ 0x71e4a2d9)
  const unit = () => random() / 0x100000000
  const irregularity = parameters.body.shapeIrregularity
  const rotation = parameters.body.rotation / 180 * Math.PI
  return Array.from({ length: count }, (_, index) => ({
    angle: rotation + index / count * Math.PI * 2 + (unit() * 2 - 1) * (Math.PI / count) * irregularity * 0.72,
    radiusScale: 1 + (unit() * 2 - 1) * 0.22 * irregularity,
    delay: unit() * 0.08 * irregularity,
    tongueNoise: unit() * 2 - 1,
    curveSign: unit() < 0.5 ? -1 : 1,
  }))
}

/** Resolves the active shape silhouette as depth, axis, and owning direction. */
function sampleShape(
  parameters: ExplosionParameters,
  blobs: readonly BlobDescriptor[],
  x: number,
  y: number,
  time: number,
): SurfaceSample | undefined {
  const centerX = parameters.canvasWidth / 2
  const centerY = parameters.canvasHeight / 2
  const dx = x + 0.5 - centerX
  const dy = y + 0.5 - centerY
  const distance = Math.hypot(dx, dy)
  const lifecycle = lifecycleAt(parameters.motion.mode, time)
  switch (parameters.body.shape) {
    case 'billowingFireball': return sampleBillowing(parameters, blobs, dx, dy, distance, lifecycle, time)
    case 'pressureBurst': return samplePressure(parameters, dx, dy, distance, lifecycle)
    case 'legacyRadial': return sampleLegacyDisc(parameters, distance, lifecycle)
  }
}

/** Samples the rolling union of churning fireball blobs around a hot core. */
function sampleBillowing(
  parameters: ExplosionParameters,
  blobs: readonly BlobDescriptor[],
  dx: number,
  dy: number,
  distance: number,
  lifecycle: number,
  time: number,
): SurfaceSample | undefined {
  const radius = parameters.body.radius
  const churnAmount = parameters.body.churnAmount
  const baseGrowth = formationGrowth(parameters.motion.mode, parameters.motion, lifecycle)
  const coreRadius = Math.max(0.5, radius * 0.3 * baseGrowth)
  let best: SurfaceSample | undefined = distance <= coreRadius
    ? { depth: 1 - distance / coreRadius, axis: distance / coreRadius, directionIndex: 0 }
    : undefined
  blobs.forEach((blob, index) => {
    const growth = formationGrowth(parameters.motion.mode, parameters.motion, lifecycle, blob.delay)
    if (growth <= 0) return
    const churn = 1 + Math.sin(time * Math.PI * 2 * 1.5 + index * 0.9) * 0.08 * churnAmount
    const centerDistance = radius * 0.34 * growth
    const blobRadius = Math.max(0.5, radius * (0.3 + 0.1 * churnAmount) * growth * blob.radiusScale * churn)
    const localX = dx - Math.cos(blob.angle) * centerDistance
    const localY = dy - Math.sin(blob.angle) * centerDistance
    const localDistance = Math.hypot(localX, localY)
    if (localDistance > blobRadius) return
    const candidate = {
      depth: 1 - localDistance / blobRadius,
      axis: localDistance / blobRadius,
      directionIndex: index,
    }
    if (!best || candidate.depth > best.depth) best = candidate
  })
  return best
}

/** Samples the center-connected pressure front disc with a hot leading edge. */
function samplePressure(
  parameters: ExplosionParameters,
  dx: number,
  dy: number,
  distance: number,
  lifecycle: number,
): SurfaceSample | undefined {
  const growth = formationGrowth(parameters.motion.mode, parameters.motion, lifecycle)
  if (growth <= 0) return undefined
  const radius = parameters.body.radius * growth
  const contourNoise = (1 - parameters.body.pressureSharpness) * parameters.body.shapeIrregularity * 0.2
  const wobble = 1 + (hashUnit(parameters.seed ^ 0x8a5f, Math.floor(dx), Math.floor(dy)) * 2 - 1) * contourNoise
  if (distance > radius * wobble || radius <= 0) return undefined
  return { depth: 1 - distance / radius, axis: distance / radius, directionIndex: 0 }
}

/** Samples a plain radial disc used by legacy shapes with non-retro surfaces. */
function sampleLegacyDisc(
  parameters: ExplosionParameters,
  distance: number,
  lifecycle: number,
): SurfaceSample | undefined {
  const growth = formationGrowth(parameters.motion.mode, parameters.motion, lifecycle)
  const radius = parameters.body.radius * growth
  if (radius <= 0 || distance > radius) return undefined
  return { depth: 1 - distance / radius, axis: distance / radius, directionIndex: 0 }
}

/** Draws the selected modern body and applies the family surface treatment. */
function renderModernBody(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  parameters: ExplosionParameters,
  blobs: readonly BlobDescriptor[],
  time: number,
): void {
  if (parameters.surface.coverage === 0) return
  const lifecycle = lifecycleAt(parameters.motion.mode, time)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sample = sampleShape(parameters, blobs, x, y, time)
      if (!sample) continue
      let colorIndex = surfaceColorIndex(parameters, sample, x, y, lifecycle)
      if (colorIndex === undefined) continue
      if (parameters.body.shape === 'pressureBurst' && sample.axis >= 1 - parameters.body.pressureWidth / Math.max(1, parameters.body.radius)) {
        colorIndex = Math.min(1, parameters.palette.length - 1)
      }
      writePixel(pixels, width, height, x, y, parameters.palette[colorIndex])
    }
  }
}

/** Selects a palette band or removes a pixel according to the active surface. */
function surfaceColorIndex(
  parameters: ExplosionParameters,
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
    case 'burningLayers': return burningBand(parameters, surface, sample, x, y, dissolve)
    case 'rollingSoot': return sootBand(parameters, surface, sample, x, y, dissolve)
    case 'retroPixel': return retroPixelBand(parameters, sample, x, y, dissolve)
  }
}

/** Produces fire layers with continuous low-frequency edge erosion. */
function burningBand(
  parameters: ExplosionParameters,
  surface: Extract<ExplosionSurfaceParameters, { style: 'burningLayers' }>,
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

/** Produces dark rolling soot blobs with ember rims over the warm body. */
function sootBand(
  parameters: ExplosionParameters,
  surface: Extract<ExplosionSurfaceParameters, { style: 'rollingSoot' }>,
  sample: SurfaceSample,
  x: number,
  y: number,
  dissolve: number,
): number | undefined {
  if (sample.depth < 0.14) return paletteIndex(parameters.palette, 0.02)
  const field = interpolatedNoise(parameters.seed ^ 0xa5c31e27, x / surface.sootScale, y / surface.sootScale)
  const threshold = 0.08 + surface.sootAmount * 0.48 + dissolve * 0.18
  if (field < threshold) return parameters.palette.length - 1
  if (field < threshold + 0.08) return 0
  const flame = clamp01((field - threshold) / Math.max(0.01, 1 - threshold))
  return paletteIndex(parameters.palette, (1 - flame) * 0.58 + sample.axis * 0.3)
}

/** Applies fixed one-pixel erosion inside the shared shape. */
function retroPixelBand(
  parameters: ExplosionParameters,
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

/** Preserves the original dense radial body for byte-stable Retro Burst. */
function renderLegacyPixelNoiseBody(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  parameters: ExplosionParameters,
  time: number,
): void {
  if (parameters.surface.coverage === 0) return
  const centerX = width / 2
  const centerY = height / 2
  const visibleRadius = Math.max(0.5, parameters.body.radius * legacyRadialProgress(parameters.motion.mode, time))
  const lifecycle = lifecycleAt(parameters.motion.mode, time)
  const survival = lifecycle <= parameters.motion.dissolveStart
    ? parameters.surface.coverage
    : parameters.surface.coverage * (1 - (lifecycle - parameters.motion.dissolveStart) / (1 - parameters.motion.dissolveStart))
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const dx = x + 0.5 - centerX
      const dy = y + 0.5 - centerY
      const distance = Math.hypot(dx, dy)
      const angleBucket = Math.floor((Math.atan2(dy, dx) + Math.PI) * 18)
      const contourNoise = hashUnit(parameters.seed ^ 0x4f1bbcdc, angleBucket, 0) * 2 - 1
      const contourRadius = visibleRadius * (1 + contourNoise * parameters.body.shapeIrregularity * 0.34)
      if (distance > contourRadius || contourRadius <= 0) continue
      const normalizedDistance = distance / Math.max(1, contourRadius)
      const breakup = hashUnit(parameters.seed ^ 0x9e3779b9, x, y)
      const edgeLoss = clamp01((normalizedDistance - 0.45) / 0.55) * parameters.body.shapeIrregularity
      if (breakup > survival - edgeLoss * 0.55) continue
      writePixel(
        pixels, width, height, x, y,
        parameters.palette[Math.min(parameters.palette.length - 1, Math.floor(normalizedDistance * parameters.palette.length))],
      )
    }
  }
}

/** Resolves balanced tip directions for the active shape at one point in time. */
function shapeViews(
  parameters: ExplosionParameters,
  blobs: readonly BlobDescriptor[],
  time: number,
): LobeView[] {
  const lifecycle = lifecycleAt(parameters.motion.mode, time)
  if (parameters.body.shape === 'billowingFireball' && blobs.length > 0) {
    return blobs.map((blob, index) => {
      const growth = formationGrowth(parameters.motion.mode, parameters.motion, lifecycle, blob.delay)
      const churn = 1 + Math.sin(time * Math.PI * 2 * 1.5 + index * 0.9) * 0.08 * parameters.body.churnAmount
      const centerDistance = parameters.body.radius * 0.34 * growth
      const blobRadius = Math.max(0.5, parameters.body.radius * (0.3 + 0.1 * parameters.body.churnAmount) * growth * blob.radiusScale * churn)
      return {
        angle: blob.angle,
        tipDistance: centerDistance + blobRadius,
        growth,
        lengthScale: blob.radiusScale,
        tongueNoise: blob.tongueNoise,
        curveSign: blob.curveSign,
      }
    })
  }
  const count = explosionShapeCount(parameters.body.shape)
  const growth = formationGrowth(parameters.motion.mode, parameters.motion, lifecycle)
  const rotation = parameters.body.rotation / 180 * Math.PI
  return Array.from({ length: count }, (_, index) => ({
    angle: rotation + index / count * Math.PI * 2,
    tipDistance: parameters.body.radius * growth,
    growth,
    lengthScale: 1,
    tongueNoise: 0,
    curveSign: 1,
  }))
}
