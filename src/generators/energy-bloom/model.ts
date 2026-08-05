import { assertInRange, assertValidColor, type RgbColor } from '../../shared/pixel/color'
import type { FrameSize } from '../../shared/pixel/frame'
import { MAX_FRAGMENT_SIZE, MAX_SHOCKWAVE_THICKNESS } from '../shared-effects/constants'
import { MAX_CANVAS_SIZE, MAX_FRAME_COUNT, MIN_CANVAS_SIZE, MIN_FRAME_COUNT, sharedFrameLimits } from '../shared-effects/limits'
import type {
  SharedCoreParameters,
  SharedFragmentParameters,
  SharedFrameLimits,
  SharedMotionParameters,
  SharedShockwaveParameters,
  SharedTongueParameters,
} from '../shared-effects/types'

export { MAX_CANVAS_SIZE, MAX_FRAGMENT_SIZE, MAX_FRAME_COUNT, MAX_SHOCKWAVE_THICKNESS, MIN_CANVAS_SIZE, MIN_FRAME_COUNT }

export type BloomShape = 'softPetals' | 'sharpStarburst' | 'layeredCorolla'
export type BloomSurfaceStyle = 'celBands' | 'moltenCavities' | 'crystalShards' | 'gridNoise' | 'pixelNoise'

interface BloomSurfaceBase {
  readonly coverage: number
}

export type BloomSurfaceParameters =
  | (BloomSurfaceBase & { readonly style: 'celBands'; readonly bandWarp: number; readonly edgeBreakup: number })
  | (BloomSurfaceBase & { readonly style: 'moltenCavities'; readonly cavityAmount: number; readonly cavityScale: number })
  | (BloomSurfaceBase & { readonly style: 'crystalShards'; readonly chunkSize: number; readonly crackWidth: number })
  | (BloomSurfaceBase & { readonly style: 'gridNoise' })
  | (BloomSurfaceBase & { readonly style: 'pixelNoise' })

export interface BloomBodyParameters {
  readonly shape: BloomShape
  readonly radius: number
  readonly rotation: number
  readonly shapeIrregularity: number
  readonly petalCount: number
  readonly petalStretch: number
  readonly rayCount: number
  readonly rayTaper: number
  readonly corollaLayers: number
  readonly layerDelay: number
}

export interface BloomParameters {
  readonly palette: readonly RgbColor[]
  readonly canvasWidth: number
  readonly canvasHeight: number
  readonly frameCount: number
  readonly seed: number
  readonly body: BloomBodyParameters
  readonly surface: BloomSurfaceParameters
  readonly motion: SharedMotionParameters
  readonly core: SharedCoreParameters
  readonly shockwave: SharedShockwaveParameters
  readonly tongues: SharedTongueParameters
  readonly fragments: SharedFragmentParameters
}

/** Size-dependent limits re-exported for the shared effect controls. */
export type BloomFrameLimits = SharedFrameLimits

/** Computes size-dependent limits for the energy bloom family. */
export function bloomFrameLimits(size: FrameSize): BloomFrameLimits {
  return sharedFrameLimits(size)
}

/** Stable direction count used by balanced effects for each body shape. */
export function bloomShapeCount(body: BloomBodyParameters): number {
  return body.shape === 'sharpStarburst' ? body.rayCount : body.petalCount
}

/** Creates the default parameter object for one family surface style. */
export function createBloomSurface(
  style: BloomSurfaceStyle,
  coverage = 0.96,
): BloomSurfaceParameters {
  switch (style) {
    case 'celBands': return { style, coverage, bandWarp: 0.15, edgeBreakup: 0.3 }
    case 'moltenCavities': return { style, coverage, cavityAmount: 0.28, cavityScale: 11 }
    case 'crystalShards': return { style, coverage, chunkSize: 8, crackWidth: 1 }
    case 'gridNoise': return { style, coverage }
    case 'pixelNoise': return { style, coverage }
  }
}

/** Clamps and rounds a numeric value into inclusive integer bounds. */
export function clampInteger(value: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(value)) return minimum
  return Math.min(maximum, Math.max(minimum, Math.round(value)))
}

