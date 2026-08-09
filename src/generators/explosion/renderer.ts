import type { PixelFrame } from '../../shared/pixel/frame'
import { clamp01, createXorshift32, hashUnit, lerp, smoothStep } from '../../shared/pixel/rng'
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
import {
  assertValidExplosionParameters,
  explosionShapeCount,
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

type BodyPrimitiveRole = 'core' | 'fire' | 'shell' | 'ember' | 'cinder' | 'smoke' | 'smokeWisp' | 'smokeParticle' | 'smokeParticleDark' | 'smokeBridge' | 'spark' | 'connector'

interface BodyPrimitiveBase {
  readonly owner: number
  readonly depth: number
  readonly role: BodyPrimitiveRole
  readonly alphaOnly?: boolean
}

interface EllipsePrimitive extends BodyPrimitiveBase {
  readonly kind: 'ellipse'
  readonly x: number
  readonly y: number
  readonly rx: number
  readonly ry: number
  readonly angle: number
}

interface TaperedCapsulePrimitive extends BodyPrimitiveBase {
  readonly kind: 'taperedCapsule'
  readonly startX: number
  readonly startY: number
  readonly endX: number
  readonly endY: number
  readonly startWidth: number
  readonly endWidth: number
}

interface BoxPrimitive extends BodyPrimitiveBase {
  readonly kind: 'box'
  readonly x: number
  readonly y: number
  readonly halfWidth: number
  readonly halfHeight: number
}

interface ShellSectorPrimitive extends BodyPrimitiveBase {
  readonly kind: 'shellSector'
  readonly innerRadius: number
  readonly outerRadius: number
  readonly angle: number
  readonly halfAngle: number
  readonly sharpness: number
}

type BodyPrimitive = EllipsePrimitive | TaperedCapsulePrimitive | BoxPrimitive | ShellSectorPrimitive

interface PrimitiveHit {
  readonly owner: number
  readonly depth: number
  readonly distance: number
  readonly axis: number
  readonly light: number
  readonly role: BodyPrimitiveRole
  readonly alphaOnly: boolean
}

/** Renders a complete deterministic combustion explosion or implosion animation. */
export function renderExplosionFrames(parameters: ExplosionParameters): PixelFrame[] {
  assertValidExplosionParameters(parameters)
  const fragments = generateFragments(parameters.palette, parameters.seed, parameters.fragments)
  const blobs = parameters.body.shape === 'legacyRadial' ? [] : generateBlobs(parameters)
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

/** Creates evenly distributed fireball descriptors whose variation vanishes at zero irregularity. */
function generateBlobs(parameters: ExplosionParameters): BlobDescriptor[] {
  const count = parameters.body.shape === 'smokeBurst'
    ? parameters.body.smokeCount
    : explosionShapeCount(parameters.body.shape, parameters.body.lobeCount, parameters.body.pressureCount)
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
  if (parameters.body.shape === 'rollingFireball') {
    const minimumGap = averageGap * lerp(1, 0.48, effectiveIrregularity)
    const remainingAngle = Math.max(0, Math.PI * 2 - minimumGap * count)
    const totalWeight = samples.reduce((sum, sample) => sum + sample.gapWeight, 0)
    const phase = samples[0].angleNoise * averageGap * 0.35 * effectiveIrregularity
    let cursor = rotation + phase
    angles = samples.map((sample) => {
      const angle = cursor
      cursor += minimumGap + remainingAngle * sample.gapWeight / totalWeight
      return angle
    })
  } else {
    const angleJitter = Math.min(0.42, irregularity * 0.36 * (1 + Math.max(0, count - 5) * 0.32))
    angles = samples.map((sample, index) => (
      rotation + index / count * Math.PI * 2 + sample.angleNoise * averageGap * angleJitter
    ))
  }
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
    case 'rollingFireball': return buildRollingFireballPrimitives(parameters, blobs, lifecycle)
    case 'shockBlast': return buildShockBlastPrimitives(parameters, blobs, time, lifecycle)
    case 'smokeBurst': return buildSmokeBurstPrimitives(parameters, blobs, time, lifecycle)
    case 'legacyRadial': return []
  }
}

/** Builds the compact overlapping fire masses used by the rolling fireball. */
function buildRollingFireballPrimitives(
  parameters: ExplosionParameters,
  blobs: readonly BlobDescriptor[],
  lifecycle: number,
): BodyPrimitive[] {
  const radius = parameters.body.radius
  // Game fireballs grow across most of the clip instead of finishing during the shared fast formation phase.
  // The final visible frame remains mid-growth; the transparent endpoint never exposes a held full-size body.
  const growthEnd = 1
  const growth = clamp01(lifecycle / growthEnd)
  const coreScale = parameters.volume.profile === 'moltenCore' ? 0.46 : 0.34
  const coreExpansion = 1 + growth * 0.16 * parameters.body.churnAmount
  const primitives: BodyPrimitive[] = [{
    kind: 'ellipse', owner: 0, depth: parameters.volume.profile === 'moltenCore' ? 4 : 0, role: 'core',
    x: 0, y: 0,
    rx: radius * coreScale * growth * coreExpansion,
    ry: radius * coreScale * growth * coreExpansion,
    angle: 0,
  }]
  blobs.slice(0, parameters.body.lobeCount).forEach((blob, index) => {
    const lobeDelay = blob.delay * 0.45 + index * 0.006
    const lobeGrowth = clamp01((lifecycle - lobeDelay) / Math.max(0.01, growthEnd - lobeDelay))
    // Slightly different rates preserve local motion while the overall expansion remains steady.
    const lobeRate = 0.28 + blob.tongueNoise * 0.04
    const continuingExpansion = 1 + lobeGrowth * lobeRate * parameters.body.churnAmount
    const centerDistance = radius * 0.34 * lobeGrowth
      * (1 + lobeGrowth * 0.18 * parameters.body.churnAmount) * blob.radialScale
    const highCount = Math.max(0, parameters.body.lobeCount - 5)
    const horizontalRadius = parameters.body.lobeCount <= 5
      ? 0.28 + (index % 2) * 0.05
      : 0.305 + blob.tongueNoise * 0.06 * parameters.body.shapeIrregularity * (1 + highCount * 0.2)
    primitives.push({
      kind: 'ellipse', owner: index + 1, depth: blob.depth, role: 'fire',
      x: Math.cos(blob.angle) * centerDistance,
      y: Math.sin(blob.angle) * centerDistance,
      rx: radius * horizontalRadius * blob.radiusScale * lobeGrowth
        * continuingExpansion * (1 + lobeGrowth * 0.1 * parameters.body.churnAmount),
      ry: radius * 0.3 * blob.radiusScale * lobeGrowth * continuingExpansion,
      angle: blob.angle,
    })
  })
  // Afterburn particles use their own launch schedule and directions instead of mirroring the five lobes.
  const cinderCount = Math.max(7, Math.round(parameters.body.lobeCount * 1.5))
  for (let index = 0; index < cinderCount; index += 1) {
    const launch = 0.54 + hashUnit(parameters.seed, index, 101) * 0.2
    const progress = clamp01((lifecycle - launch) / Math.max(0.01, 0.96 - launch))
    if (progress <= 0) continue
    const angle = parameters.body.rotation / 180 * Math.PI + hashUnit(parameters.seed, index, 102) * Math.PI * 2
    const distance = radius * (0.58 + progress * (0.38 + hashUnit(parameters.seed, index, 103) * 0.34))
    const tangent = (hashUnit(parameters.seed, index, 104) * 2 - 1) * radius * 0.1 * Math.sin(progress * Math.PI)
    const cinderRadius = Math.max(1, radius * (0.026 + hashUnit(parameters.seed, index, 105) * 0.025) * (1 - progress * 0.35))
    primitives.push({
      kind: 'ellipse', owner: 30 + index, depth: 4, role: 'cinder',
      x: Math.cos(angle) * distance - Math.sin(angle) * tangent,
      y: Math.sin(angle) * distance + Math.cos(angle) * tangent,
      rx: cinderRadius * (1.1 + progress * 0.4), ry: cinderRadius, angle,
    })
  }
  return primitives
}

/** Builds separated short radial shell plates pushed outward by one central flash. */
function buildShockBlastPrimitives(
  parameters: ExplosionParameters,
  blobs: readonly BlobDescriptor[],
  time: number,
  lifecycle: number,
): BodyPrimitive[] {
  const radius = parameters.body.radius
  const drift = parameters.motion.mode === 'explosion' ? time : 1 - time
  const growth = formationGrowth(parameters.motion.mode, parameters.motion, lifecycle)
  const rotation = parameters.body.rotation / 180 * Math.PI
  const coreRetreat = 1 - smoothStep(clamp01((drift - 0.5) / 0.34)) * 0.7
  const primitives: BodyPrimitive[] = [{
    kind: 'ellipse', owner: 0, depth: parameters.volume.profile === 'moltenCore' ? 4 : 0, role: 'core',
    x: 0, y: 0, rx: radius * 0.3 * growth * coreRetreat, ry: radius * 0.3 * growth * coreRetreat, angle: 0,
  }]
  const plateCount = parameters.body.pressureCount
  for (let index = 0; index < plateCount; index += 1) {
    const blob = blobs[index]
    const delay = index * 0.018 + (blob?.delay ?? 0) * 0.3
    const plateTime = clamp01((drift - delay) / Math.max(0.01, 0.84 - delay))
    if (plateTime <= 0 || plateTime >= 0.98) continue
    const jitter = (blob?.tongueNoise ?? 0) * parameters.body.shapeIrregularity * 0.14
    const angle = rotation + index / plateCount * Math.PI * 2 + jitter
    const radialCenter = radius * (0.25 + plateTime * 0.58) * growth
    const thickness = Math.max(1, parameters.body.pressureWidth * growth * (1 - plateTime * 0.18))
    const halfAngle = (Math.PI / plateCount) * (0.52 + (blob?.radiusScale ?? 1) * 0.08)
    primitives.push({
      kind: 'shellSector', owner: index + 1, depth: 2 + (blob?.depth ?? 1) * 0.2, role: 'shell',
      innerRadius: Math.max(0, radialCenter - thickness * 0.5),
      outerRadius: radialCenter + thickness * 0.5,
      angle, halfAngle, sharpness: parameters.body.pressureSharpness,
    })
  }
  return primitives
}

interface SmokeCoreDescriptor {
  readonly index: number
  readonly parentIndex: number | undefined
  readonly x: number
  readonly y: number
  readonly rx: number
  readonly ry: number
  readonly angle: number
  readonly direction: number
  readonly motion: number
}

type PointRotation = (x: number, y: number) => { readonly x: number; readonly y: number }

/** Selects the independent smoke simulation used by the shared smoke silhouette. */
function buildSmokeBurstPrimitives(
  parameters: ExplosionParameters,
  blobs: readonly BlobDescriptor[],
  time: number,
  lifecycle: number,
): BodyPrimitive[] {
  return parameters.body.smokeMotion === 'particulate'
    ? buildParticulateSmokePrimitives(parameters, blobs, time, lifecycle)
    : buildBillowingSmokePrimitives(parameters, blobs, time, lifecycle)
}

/** Builds moving vortex cores with secondary buds and a few detached wisps. */
function buildBillowingSmokePrimitives(
  parameters: ExplosionParameters,
  blobs: readonly BlobDescriptor[],
  time: number,
  lifecycle: number,
): BodyPrimitive[] {
  const radius = parameters.body.radius
  const growth = formationGrowth(parameters.motion.mode, parameters.motion, lifecycle)
  const drift = parameters.motion.mode === 'explosion' ? time : 1 - time
  const rotation = parameters.body.rotation / 180 * Math.PI
  const rotate = (x: number, y: number) => ({
    x: x * Math.cos(rotation) - y * Math.sin(rotation),
    y: x * Math.sin(rotation) + y * Math.cos(rotation),
  })
  const cores = createSmokeCoreDescriptors(parameters, blobs, drift, growth, rotate)
  const emberCenter = rotate(0, 0)
  const tail = smoothStep(clamp01((drift - 0.64) / 0.3))
  const emberScale = (1 - 0.4 * drift) * (1 - tail * 0.92)
  const primitives: BodyPrimitive[] = []
  if (emberScale > 0.12) {
    primitives.push({
      // The ember sits above alpha-only connectors but behind every visible smoke crown.
      kind: 'ellipse', owner: 0, depth: 2.5, role: 'ember',
      x: emberCenter.x, y: emberCenter.y,
      rx: radius * 0.22 * growth * emberScale, ry: radius * 0.1 * growth * emberScale, angle: rotation,
    })
  }
  addFormationBridges(primitives, cores, emberCenter, radius, growth, drift)
  cores.forEach((core) => {
    const tailStart = 0.62 + hashUnit(parameters.seed, core.index, 312) * 0.07
    const coreTail = smoothStep(clamp01((drift - tailStart) / Math.max(0.01, 0.93 - tailStart)))
    const coreScale = 1 - coreTail * (0.7 + hashUnit(parameters.seed, core.index, 313) * 0.12)
    primitives.push({
      kind: 'ellipse', owner: 0, depth: 2, role: 'smokeBridge', alphaOnly: true,
      x: core.x, y: core.y, rx: core.rx * 0.72 * coreScale, ry: core.ry * 0.68 * coreScale, angle: core.angle,
    })
    const irregularity = parameters.body.shapeIrregularity
    const crownCount = 2 + (hashUnit(parameters.seed, core.index, 224) < 0.45 + irregularity * 0.4 ? 1 : 0)
    for (let crownIndex = 0; crownIndex < crownCount; crownIndex += 1) {
      const sequence = crownIndex / Math.max(1, crownCount - 1)
      const randomDelay = (hashUnit(parameters.seed, core.index, 225 + crownIndex) * 2 - 1) * 0.07 * irregularity
      const crownDelay = 0.04 + sequence * 0.16 + randomDelay
      const crownTime = clamp01((core.motion - crownDelay) / Math.max(0.01, 0.92 - crownDelay))
      if (crownTime <= 0) continue
      const side = ((crownIndex + core.index) % 2 === 0 ? 1 : -1) * core.direction
      const phase = hashUnit(parameters.seed, core.index, 230 + crownIndex) * Math.PI * 2
      const curl = Math.sin(crownTime * Math.PI * (1.1 + sequence * 0.38) + phase) - Math.sin(phase)
      const tangentOffset = radius * (sequence - 0.42) * (0.12 + 0.05 * irregularity)
        + side * radius * curl * (0.018 + 0.028 * irregularity)
      const riseOffset = radius * (0.015 + sequence * 0.06) * crownTime
      const normalX = Math.cos(core.angle + Math.PI / 2)
      const normalY = Math.sin(core.angle + Math.PI / 2)
      const forwardX = Math.cos(core.angle)
      const forwardY = Math.sin(core.angle)
      const pulse = 1 + Math.sin(crownTime * Math.PI * (1.45 + sequence * 0.35) + phase) * (0.045 + 0.09 * irregularity)
      const sizeNoise = 1 + (hashUnit(parameters.seed, core.index, 235 + crownIndex) * 2 - 1) * 0.18 * irregularity
      const crownScale = (0.55 + crownTime * (0.36 + sequence * 0.12)) * pulse * sizeNoise
      primitives.push({
        kind: 'ellipse', owner: 10 + core.index * 4 + crownIndex, depth: 3 + sequence, role: 'smoke',
        x: core.x + normalX * tangentOffset - forwardX * riseOffset,
        y: core.y + normalY * tangentOffset - forwardY * riseOffset - radius * sequence * 0.025,
        rx: core.rx * crownScale * (0.84 + sequence * 0.12) * coreScale,
        ry: core.ry * crownScale * (0.7 + (1 - sequence) * 0.18) * coreScale * (1 - coreTail * 0.12),
        angle: core.angle + side * (0.18 + sequence * 0.32) + curl * (0.12 + irregularity * 0.16),
      })
    }
    const budCount = 1 + (hashUnit(parameters.seed, core.index, 231) > 0.58 ? 1 : 0)
    for (let budIndex = 0; budIndex < budCount; budIndex += 1) {
      const spawn = 0.24 + budIndex * 0.18 + hashUnit(parameters.seed, core.index, 232 + budIndex) * 0.1
      const budTime = clamp01((core.motion - spawn) / Math.max(0.01, 1 - spawn))
      if (budTime <= 0) continue
      const side = budIndex === 0 ? core.direction : -core.direction
      const normalX = Math.cos(core.angle + side * Math.PI / 2)
      const normalY = Math.sin(core.angle + side * Math.PI / 2)
      const inheritedX = Math.cos(core.angle) * radius * 0.1 * budTime
      const inheritedY = Math.sin(core.angle) * radius * 0.1 * budTime
      const offset = radius * (0.08 + 0.18 * budTime)
      const budRadius = radius * (0.07 + hashUnit(parameters.seed, core.index, 236 + budIndex) * 0.045) * (0.45 + budTime * 0.9) * coreScale
      primitives.push({
        kind: 'ellipse', owner: 40 + core.index * 2 + budIndex, depth: 4, role: 'smoke',
        x: core.x + normalX * offset + inheritedX,
        y: core.y + normalY * offset + inheritedY - radius * 0.04 * budTime,
        rx: budRadius * (1.1 + 0.18 * budTime), ry: budRadius * (0.78 + 0.12 * (1 - budTime)),
        angle: core.angle + side * (0.42 + budTime * 0.35),
      })
    }
    if ((core.index + parameters.seed) % 2 === 0) {
      const spawn = 0.57 + hashUnit(parameters.seed, core.index, 241) * 0.12
      const wispTime = clamp01((core.motion - spawn) / Math.max(0.01, 1 - spawn))
      if (wispTime <= 0) return
      const size = radius * (0.055 + hashUnit(parameters.seed, core.index, 242) * 0.035) * (1 - wispTime * 0.28) * (1 - coreTail * 0.38)
     primitives.push({
        kind: 'ellipse', owner: 70 + core.index, depth: 5, role: 'smokeWisp',
        x: core.x + core.direction * radius * (0.14 + 0.24 * wispTime),
        y: core.y - radius * (0.08 + 0.18 * wispTime),
        rx: size * 1.25, ry: size * 0.8, angle: core.angle + core.direction * 0.65,
      })
    }
  })
  addBillowingTailDebris(primitives, parameters, cores, tail)
  return primitives
}

/** Releases a few staggered dark fragments from the moving outer smoke cores. */
function addBillowingTailDebris(
  primitives: BodyPrimitive[],
  parameters: ExplosionParameters,
  cores: readonly SmokeCoreDescriptor[],
  tail: number,
): void {
  if (tail <= 0) return
  const radius = parameters.body.radius
  const debrisCount = Math.max(1, Math.ceil(cores.length / 3))
  const outerCores = [...cores]
    .sort((left, right) => Math.hypot(right.x, right.y) - Math.hypot(left.x, left.y))
    .slice(0, debrisCount)
  outerCores.forEach((core, debrisIndex) => {
    const spawn = 0.08 + hashUnit(parameters.seed, core.index, 314) * 0.28
    const age = clamp01((tail - spawn) / Math.max(0.01, 1 - spawn))
    if (age <= 0 || age >= 0.98) return
    const radialLength = Math.max(1, Math.hypot(core.x, core.y))
    const radialX = core.x / radialLength
    const radialY = core.y / radialLength
    const tangentSign = hashUnit(parameters.seed, core.index, 315) < 0.5 ? -1 : 1
    const tangentX = -radialY * tangentSign
    const tangentY = radialX * tangentSign
    const travel = radius * (0.12 + hashUnit(parameters.seed, core.index, 316) * 0.16) * age
    const curl = Math.sin(age * Math.PI) * radius * (0.025 + hashUnit(parameters.seed, core.index, 317) * 0.04)
    const x = core.x + radialX * travel + tangentX * curl
    const y = core.y + radialY * travel + tangentY * curl - radius * 0.055 * age
    const size = radius * (0.045 + hashUnit(parameters.seed, core.index, 318) * 0.025) * (1 - age * 0.62)
    const owner = 300 + core.index
    if (debrisIndex % 2 === 0) {
      const angle = Math.atan2(radialY, radialX) + tangentSign * 0.28
      primitives.push({
        kind: 'taperedCapsule', owner, depth: 6, role: 'smokeParticleDark',
        startX: x - Math.cos(angle) * size * 1.5,
        startY: y - Math.sin(angle) * size * 1.5,
        endX: x, endY: y,
        startWidth: Math.max(1, size * 0.72), endWidth: Math.max(1, size * 0.4),
      })
    } else {
      primitives.push({
        kind: 'box', owner, depth: 6, role: 'smokeParticleDark',
        x, y, halfWidth: Math.max(1, size * 0.7), halfHeight: Math.max(1, size * 0.5),
      })
    }
  })
}

/** Builds an early fused cloud that retreats while independent pixel chunks escape. */
function buildParticulateSmokePrimitives(
  parameters: ExplosionParameters,
  blobs: readonly BlobDescriptor[],
  time: number,
  lifecycle: number,
): BodyPrimitive[] {
  const radius = parameters.body.radius
  const growth = formationGrowth(parameters.motion.mode, parameters.motion, lifecycle)
  const drift = parameters.motion.mode === 'explosion' ? time : 1 - time
  const rotation = parameters.body.rotation / 180 * Math.PI
  const rotate: PointRotation = (x, y) => ({
    x: x * Math.cos(rotation) - y * Math.sin(rotation),
    y: x * Math.sin(rotation) + y * Math.cos(rotation),
  })
  const cores = createSmokeCoreDescriptors(parameters, blobs, drift, growth, rotate)
  const breakup = clamp01((drift - 0.3) / 0.52)
  const bodyScale = 1 - smoothStep(breakup) * 0.9
  const emberCenter = rotate(0, 0)
  const primitives: BodyPrimitive[] = [{
    // Keep the particulate mother-cloud ember behind every visible smoke layer as well.
    kind: 'ellipse', owner: 0, depth: 2.5, role: 'ember',
    x: emberCenter.x, y: emberCenter.y,
    rx: radius * 0.22 * growth * (1 - drift * 0.72), ry: radius * 0.1 * growth * (1 - drift * 0.72), angle: rotation,
  }]
  if (drift < 0.76) addFormationBridges(primitives, cores, emberCenter, radius, growth, drift)
  cores.forEach((core) => {
    if (bodyScale > 0.18) primitives.push({
      kind: 'ellipse', owner: core.index + 2, depth: 3, role: 'smoke',
      x: core.x, y: core.y, rx: core.rx * bodyScale, ry: core.ry * bodyScale, angle: core.angle,
    })
    for (let particleIndex = 0; particleIndex < 3; particleIndex += 1) {
      const spawn = 0.22 + particleIndex * 0.1 + hashUnit(parameters.seed, core.index, 251 + particleIndex) * 0.09
      const lifetime = 0.48 + hashUnit(parameters.seed, core.index, 253 + particleIndex) * 0.24
      const particleTime = (core.motion - spawn) / lifetime
      if (particleTime <= 0 || particleTime >= 1) continue
      const tangent = (hashUnit(parameters.seed, core.index, 255 + particleIndex) * 2 - 1) * radius * 0.18
      const travel = radius * (0.12 + hashUnit(parameters.seed, core.index, 259 + particleIndex) * 0.28) * particleTime
      const angle = core.angle + (particleIndex - 1) * 0.32 + (hashUnit(parameters.seed, core.index, 263 + particleIndex) * 2 - 1) * 0.22
      const arc = Math.sin(particleTime * Math.PI) * tangent
      const x = core.x + Math.cos(angle) * travel + Math.cos(angle + Math.PI / 2) * arc
      const y = core.y + Math.sin(angle) * travel + Math.sin(angle + Math.PI / 2) * arc - radius * 0.12 * particleTime
      const baseSize = 2 + Math.floor(hashUnit(parameters.seed, core.index, 267 + particleIndex) * 4)
      const size = baseSize * (1 - smoothStep(clamp01((particleTime - 0.56) / 0.44)) * 0.62)
      const particleRole: BodyPrimitiveRole = particleTime > 0.58 ? 'smokeParticleDark' : 'smokeParticle'
      if (particleIndex === 0) {
        primitives.push({
          kind: 'taperedCapsule', owner: 100 + core.index * 3 + particleIndex, depth: 5, role: particleRole,
          startX: x - Math.cos(angle) * size * 1.4, startY: y - Math.sin(angle) * size * 1.4,
          endX: x, endY: y, startWidth: Math.max(1, size * 0.7), endWidth: Math.max(1, size * 0.42),
        })
      } else {
        primitives.push({
          kind: 'box', owner: 100 + core.index * 3 + particleIndex, depth: 5, role: particleRole,
          x, y, halfWidth: Math.max(1, size * (particleIndex === 1 ? 0.65 : 0.5)), halfHeight: Math.max(1, size * 0.5),
        })
      }
      const splitStart = 0.46 + hashUnit(parameters.seed, core.index, 271 + particleIndex) * 0.14
      if (particleTime <= splitStart) continue
      const childCount = 2 + (hashUnit(parameters.seed, core.index, 275 + particleIndex) > 0.64 ? 1 : 0)
      const splitTime = clamp01((particleTime - splitStart) / Math.max(0.01, 1 - splitStart))
      for (let childIndex = 0; childIndex < childCount; childIndex += 1) {
        const childDelay = childIndex * 0.08 + hashUnit(parameters.seed, core.index * 7 + particleIndex, 279 + childIndex) * 0.08
        const childTime = clamp01((splitTime - childDelay) / Math.max(0.01, 1 - childDelay))
        if (childTime <= 0 || childTime >= 0.98) continue
        const separation = (childIndex - (childCount - 1) / 2) * (0.22 + parameters.body.shapeIrregularity * 0.18)
        const childAngle = angle + separation + (hashUnit(parameters.seed, core.index * 11 + particleIndex, 283 + childIndex) * 2 - 1) * 0.12
        const childTravel = radius * (0.04 + 0.12 * childTime) * (0.72 + hashUnit(parameters.seed, particleIndex, 287 + childIndex) * 0.4)
        const childX = x + Math.cos(childAngle) * childTravel
        const childY = y + Math.sin(childAngle) * childTravel - radius * 0.045 * childTime
        const childSize = Math.max(1, baseSize * (0.34 + hashUnit(parameters.seed, core.index, 291 + childIndex) * 0.18) * (1 - childTime * 0.62))
        const childOwner = 200 + core.index * 12 + particleIndex * 3 + childIndex
        const childRole: BodyPrimitiveRole = childTime > 0.42 ? 'smokeParticleDark' : 'smokeParticle'
        if (childIndex === 0) {
          primitives.push({
            kind: 'taperedCapsule', owner: childOwner, depth: 6, role: childRole,
            startX: childX - Math.cos(childAngle) * childSize,
            startY: childY - Math.sin(childAngle) * childSize,
            endX: childX,
            endY: childY,
            startWidth: childSize * 0.55,
            endWidth: Math.max(1, childSize * 0.34),
          })
        } else {
          primitives.push({
            kind: 'box', owner: childOwner, depth: 6, role: childRole,
            x: childX, y: childY, halfWidth: childSize * 0.52, halfHeight: childSize * 0.42,
          })
        }
      }
    }
  })
  return primitives
}

interface SmokeLayoutPoint {
  readonly x: number
  readonly y: number
  readonly parentIndex: number | undefined
}

/** Generates a deterministic compact two-dimensional smoke cluster. */
function createSmokeClusterLayout(seed: number, count: number, irregularity: number): SmokeLayoutPoint[] {
  const compositionInfluence = Math.sqrt(irregularity)
  const anchor: SmokeLayoutPoint = {
    x: (-0.055 + hashUnit(seed, 0, 301) * 0.11) * compositionInfluence,
    y: -0.14 + (hashUnit(seed, 0, 302) * 2 - 1) * 0.035 * compositionInfluence,
    parentIndex: undefined,
  }
  const points = [anchor]
  const goldenAngle = Math.PI * (3 - Math.sqrt(5))
  for (let index = 1; index < count; index += 1) {
    const regularRadius = 0.105 + Math.sqrt(index) * 0.085
    const regularAngle = index * goldenAngle - Math.PI * 0.62
    const regular = {
      x: Math.cos(regularAngle) * regularRadius,
      y: -0.14 + Math.sin(regularAngle) * regularRadius * 0.66,
    }
    let selected = regular
    let selectedDistance = -1
    for (let candidateIndex = 0; candidateIndex < 18; candidateIndex += 1) {
      const angle = hashUnit(seed, index * 23 + candidateIndex, 303) * Math.PI * 2
      const radial = Math.sqrt(hashUnit(seed, index * 23 + candidateIndex, 304))
      const candidate = {
        x: Math.cos(angle) * radial * 0.42,
        y: -0.14 + Math.sin(angle) * radial * 0.25,
      }
      const nearest = Math.min(...points.map((point) => Math.hypot(candidate.x - point.x, candidate.y - point.y)))
      if (nearest > 0.31 || nearest < 0.1 || nearest <= selectedDistance) continue
      selected = candidate
      selectedDistance = nearest
    }
    const x = lerp(regular.x, selected.x, compositionInfluence)
    const y = lerp(regular.y, selected.y, compositionInfluence)
    let parentIndex = 0
    let parentDistance = Number.POSITIVE_INFINITY
    points.forEach((point, placedIndex) => {
      const distance = Math.hypot(x - point.x, y - point.y)
      if (distance >= parentDistance) return
      parentDistance = distance
      parentIndex = placedIndex
    })
    points.push({ x, y, parentIndex })
  }
  return points
}

/** Generates clustered smoke cores with independently sampled motion and appearance. */
function createSmokeCoreDescriptors(
  parameters: ExplosionParameters,
  blobs: readonly BlobDescriptor[],
  drift: number,
  growth: number,
  rotate: PointRotation,
): SmokeCoreDescriptor[] {
  const radius = parameters.body.radius
  const rise = parameters.body.smokeRise * radius * drift * 0.62
  const irregularity = parameters.body.shapeIrregularity
  const layout = createSmokeClusterLayout(parameters.seed, parameters.body.smokeCount, irregularity)
  return layout.map((point, index) => {
    const blob = blobs[index]
    const direction = hashUnit(parameters.seed, index, 211) < 0.5 ? -1 : 1
    const localDelay = hashUnit(parameters.seed, index, 214) * (0.04 + irregularity * 0.06) + (blob?.delay ?? 0) * 0.24
    const localDrift = clamp01((drift - localDelay) / Math.max(0.01, 1 - localDelay))
    const riseScale = 0.5 + hashUnit(parameters.seed, index, 215) * 0.34
    const phase = hashUnit(parameters.seed, index, 216) * Math.PI * 2
    const curl = Math.sin(localDrift * Math.PI * 1.35 + phase) - Math.sin(phase)
    const radialLength = Math.max(0.08, Math.hypot(point.x, point.y + 0.14))
    const radialX = point.x / radialLength
    const radialY = (point.y + 0.14) / radialLength
    const outwardRate = 0.08 + hashUnit(parameters.seed, index, 217) * 0.07
    const tangentRate = (hashUnit(parameters.seed, index, 218) * 2 - 1) * (0.025 + irregularity * 0.035)
    const outwardX = radius * (radialX * outwardRate - radialY * tangentRate * curl) * localDrift
    const outwardY = radius * (radialY * outwardRate + radialX * tangentRate * curl) * localDrift
    const independentLift = radius * (0.035 + hashUnit(parameters.seed, index, 219) * 0.05) * localDrift
    const expansion = 0.62 + localDrift * (0.62 + hashUnit(parameters.seed, index, 220) * 0.16)
    const aspect = Math.sin(localDrift * Math.PI * 1.7 + phase) * 0.13
    const rawX = point.x * radius * parameters.body.smokeSpread * growth + outwardX
    const rawY = point.y * radius * growth + outwardY - rise * riseScale - independentLift
    const center = rotate(rawX, rawY)
    const baseRx = 0.24 + hashUnit(parameters.seed, index, 222) * 0.075
    const baseRy = 0.205 + hashUnit(parameters.seed, index, 223) * 0.055
    const rx = baseRx * radius * parameters.body.smokeSpread * growth * expansion * (1 + aspect)
    const ry = baseRy * radius * growth * expansion * (1 - aspect)
    return {
      index, parentIndex: point.parentIndex, x: center.x, y: center.y, rx, ry,
      angle: parameters.body.rotation / 180 * Math.PI + (blob?.curveSign ?? direction) * curl * (0.12 + irregularity * 0.12),
      direction,
      motion: localDrift,
    }
  })
}

/** Connects each smoke core to its nearest placed neighbor without a central spine. */
function addFormationBridges(
  primitives: BodyPrimitive[],
  cores: readonly SmokeCoreDescriptor[],
  emberCenter: { readonly x: number; readonly y: number },
  radius: number,
  growth: number,
  drift: number,
): void {
  const networkStrength = 1 - smoothStep(clamp01((drift - 0.72) / 0.2))
  const rootStrength = 1 - smoothStep(clamp01((drift - 0.5) / 0.18))
  if (networkStrength <= 0.04 && rootStrength <= 0.04) return
  cores.forEach((core) => {
    const parent = core.parentIndex === undefined ? undefined : cores[core.parentIndex]
    const anchor = parent ?? emberCenter
    const strength = parent ? networkStrength : rootStrength
    if (strength <= 0.04) return
    const width = Math.max(1, Math.min(core.rx, core.ry, parent?.rx ?? radius * 0.24 * growth) * 0.58 * strength)
    primitives.push({
      kind: 'taperedCapsule', owner: 0, depth: 2, role: 'smokeBridge', alphaOnly: true,
      startX: anchor.x, startY: anchor.y, endX: core.x, endY: core.y,
      startWidth: width, endWidth: Math.max(1, width * 1.12),
    })
  })
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
      alphaOnly: primitive.alphaOnly === true,
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
      alphaOnly: primitive.alphaOnly === true,
    }
  }
  if (primitive.kind === 'box') {
    const localX = Math.abs(x - primitive.x) / Math.max(1, primitive.halfWidth)
    const localY = Math.abs(y - primitive.y) / Math.max(1, primitive.halfHeight)
    const distance = Math.max(localX, localY)
    if (distance > 1) return undefined
    return {
      owner: primitive.owner, depth: primitive.depth, role: primitive.role,
      distance, axis: localX,
      light: clamp01(0.7 - localX * 0.16 - localY * 0.2),
      alphaOnly: primitive.alphaOnly === true,
    }
  }
  const segmentX = primitive.endX - primitive.startX
  const segmentY = primitive.endY - primitive.startY
  const segmentLengthSquared = segmentX * segmentX + segmentY * segmentY
  const t = segmentLengthSquared <= 0
    ? 0
    : clamp01(((x - primitive.startX) * segmentX + (y - primitive.startY) * segmentY) / segmentLengthSquared)
  const centerX = primitive.startX + segmentX * t
  const centerY = primitive.startY + segmentY * t
  const width = Math.max(1, lerp(primitive.startWidth, primitive.endWidth, t))
  const distance = Math.hypot(x - centerX, y - centerY) / width
  if (distance > 1) return undefined
  const segmentLength = Math.max(1, Math.sqrt(segmentLengthSquared))
  const signedSide = ((x - centerX) * -segmentY + (y - centerY) * segmentX) / segmentLength / width
  return {
    owner: primitive.owner, depth: primitive.depth, role: primitive.role,
    distance, axis: t,
    light: clamp01(0.72 - t * 0.08 - signedSide * 0.2),
    alphaOnly: primitive.alphaOnly === true,
  }
}

