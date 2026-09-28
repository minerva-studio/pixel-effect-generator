import type { PixelFrame } from '../../shared/pixel/frame'
import { clamp01, createXorshift32, easeOutCubic, hashUnit, lerp, smoothStep } from '../../shared/pixel/rng'
import { renderCore } from '../shared-effects/core'
import { dissolvePixelRejected, type DissolveOptions } from '../shared-effects/dissolve'
import { generateFragments, renderFragments } from '../shared-effects/fragments'
import { writePixel } from '../shared-effects/output'
import { paletteIndex } from '../shared-effects/palette'
import { renderShockwave } from '../shared-effects/shockwave'
import { dissolveAmount, formationGrowth, legacyRadialProgress, lifecycleAt } from '../shared-effects/timing'
import { renderTongues } from '../shared-effects/tongues'
import type { FragmentDescriptor } from '../shared-effects/fragments'
import type { DissolveStyle, LobeView, SurfaceSample } from '../shared-effects/types'
import { renderBillowBurstBody, renderPuffClusterBody, renderSmokeBurstBody } from './fieldBodies'
import { renderRollingFireballBody, rollingFireballViews } from './rollingFireball'
import {
  assertValidExplosionParameters,
  explosionShapeCount,
  usesFieldRenderer,
  type ExplosionParameters,
  type ExplosionSurfaceParameters,
} from './model'

interface BlobDescriptor {
  readonly angle: number
  readonly radiusScale: number
  readonly radialScale: number
  readonly depth: number
  readonly delay: number
  readonly tongueNoise: number
  readonly curveSign: number
}

type BodyPrimitiveRole = 'core' | 'shell'

interface BodyPrimitiveBase {
  readonly owner: number
  readonly depth: number
  readonly role: BodyPrimitiveRole
}

interface EllipsePrimitive extends BodyPrimitiveBase {
  readonly kind: 'ellipse'
  readonly x: number
  readonly y: number
  readonly rx: number
  readonly ry: number
  readonly angle: number
}

interface ShellSectorPrimitive extends BodyPrimitiveBase {
  readonly kind: 'shellSector'
  readonly innerRadius: number
  readonly outerRadius: number
  readonly angle: number
  readonly halfAngle: number
  readonly sharpness: number
}

type BodyPrimitive = EllipsePrimitive | ShellSectorPrimitive

interface PrimitiveHit {
  readonly owner: number
  readonly depth: number
  readonly distance: number
  readonly axis: number
  readonly light: number
  readonly role: BodyPrimitiveRole
}