/** Resizes the effect and optionally scales all pixel-space parameters. */
export function resizeBloomCanvas(
  parameters: BloomParameters,
  nextSize: FrameSize,
  scaleEffect = true,
): BloomParameters {
  const width = clampInteger(nextSize.width, MIN_CANVAS_SIZE, MAX_CANVAS_SIZE)
  const height = clampInteger(nextSize.height, MIN_CANVAS_SIZE, MAX_CANVAS_SIZE)
  const scale = scaleEffect ? Math.min(width, height) / Math.min(parameters.canvasWidth, parameters.canvasHeight) : 1
  const limits = bloomFrameLimits({ width, height })
  const surface = parameters.surface.style === 'moltenCavities'
    ? { ...parameters.surface, cavityScale: clampInteger(parameters.surface.cavityScale * scale, 6, 24) }
    : parameters.surface.style === 'crystalShards'
      ? {
          ...parameters.surface,
          chunkSize: clampInteger(parameters.surface.chunkSize * scale, 4, 16),
          crackWidth: clampInteger(parameters.surface.crackWidth * scale, 1, 2),
        }
      : parameters.surface
  return {
    ...parameters,
    canvasWidth: width,
    canvasHeight: height,
    body: { ...parameters.body, radius: clampInteger(parameters.body.radius * scale, 2, limits.maxRadius) },
    surface,
    core: { ...parameters.core, radius: clampInteger(parameters.core.radius * scale, 0, limits.maxRadius) },
    tongues: {
      ...parameters.tongues,
      length: clampInteger(parameters.tongues.length * scale, 0, limits.maxTongueLength),
      width: clampInteger(parameters.tongues.width * scale, 1, limits.maxTongueWidth),
    },
    fragments: {
      ...parameters.fragments,
      travelDistance: clampInteger(parameters.fragments.travelDistance * scale, 0, limits.maxFragmentDistance),
      tangentialDrift: clampInteger(parameters.fragments.tangentialDrift * scale, 0, limits.maxTangentialDrift),
    },
  }
}

export const DEFAULT_BLOOM_PARAMETERS: BloomParameters = {
  palette: [
    { r: 255, g: 255, b: 255 },
    { r: 140, g: 235, b: 255 },
    { r: 150, g: 120, b: 255 },
    { r: 235, g: 80, b: 190 },
  ],
  canvasWidth: 128,
  canvasHeight: 128,
  frameCount: 10,
  seed: 20260806,
  body: {
    shape: 'softPetals',
    radius: 42,
    rotation: 0,
    shapeIrregularity: 0.18,
    petalCount: 7,
    petalStretch: 0.58,
    rayCount: 10,
    rayTaper: 0.6,
    corollaLayers: 2,
    layerDelay: 0.18,
  },
  surface: createBloomSurface('celBands'),
  motion: {
    mode: 'explosion',
    formationDuration: 0.42,
    holdDuration: 0.1,
    motionCurve: 'balanced',
    dissolveStart: 0.62,
  },
  core: { enabled: true, radius: 14, duration: 0.24 },
  shockwave: {
    mode: 'lobeArcs',
    thickness: 2,
    startRadiusScale: 0.72,
    endRadiusScale: 1.38,
    startTime: 0.12,
    duration: 0.5,
    arcCount: 3,
    arcSpan: 30,
  },
  tongues: { enabled: false, count: 3, length: 20, width: 3, curvature: 0.28, variation: 0.2 },
  fragments: { enabled: true, count: 22, minSize: 1, maxSize: 2, travelDistance: 26, tangentialDrift: 6, lifetime: 0.7 },
}