/** Returns the foremost accepted primitive hit, allowing dissolved foreground pixels to reveal rear layers. */
function frontPrimitiveHit(
  primitives: readonly BodyPrimitive[],
  x: number,
  y: number,
  accepts: (hit: PrimitiveHit) => boolean = () => true,
): PrimitiveHit | undefined {
  let front: PrimitiveHit | undefined
  for (const primitive of primitives) {
    const hit = sampleBodyPrimitive(primitive, x, y)
    if (!hit || !accepts(hit)) continue
    if (!front || hit.depth > front.depth) front = hit
  }
  return front
}

/** Tests whether one visible fire-lobe hit has retreated during the late edge breakup. */
function rollingFireballHitEroded(
  parameters: ExplosionParameters,
  hit: PrimitiveHit,
  x: number,
  y: number,
  lifecycle: number,
): boolean {
  if (parameters.body.shape !== 'rollingFireball' || hit.role !== 'fire') return false
  const ending = smoothStep(clamp01((lifecycle - 0.62) / 0.34))
  const angle = Math.atan2(y, x)
  const sector = Math.floor((angle + Math.PI) / (Math.PI / 6))
  const erosion = 0.08 + hashUnit(parameters.seed, hit.owner, sector) * 0.2
  return hit.distance > 1 - ending * erosion
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
  const frontRoles = new Array<BodyPrimitiveRole | undefined>(size)
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    const localX = x + 0.5 - cx
    const localY = y + 0.5 - cy
    const front = frontPrimitiveHit(
      primitives,
      localX,
      localY,
      (hit) => !rollingFireballHitEroded(parameters, hit, localX, localY, lifecycle),
    )
    if (!front) continue
    let band = front.distance * 0.72 + (1 - front.light) * 0.18
    if (parameters.body.shape === 'shockBlast' && front.role === 'core') {
      // Directional lighting avoids turning the central flash into concentric target rings.
      band = 0.16 + (1 - front.light) * 0.55
    }
    if (parameters.body.shape === 'rollingFireball' && front.role === 'fire') {
      // Each lobe cools on a separate deterministic schedule while the central core stays hot longer.
      const coolingStart = 0.46 + hashUnit(parameters.seed, front.owner, 91) * 0.16
      const cooling = smoothStep(clamp01((lifecycle - coolingStart) / Math.max(0.01, 0.94 - coolingStart)))
      const burnout = smoothStep(clamp01((lifecycle - 0.68) / 0.27))
      band += cooling * (0.28 + hashUnit(parameters.seed, front.owner, 92) * 0.06) + burnout * 0.62
    }
    if (front.role === 'connector') band = 0.56
    if (front.role === 'smokeBridge') band = 0.64
    if (front.role === 'spark') band = 0.24 + front.distance * 0.32
    if (front.role === 'shell') {
      const shellCooling = smoothStep(clamp01((lifecycle - 0.52) / 0.38))
      band = 0.16 + front.axis * 0.42 + (1 - front.light) * 0.16 + shellCooling * 0.2
    }
    if (front.role === 'cinder') {
      const cinderCooling = smoothStep(clamp01((lifecycle - 0.7) / 0.24))
      band = 0.38 + front.distance * 0.2 + cinderCooling * 0.28
    }
    if (profile === 'moltenCore' && front.role === 'core') band = 0.02 + front.distance * 0.16
    if (parameters.body.shape === 'rollingFireball' && front.role === 'core') {
      const coreCooling = smoothStep(clamp01((lifecycle - 0.68) / 0.28))
      band += coreCooling * 0.82
    }
    if (profile === 'smokeFire' && isSmokeBodyRole(front.role)) {
      const stableLayer = (hashUnit(parameters.seed, front.owner, 311) - 0.5) * 0.1
      const cooling = smoothStep(clamp01((lifecycle - 0.46) / 0.48))
      band = 0.34 + front.distance * 0.24 + (1 - front.light) * 0.15 + stableLayer + cooling * 0.08
      if (front.role === 'smokeWisp') band += 0.07
      if (front.role === 'smokeParticleDark') band += 0.24
    }
    else if (profile === 'smokeFire') {
      const emberCooling = smoothStep(clamp01((lifecycle - 0.42) / 0.52))
      band += 0.04 + emberCooling * 0.26
    }
    const paletteBand = clamp01(Math.min(0.94, band))
    const rawColorIndex = paletteIndex(parameters.palette, paletteBand)
    const smokeMayUseDeep = profile === 'smokeFire' && front.role === 'smokeParticleDark'
    const rollingMayUseDeep = parameters.body.shape === 'rollingFireball'
      && lifecycle >= 0.68
      && (front.role === 'fire' || front.role === 'core' || front.role === 'cinder')
    const colorIndex = smokeMayUseDeep || rollingMayUseDeep
      ? rawColorIndex
      : Math.min(parameters.palette.length - 2, rawColorIndex)
    const offset = y * width + x
    alpha[offset] = 1
    frontIds[offset] = front.owner
    frontDepths[offset] = front.depth
    frontRoles[offset] = front.role
    baseColors[offset] = colorIndex
  }
  if (parameters.body.shape === 'smokeBurst' && (parameters.body.smokeMotion === 'billowing' || lifecycle < 0.58)) {
    fillEnclosedSmokePixels(alpha, frontIds, frontDepths, frontRoles, baseColors, width, height, paletteIndex(parameters.palette, 0.64))
  }
  const deepest = parameters.palette.length - 1
  const internalDark = Math.max(0, parameters.palette.length - 2)
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    const offset = y * width + x
    if (alpha[offset] === 0) continue
    let edge = false
    let shadowEdge = false
    let frontBoundary = false
    for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) {
        edge = true
        if (nx > x || ny > y) shadowEdge = true
        continue
      }
      const neighbor = ny * width + nx
      if (alpha[neighbor] === 0) {
        edge = true
        if (nx > x || ny > y) shadowEdge = true
      }
      else if (
        frontIds[offset] > 0
        && frontIds[neighbor] > 0
        && frontIds[neighbor] !== frontIds[offset]
        && frontDepths[offset] > frontDepths[neighbor]
        && !(isSmokeBodyRole(frontRoles[offset]) && isSmokeBodyRole(frontRoles[neighbor]))
      ) frontBoundary = true
    }
    let colorIndex = baseColors[offset]
    if (edge) {
      const smokeEdge = parameters.body.shape === 'smokeBurst' && profile === 'smokeFire'
      colorIndex = smokeEdge && frontRoles[offset] !== 'smokeParticleDark' && !shadowEdge
        ? internalDark
        : deepest
    }
    else if (frontBoundary) colorIndex = internalDark
    writePixel(pixels, width, height, x, y, parameters.palette[colorIndex])
  }
}