/** Renders a complete deterministic combustion explosion or implosion animation. */
export function renderExplosionFrames(parameters: ExplosionParameters): PixelFrame[] {
  assertValidExplosionParameters(parameters)
  const fragments = generateFragments(parameters.palette, parameters.seed, parameters.fragments)
  const blobs = parameters.body.shape === 'legacyRadial' || usesFieldRenderer(parameters.body.shape) ? [] : generateBlobs(parameters)
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
  if (parameters.body.shape === 'billowBurst') renderBillowBurstBody(pixels, width, height, parameters, lifecycle)
  else if (parameters.body.shape === 'puffCluster') renderPuffClusterBody(pixels, width, height, parameters, lifecycle)
  else if (parameters.body.shape === 'rollingFireball') renderRollingFireballBody(pixels, width, height, parameters, lifecycle)
  else if (parameters.body.shape === 'smokeBurst') renderSmokeBurstBody(pixels, width, height, parameters, lifecycle)
  else if (legacyBody) renderLegacyPixelNoiseBody(pixels, width, height, parameters, time)
  else renderModernBody(pixels, width, height, parameters, blobs, time)
  const views = parameters.tongues.enabled && parameters.tongues.length > 0
    ? shapeViews(parameters, blobs, time)
    : []
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

/** Creates evenly distributed fireball descriptors whose variation vanishes at zero irregularity. */
function generateBlobs(parameters: ExplosionParameters): BlobDescriptor[] {
  const count = explosionShapeCount(parameters.body.shape, parameters.body.lobeCount, parameters.body.pressureCount)
  const random = createXorshift32(parameters.seed ^ 0x71e4a2d9)
  const unit = () => random() / 0x100000000
  const irregularity = parameters.body.shapeIrregularity
  const rotation = parameters.body.rotation / 180 * Math.PI
  const highCountBoost = 1 + Math.max(0, count - 5) * 0.55
  const effectiveIrregularity = clamp01(irregularity * highCountBoost)
  const samples = Array.from({ length: count }, () => ({
    gapWeight: 0.25 + unit() ** 1.6 * 1.5,
    angleNoise: unit() * 2 - 1,
    sizeNoise: unit() * 2 - 1,
    radialNoise: unit() * 2 - 1,
    delayNoise: unit(),
    tongueNoise: unit() * 2 - 1,
    curveSign: unit() < 0.5 ? -1 : 1,
    layerNoise: unit(),
  }))
  const averageGap = Math.PI * 2 / count
  let angles: number[]
  const angleJitter = Math.min(0.42, irregularity * 0.36 * (1 + Math.max(0, count - 5) * 0.32))
  angles = samples.map((sample, index) => (
    rotation + index / count * Math.PI * 2 + sample.angleNoise * averageGap * angleJitter
  ))
  const layerOrder = samples
    .map((sample, index) => ({ index, noise: sample.layerNoise }))
    .sort((left, right) => left.noise - right.noise)
  const layerRanks = new Map(layerOrder.map((entry, rank) => [entry.index, rank]))
  return samples.map((sample, index) => ({
    angle: angles[index],
    radiusScale: 1 + sample.sizeNoise * 0.22 * effectiveIrregularity,
    radialScale: 1 + sample.radialNoise * 0.24 * effectiveIrregularity,
    depth: irregularity === 0
      ? (index % 2 === 0 ? 1 : 3)
      : ((layerRanks.get(index) ?? 0) < Math.floor(count / 2) ? 1 : 3),
    delay: sample.delayNoise * 0.18 * effectiveIrregularity,
    tongueNoise: sample.tongueNoise,
    curveSign: sample.curveSign,
  }))
}

/** Resolves the active shape silhouette as depth, axis, and owning direction. */
function sampleShape(
  parameters: ExplosionParameters,
  primitives: readonly BodyPrimitive[],
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
  if (parameters.body.shape === 'legacyRadial') return sampleLegacyDisc(parameters, distance, lifecycle)
  const front = frontPrimitiveHit(primitives, dx, dy)
  if (!front) return undefined
  return {
    depth: 1 - front.distance,
    axis: front.axis,
    directionIndex: Math.max(0, front.owner - 1),
  }
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
  const lifecycle = lifecycleAt(parameters.motion.mode, time)
  const primitives = buildBodyPrimitives(parameters, blobs, time, lifecycle)
  if (parameters.volume.enabled) {
    renderVolumeBody(pixels, width, height, parameters, primitives, lifecycle)
    return
  }
  if (parameters.surface.coverage === 0) return
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sample = sampleShape(parameters, primitives, x, y, time)
      if (!sample) continue
      let colorIndex = surfaceColorIndex(parameters, sample, x, y, lifecycle)
      if (colorIndex === undefined) continue
      writePixel(pixels, width, height, x, y, parameters.palette[colorIndex])
    }
  }
}

/** Builds one active modern silhouette from its own explicit motion skeleton. */
function buildBodyPrimitives(
  parameters: ExplosionParameters,
  blobs: readonly BlobDescriptor[],
  time: number,
  lifecycle: number,
): BodyPrimitive[] {
  switch (parameters.body.shape) {
    case 'rollingFireball': return []
    case 'shockBlast': return buildShockBlastPrimitives(parameters, blobs, time, lifecycle)
    case 'smokeBurst': return []
    case 'billowBurst':
    case 'puffCluster':
    case 'legacyRadial': return []
  }
}