/** Validates the complete V4 energy bloom parameter contract. */
export function assertValidBloomParameters(parameters: BloomParameters): void {
  if (parameters.palette.length < 2 || parameters.palette.length > 6) throw new RangeError('palette must contain between 2 and 6 colors.')
  parameters.palette.forEach((color, index) => assertValidColor(color, `palette[${index}]`))
  assertInRange(parameters.canvasWidth, MIN_CANVAS_SIZE, MAX_CANVAS_SIZE, 'canvasWidth')
  assertInRange(parameters.canvasHeight, MIN_CANVAS_SIZE, MAX_CANVAS_SIZE, 'canvasHeight')
  assertInRange(parameters.frameCount, MIN_FRAME_COUNT, MAX_FRAME_COUNT, 'frameCount')
  assertInRange(parameters.seed, 0, 0xffffffff, 'seed')
  const limits = bloomFrameLimits({ width: parameters.canvasWidth, height: parameters.canvasHeight })
  if (parameters.body.shape !== 'softPetals' && parameters.body.shape !== 'sharpStarburst' && parameters.body.shape !== 'layeredCorolla') {
    throw new RangeError('body.shape is invalid.')
  }
  assertInRange(parameters.body.radius, 2, limits.maxRadius, 'body.radius')
  assertInRange(parameters.body.rotation, 0, 359, 'body.rotation')
  assertInRange(parameters.body.shapeIrregularity, 0, 1, 'body.shapeIrregularity')
  assertInRange(parameters.body.petalCount, 5, 9, 'body.petalCount')
  assertInRange(parameters.body.petalStretch, 0, 1, 'body.petalStretch')
  assertInRange(parameters.body.rayCount, 6, 16, 'body.rayCount')
  assertInRange(parameters.body.rayTaper, 0, 1, 'body.rayTaper')
  assertInRange(parameters.body.corollaLayers, 2, 3, 'body.corollaLayers')
  assertInRange(parameters.body.layerDelay, 0, 0.4, 'body.layerDelay')
  const shapeCount = bloomShapeCount(parameters.body)
  assertValidSurface(parameters.surface)
  assertValidMotion(parameters.motion)
  assertInRange(parameters.core.radius, 0, limits.maxRadius, 'core.radius')
  assertInRange(parameters.core.duration, 0.1, 0.9, 'core.duration')
  assertInRange(parameters.shockwave.thickness, 1, MAX_SHOCKWAVE_THICKNESS, 'shockwave.thickness')
  assertInRange(parameters.shockwave.startRadiusScale, 0, 2, 'shockwave.startRadiusScale')
  assertInRange(parameters.shockwave.endRadiusScale, 0.25, 2.5, 'shockwave.endRadiusScale')
  assertInRange(parameters.shockwave.startTime, 0, 0.8, 'shockwave.startTime')
  assertInRange(parameters.shockwave.duration, 0.1, 1, 'shockwave.duration')
  assertInRange(parameters.shockwave.arcCount, 1, shapeCount, 'shockwave.arcCount')
  assertInRange(parameters.shockwave.arcSpan, 10, 120, 'shockwave.arcSpan')
  assertInRange(parameters.tongues.count, 1, shapeCount, 'tongues.count')
  assertInRange(parameters.tongues.length, 0, limits.maxTongueLength, 'tongues.length')
  assertInRange(parameters.tongues.width, 1, limits.maxTongueWidth, 'tongues.width')
  assertInRange(parameters.tongues.curvature, 0, 1, 'tongues.curvature')
  assertInRange(parameters.tongues.variation, 0, 1, 'tongues.variation')
  assertInRange(parameters.fragments.count, 1, 72, 'fragments.count')
  assertInRange(parameters.fragments.minSize, 1, MAX_FRAGMENT_SIZE, 'fragments.minSize')
  assertInRange(parameters.fragments.maxSize, 1, MAX_FRAGMENT_SIZE, 'fragments.maxSize')
  assertInRange(parameters.fragments.travelDistance, 0, limits.maxFragmentDistance, 'fragments.travelDistance')
  assertInRange(parameters.fragments.tangentialDrift, 0, limits.maxTangentialDrift, 'fragments.tangentialDrift')
  assertInRange(parameters.fragments.lifetime, 0.1, 1, 'fragments.lifetime')
  if (parameters.fragments.minSize > parameters.fragments.maxSize) throw new RangeError('fragments.minSize must not exceed fragments.maxSize.')
  if (parameters.shockwave.startRadiusScale > parameters.shockwave.endRadiusScale) throw new RangeError('shockwave start radius must not exceed end radius.')
  const integers = [
    parameters.canvasWidth, parameters.canvasHeight, parameters.frameCount, parameters.seed,
    parameters.body.radius, parameters.body.rotation, parameters.body.petalCount, parameters.body.rayCount,
    parameters.body.corollaLayers, parameters.core.radius, parameters.shockwave.thickness,
    parameters.shockwave.arcCount, parameters.tongues.count, parameters.tongues.length, parameters.tongues.width,
    parameters.fragments.count, parameters.fragments.minSize, parameters.fragments.maxSize,
    parameters.fragments.travelDistance, parameters.fragments.tangentialDrift,
  ]
  if (integers.some((value) => !Number.isInteger(value))) throw new RangeError('pixel-space, count, rotation, frameCount, and seed values must be integers.')
}

/** Validates the shared motion timing group. */
function assertValidMotion(motion: SharedMotionParameters): void {
  assertInRange(motion.formationDuration, 0.1, 0.8, 'motion.formationDuration')
  assertInRange(motion.holdDuration, 0, 0.5, 'motion.holdDuration')
  assertInRange(motion.dissolveStart, 0.1, 0.9, 'motion.dissolveStart')
  if (motion.mode !== 'explosion' && motion.mode !== 'implosion') throw new RangeError('motion.mode is invalid.')
  if (motion.motionCurve !== 'crisp' && motion.motionCurve !== 'balanced' && motion.motionCurve !== 'drifting') {
    throw new RangeError('motion.motionCurve is invalid.')
  }
  if (motion.formationDuration + motion.holdDuration > motion.dissolveStart) {
    throw new RangeError('motion.dissolveStart must be at least formationDuration + holdDuration.')
  }
}

/** Validates style-specific surface parameters. */
function assertValidSurface(surface: BloomSurfaceParameters): void {
  assertInRange(surface.coverage, 0, 1, 'surface.coverage')
  switch (surface.style) {
    case 'celBands':
      assertInRange(surface.bandWarp, 0, 1, 'surface.bandWarp')
      assertInRange(surface.edgeBreakup, 0, 1, 'surface.edgeBreakup')
      return
    case 'moltenCavities':
      assertInRange(surface.cavityAmount, 0, 0.65, 'surface.cavityAmount')
      assertInRange(surface.cavityScale, 6, 24, 'surface.cavityScale')
      return
    case 'crystalShards':
      assertInRange(surface.chunkSize, 4, 16, 'surface.chunkSize')
      assertInRange(surface.crackWidth, 1, 2, 'surface.crackWidth')
      return
    case 'gridNoise':
    case 'pixelNoise':
      return
    default:
      throw new RangeError('surface.style is invalid.')
  }
}