/** Fills early smoke-only cavities without reconnecting late detached wisps. */
function fillEnclosedSmokePixels(
  alpha: Uint8Array,
  frontIds: Int16Array,
  frontDepths: Float32Array,
  frontRoles: Array<BodyPrimitiveRole | undefined>,
  baseColors: Uint8Array,
  width: number,
  height: number,
  fillColor: number,
): void {
  const outside = new Uint8Array(width * height)
  const queue: number[] = []
  for (let x = 0; x < width; x += 1) queue.push(x, (height - 1) * width + x)
  for (let y = 1; y < height - 1; y += 1) queue.push(y * width, y * width + width - 1)
  while (queue.length > 0) {
    const offset = queue.pop()!
    if (outside[offset] || alpha[offset] !== 0) continue
    outside[offset] = 1
    const x = offset % width
    const y = Math.floor(offset / width)
    if (x > 0) queue.push(offset - 1)
    if (x + 1 < width) queue.push(offset + 1)
    if (y > 0) queue.push(offset - width)
    if (y + 1 < height) queue.push(offset + width)
  }
  for (let offset = 0; offset < alpha.length; offset += 1) {
    if (alpha[offset] !== 0 || outside[offset]) continue
    alpha[offset] = 1
    frontIds[offset] = 0
    frontDepths[offset] = 2
    frontRoles[offset] = 'smokeBridge'
    baseColors[offset] = fillColor
  }
}