const SHOCK_LAUNCH_RADIUS = 0.25
const SHOCK_EXIT_RADIUS = 1.05
const SHOCK_DRAG = 2.5

/** Builds separated short radial shell plates pushed outward by one central flash. */
function buildShockBlastPrimitives(
  parameters: ExplosionParameters,
  blobs: readonly BlobDescriptor[],
  time: number,
  lifecycle: number,
): BodyPrimitive[] {
  const radius = parameters.body.radius
  const drift = parameters.motion.mode === 'explosion' ? time : 1 - time
  const dissolveStart = parameters.motion.dissolveStart
  const growth = Math.max(formationGrowth(parameters.motion.mode, parameters.motion, lifecycle), Math.sqrt(clamp01(drift / 0.12)) * 0.9)
  const rotation = parameters.body.rotation / 180 * Math.PI
  // The flash spends itself on the same drag law that throws the plates, then retires after dissolve start.
  const coreRetreat = (0.3 + 0.7 * Math.exp(-SHOCK_DRAG * drift / (dissolveStart + 0.34)))
    * (1 - smoothStep(clamp01((drift - dissolveStart) / 0.2)))
  const primitives: BodyPrimitive[] = []
  if (coreRetreat > 0) primitives.push({
    kind: 'ellipse', owner: 0, depth: parameters.volume.profile === 'moltenCore' ? 4 : 0, role: 'core',
    x: 0, y: 0, rx: radius * 0.3 * growth * coreRetreat, ry: radius * 0.3 * growth * coreRetreat, angle: 0,
  })
  const plateCount = parameters.body.pressureCount
  for (let index = 0; index < plateCount; index += 1) {
    const blob = blobs[index]
    const delay = index * 0.008 + (blob?.delay ?? 0) * 0.12
    if (drift <= delay) continue
    const jitter = (blob?.tongueNoise ?? 0) * parameters.body.shapeIrregularity * 0.14
    const angle = rotation + index / plateCount * Math.PI * 2 + jitter
    // Each plate stays whole and keeps pushing outward until it leaves; dissolve start sets its lifetime.
    const exit = Math.min(0.98, dissolveStart + 0.34 + hashUnit(parameters.seed, index, 107) * 0.06)
    const life = clamp01((drift - delay) / Math.max(0.05, exit - delay))
    if (life >= 1) continue
    // Both edges follow one drag law: the plate is thrown at full speed and every speed decays by the
    // same exponential factor, so the front and the trailing edge brake together as one shock. The
    // trailing edge carries the extra travel that compresses the plate into a 1px rim by its exit.
    const width = parameters.body.pressureWidth
    const settled = Math.exp(-SHOCK_DRAG)
    const remaining = (Math.exp(-SHOCK_DRAG * life) - settled) / (1 - settled)
    const travel = radius * (SHOCK_EXIT_RADIUS - SHOCK_LAUNCH_RADIUS) * (1 - remaining)
    const outerEdge = radius * SHOCK_LAUNCH_RADIUS + width * 0.5 + travel
    const thickness = 1 + (width - 1) * remaining
    const halfAngle = (Math.PI / plateCount) * (0.52 + (blob?.radiusScale ?? 1) * 0.08)
    primitives.push({
      kind: 'shellSector', owner: index + 1, depth: 2 + (blob?.depth ?? 1) * 0.2, role: 'shell',
      innerRadius: Math.max(0, outerEdge - thickness),
      outerRadius: outerEdge,
      angle, halfAngle, sharpness: parameters.body.pressureSharpness,
    })
  }
  return primitives
}

/** Samples one analytic body primitive in center-relative pixel coordinates. */
function sampleBodyPrimitive(primitive: BodyPrimitive, x: number, y: number): PrimitiveHit | undefined {
  if (primitive.kind === 'ellipse') {
    const rawX = x - primitive.x
    const rawY = y - primitive.y
    const cos = Math.cos(primitive.angle)
    const sin = Math.sin(primitive.angle)
    const localX = (rawX * cos + rawY * sin) / Math.max(1, primitive.rx)
    const localY = (-rawX * sin + rawY * cos) / Math.max(1, primitive.ry)
    const distance = Math.hypot(localX, localY)
    if (distance > 1) return undefined
    return {
      owner: primitive.owner, depth: primitive.depth, role: primitive.role,
      distance, axis: distance,
      light: clamp01(0.72 - localX * 0.2 - localY * 0.2),
    }
  }
  if (primitive.kind === 'shellSector') {
    const radius = Math.hypot(x, y)
    if (radius < primitive.innerRadius || radius > primitive.outerRadius) return undefined
    const radialProgress = (radius - primitive.innerRadius) / Math.max(1, primitive.outerRadius - primitive.innerRadius)
    const delta = Math.atan2(Math.sin(Math.atan2(y, x) - primitive.angle), Math.cos(Math.atan2(y, x) - primitive.angle))
    const angularLimit = primitive.halfAngle * (1 - radialProgress * primitive.sharpness * 0.28)
    const angularDistance = Math.abs(delta) / Math.max(0.01, angularLimit)
    if (angularDistance > 1) return undefined
    return {
      owner: primitive.owner, depth: primitive.depth, role: primitive.role,
      distance: Math.max(Math.abs(radialProgress * 2 - 1), angularDistance),
      axis: radialProgress,
      light: clamp01(0.76 - Math.sin(primitive.angle) * 0.12 - Math.cos(primitive.angle) * 0.12 - radialProgress * 0.08),
    }
  }
  return undefined
}

/** Returns the foremost accepted primitive hit, allowing dissolved foreground pixels to reveal rear layers. */
function frontPrimitiveHit(
  primitives: readonly BodyPrimitive[],
  x: number,
  y: number,
): PrimitiveHit | undefined {
  let front: PrimitiveHit | undefined
  for (const primitive of primitives) {
    const hit = sampleBodyPrimitive(primitive, x, y)
    if (!hit) continue
    if (!front || hit.depth > front.depth) front = hit
  }
  return front
}

/** Draws ordered rear/core/front volumes with deterministic occlusion and fixed top-left light. */
function renderVolumeBody(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  parameters: ExplosionParameters,
  primitives: readonly BodyPrimitive[],
  lifecycle: number,
): void {
  const cx = width / 2
  const cy = height / 2
  const profile = parameters.volume.profile
  const size = width * height
  const alpha = new Uint8Array(size)
  const frontIds = new Int16Array(size)
  const frontDepths = new Float32Array(size)
  const baseColors = new Uint8Array(size)
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    const localX = x + 0.5 - cx
    const localY = y + 0.5 - cy
    const front = frontPrimitiveHit(primitives, localX, localY)
    if (!front) continue
    let band = front.distance * 0.72 + (1 - front.light) * 0.18
    if (parameters.body.shape === 'shockBlast' && front.role === 'core') {
      // Directional lighting avoids turning the central flash into concentric target rings.
      band = 0.16 + (1 - front.light) * 0.55
    }
    if (front.role === 'shell') {
      const shellCooling = smoothStep(clamp01((lifecycle - parameters.motion.dissolveStart) / Math.max(0.05, 0.95 - parameters.motion.dissolveStart)))
      band = 0.16 + front.axis * 0.42 + (1 - front.light) * 0.16 + shellCooling * 0.72
    }
    if (profile === 'moltenCore' && front.role === 'core') band = 0.02 + front.distance * 0.16
    const paletteBand = clamp01(Math.min(0.94, band))
    const rawColorIndex = paletteIndex(parameters.palette, paletteBand)
    const shockMayUseDeep = parameters.body.shape === 'shockBlast'
      && lifecycle >= parameters.motion.dissolveStart
      && front.role === 'shell'
    const colorIndex = shockMayUseDeep
      ? rawColorIndex
      : Math.min(parameters.palette.length - 2, rawColorIndex)
    const offset = y * width + x
    alpha[offset] = 1
    frontIds[offset] = front.owner
    frontDepths[offset] = front.depth
    baseColors[offset] = colorIndex
  }
  const deepest = parameters.palette.length - 1
  const internalDark = Math.max(0, parameters.palette.length - 2)
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    const offset = y * width + x
    if (alpha[offset] === 0) continue
    let edge = false
    let frontBoundary = false
    for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) {
        edge = true
        continue
      }
      const neighbor = ny * width + nx
      if (alpha[neighbor] === 0) {
        edge = true
      }
      else if (
        frontIds[offset] > 0
        && frontIds[neighbor] > 0
        && frontIds[neighbor] !== frontIds[offset]
        && frontDepths[offset] > frontDepths[neighbor]
      ) frontBoundary = true
    }
    let colorIndex = baseColors[offset]
    if (edge) colorIndex = deepest
    else if (frontBoundary) colorIndex = internalDark
    writePixel(pixels, width, height, x, y, parameters.palette[colorIndex])
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
  const surface = parameters.surface
  if (surface.style !== 'retroPixel') return undefined
  const edge = 1 - sample.depth
  const effective = clamp01(dissolve * surface.dissolveSpeed)
  if (surface.dissolveStyle === 'pixelNoise') {
    const survival = surface.coverage * (1 - effective)
    if (hashUnit(parameters.seed ^ 0x9e3779b9, x, y) > survival - edge * 0.18) return undefined
  } else if (dissolvePixelRejected(
    surface.dissolveStyle,
    parameters.seed,
    x,
    y,
    parameters.canvasWidth,
    parameters.canvasHeight,
    dissolve,
    surface.coverage,
    edge,
    {
      size: surface.dissolveSize,
      jitter: surface.dissolveJitter,
      density: surface.dissolveDensity,
      speed: surface.dissolveSpeed,
    },
  )) {
    return undefined
  }
  const cooling = (surface.dissolveCooling ?? 0) * effective
  return paletteIndex(parameters.palette, sample.axis * 0.68 + (1 - sample.depth) * 0.32 + cooling)
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