/** Groups smoke cores, buds, wisps, and particles under one shading boundary language. */
function isSmokeBodyRole(role: BodyPrimitiveRole | undefined): boolean {
  return role === 'smoke' || role === 'smokeWisp' || role === 'smokeParticle' || role === 'smokeParticleDark'
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
  if (parameters.body.shape !== 'legacyRadial' && blobs.length > 0) {
    return blobs.map((blob, index) => {
      if (parameters.body.shape === 'rollingFireball') {
        const lobeDelay = blob.delay * 0.45 + index * 0.006
        const growth = clamp01((lifecycle - lobeDelay) / Math.max(0.01, 1 - lobeDelay))
        const lobeRate = 0.28 + blob.tongueNoise * 0.04
        const continuingExpansion = 1 + growth * lobeRate * parameters.body.churnAmount
        const centerDistance = parameters.body.radius * 0.34 * growth
          * (1 + growth * 0.18 * parameters.body.churnAmount) * blob.radialScale
        const highCount = Math.max(0, parameters.body.lobeCount - 5)
        const horizontalRadius = parameters.body.lobeCount <= 5
          ? 0.28 + (index % 2) * 0.05
          : 0.305 + blob.tongueNoise * 0.06 * parameters.body.shapeIrregularity * (1 + highCount * 0.2)
        const blobRadius = parameters.body.radius * Math.max(horizontalRadius, 0.3) * blob.radiusScale
          * growth * continuingExpansion
        return {
          angle: blob.angle,
          tipDistance: centerDistance + blobRadius,
          growth,
          lengthScale: blob.radiusScale,
          tongueNoise: blob.tongueNoise,
          curveSign: blob.curveSign,
        }
      }
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