/** Draws the dense radial body while optional cooling shifts surviving pixels darker. */
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
  const dissolve = dissolveAmount(parameters.motion, lifecycle)
  const surface = parameters.surface
  const dissolveStyle: DissolveStyle = surface.style === 'retroPixel' ? surface.dissolveStyle : 'pixelNoise'
  const options: DissolveOptions = surface.style === 'retroPixel'
    ? { size: surface.dissolveSize, jitter: surface.dissolveJitter, density: surface.dissolveDensity, speed: surface.dissolveSpeed }
    : { size: 6, jitter: 0.5, density: 0, speed: 1 }
  const effective = clamp01(dissolve * options.speed)
  const survival = surface.coverage * (1 - effective)
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
      if (dissolveStyle === 'pixelNoise') {
        if (breakup > survival - edgeLoss * 0.55) continue
      } else if (dissolvePixelRejected(
        dissolveStyle,
        parameters.seed,
        x,
        y,
        width,
        height,
        dissolve,
        surface.coverage,
        normalizedDistance,
        options,
      )) {
        continue
      }
      const cooling = surface.style === 'retroPixel' ? (surface.dissolveCooling ?? 0) * effective : 0
      writePixel(
        pixels, width, height, x, y,
        parameters.palette[Math.min(parameters.palette.length - 1, Math.floor((normalizedDistance + cooling) * parameters.palette.length))],
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
  if (parameters.body.shape === 'rollingFireball') return rollingFireballViews(parameters, lifecycle)
  if (parameters.body.shape !== 'legacyRadial' && blobs.length > 0) {
    return blobs.map((blob, index) => {
      const growth = formationGrowth(parameters.motion.mode, parameters.motion, lifecycle, blob.delay)
      const centerDistance = parameters.body.radius * 0.42 * growth
      const blobRadius = Math.max(0.5, parameters.body.radius * 0.28 * growth * blob.radiusScale)
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
  const count = explosionShapeCount(parameters.body.shape, parameters.body.lobeCount, parameters.body.pressureCount)
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
