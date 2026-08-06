import { assertInRange, assertValidColor, type RgbColor } from '../../shared/pixel/color'
import type { FrameSize } from '../../shared/pixel/frame'
import { MAX_FRAGMENT_SIZE, MAX_SHOCKWAVE_THICKNESS } from '../shared-effects/constants'
import { MAX_CANVAS_SIZE, MAX_FRAME_COUNT, MIN_CANVAS_SIZE, MIN_FRAME_COUNT, sharedFrameLimits } from '../shared-effects/limits'
import type {
  DissolveStyle,
  SharedCoreParameters,
  SharedFragmentParameters,
  SharedFrameLimits,
  SharedMotionParameters,
  SharedShockwaveParameters,
  SharedTongueParameters,
} from '../shared-effects/types'

export { MAX_CANVAS_SIZE, MAX_FRAGMENT_SIZE, MAX_FRAME_COUNT, MAX_SHOCKWAVE_THICKNESS, MIN_CANVAS_SIZE, MIN_FRAME_COUNT }

export type ExplosionShape = 'billowingFireball' | 'pressureBurst' | 'legacyRadial'
export type ExplosionSurfaceStyle = 'burningLayers' | 'rollingSoot' | 'retroPixel'

interface ExplosionSurfaceBase {
  readonly coverage: number
}

export type ExplosionSurfaceParameters =
  | (ExplosionSurfaceBase & { readonly style: 'burningLayers'; readonly bandWarp: number; readonly edgeBreakup: number })
  | (ExplosionSurfaceBase & { readonly style: 'rollingSoot'; readonly sootAmount: number; readonly sootScale: number })
  | (ExplosionSurfaceBase & {
      readonly style: 'retroPixel'
      readonly dissolveStyle: DissolveStyle
      readonly dissolveSize: number
      readonly dissolveJitter: number
      readonly dissolveDensity: number
      readonly dissolveSpeed: number
    })

export interface ExplosionBodyParameters {
  readonly shape: ExplosionShape
  readonly radius: number
  readonly rotation: number
  readonly shapeIrregularity: number
  readonly churnAmount: number
  readonly pressureWidth: number
  readonly pressureSharpness: number
}

export interface ExplosionParameters {
  readonly palette: readonly RgbColor[]
  readonly canvasWidth: number
  readonly canvasHeight: number
  readonly frameCount: number
  readonly seed: number
  readonly body: ExplosionBodyParameters
  readonly surface: ExplosionSurfaceParameters
  readonly motion: SharedMotionParameters
  readonly core: SharedCoreParameters
  readonly shockwave: SharedShockwaveParameters
  readonly tongues: SharedTongueParameters
  readonly fragments: SharedFragmentParameters
}

/** Size-dependent limits re-exported for the shared effect controls. */
export type ExplosionFrameLimits = SharedFrameLimits

/** Computes size-dependent limits for the combustion explosion family. */
export function explosionFrameLimits(size: FrameSize): ExplosionFrameLimits {
  return sharedFrameLimits(size)
}

/** Stable direction count used by balanced effects for each body shape. */
export function explosionShapeCount(shape: ExplosionShape): number {
  switch (shape) {
    case 'billowingFireball': return 8
    case 'pressureBurst': return 6
    case 'legacyRadial': return 8
  }
}

/** Creates the default parameter object for one family surface style. */
export function createExplosionSurface(
  style: ExplosionSurfaceStyle,
  coverage = 0.96,
): ExplosionSurfaceParameters {
  switch (style) {
    case 'burningLayers': return { style, coverage, bandWarp: 0.18, edgeBreakup: 0.32 }
    case 'rollingSoot': return { style, coverage, sootAmount: 0.3, sootScale: 11 }
    case 'retroPixel': return { style, coverage, dissolveStyle: 'pixelNoise', dissolveSize: 6, dissolveJitter: 0.5, dissolveDensity: 0, dissolveSpeed: 1 }
  }
}

/** Clamps and rounds a numeric value into inclusive integer bounds. */
export function clampInteger(value: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(value)) return minimum
  return Math.min(maximum, Math.max(minimum, Math.round(value)))
}

/** Resizes the effect and optionally scales all pixel-space parameters. */
export function resizeExplosionCanvas(
  parameters: ExplosionParameters,
  nextSize: FrameSize,
  scaleEffect = true,
): ExplosionParameters {
  const width = clampInteger(nextSize.width, MIN_CANVAS_SIZE, MAX_CANVAS_SIZE)
  const height = clampInteger(nextSize.height, MIN_CANVAS_SIZE, MAX_CANVAS_SIZE)
  const scale = scaleEffect ? Math.min(width, height) / Math.min(parameters.canvasWidth, parameters.canvasHeight) : 1
  const limits = explosionFrameLimits({ width, height })
  const surface = parameters.surface.style === 'rollingSoot'
    ? { ...parameters.surface, sootScale: clampInteger(parameters.surface.sootScale * scale, 6, 24) }
    : parameters.surface
  return {
    ...parameters,
    canvasWidth: width,
    canvasHeight: height,
    body: {
      ...parameters.body,
      radius: clampInteger(parameters.body.radius * scale, 2, limits.maxRadius),
      pressureWidth: clampInteger(parameters.body.pressureWidth * scale, 1, 24),
    },
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

/** Modern billowing-fireball defaults used by the rolling preset and shape cards. */
export const MODERN_EXPLOSION_PARAMETERS: ExplosionParameters = {
  palette: [
    { r: 255, g: 255, b: 255 },
    { r: 255, g: 176, b: 48 },
    { r: 255, g: 92, b: 38 },
    { r: 74, g: 34, b: 26 },
  ],
  canvasWidth: 128,
  canvasHeight: 128,
  frameCount: 10,
  seed: 20260805,
  body: {
    shape: 'billowingFireball',
    radius: 42,
    rotation: 0,
    shapeIrregularity: 0.22,
    churnAmount: 0.55,
    pressureWidth: 6,
    pressureSharpness: 0.8,
  },
  surface: createExplosionSurface('burningLayers'),
  motion: {
    mode: 'explosion',
    formationDuration: 0.34,
    holdDuration: 0.12,
    motionCurve: 'balanced',
    dissolveStart: 0.58,
  },
  core: { enabled: true, radius: 14, duration: 0.2 },
  shockwave: {
    mode: 'multiRing',
    colorMode: 'gradient',
    thickness: 2,
    startRadiusScale: 0.78,
    endRadiusScale: 1.32,
    startTime: 0.12,
    duration: 0.46,
    ringCount: 3,
    ringSpacing: 0.55,
    squash: 0.28,
    squashAngle: 0,
  },
  tongues: { enabled: true, count: 4, length: 22, width: 3, curvature: 0.34, variation: 0.24 },
  fragments: { enabled: true, count: 26, minSize: 1, maxSize: 2, travelDistance: 30, tangentialDrift: 7, lifetime: 0.7 },
}

/** Default explosion parameters now reproduce the classic Retro Burst look. */
export const DEFAULT_EXPLOSION_PARAMETERS: ExplosionParameters = {
  palette: [
    { r: 255, g: 250, b: 224 },
    { r: 255, g: 201, b: 72 },
    { r: 242, g: 95, b: 44 },
    { r: 105, g: 42, b: 52 },
  ],
  canvasWidth: 128,
  canvasHeight: 128,
  frameCount: 10,
  seed: 20260805,
  body: {
    shape: 'legacyRadial',
    radius: 42,
    rotation: 0,
    shapeIrregularity: 0.28,
    churnAmount: 0.5,
    pressureWidth: 6,
    pressureSharpness: 0.8,
  },
  surface: { style: 'retroPixel', coverage: 0.9, dissolveStyle: 'pixelNoise', dissolveSize: 6, dissolveJitter: 0.5, dissolveDensity: 0, dissolveSpeed: 1 },
  motion: {
    mode: 'explosion',
    formationDuration: 0.46,
    holdDuration: 0,
    motionCurve: 'balanced',
    dissolveStart: 0.58,
  },
  core: { enabled: true, radius: 16, duration: 0.42 },
  shockwave: {
    mode: 'ring',
    colorMode: 'flat',
    thickness: 3,
    startRadiusScale: 0,
    endRadiusScale: 1.18,
    startTime: 0,
    duration: 1,
    ringCount: 3,
    ringSpacing: 0.55,
    squash: 0,
    squashAngle: 0,
  },
  tongues: { enabled: false, count: 1, length: 0, width: 1, curvature: 0, variation: 0 },
  fragments: { enabled: true, count: 30, minSize: 1, maxSize: 3, travelDistance: 30, tangentialDrift: 9, lifetime: 0.68 },
}

/** Validates the complete V4 combustion explosion parameter contract. */
export function assertValidExplosionParameters(parameters: ExplosionParameters): void {
  if (parameters.palette.length < 2 || parameters.palette.length > 6) throw new RangeError('palette must contain between 2 and 6 colors.')
  parameters.palette.forEach((color, index) => assertValidColor(color, `palette[${index}]`))
  assertInRange(parameters.canvasWidth, MIN_CANVAS_SIZE, MAX_CANVAS_SIZE, 'canvasWidth')
  assertInRange(parameters.canvasHeight, MIN_CANVAS_SIZE, MAX_CANVAS_SIZE, 'canvasHeight')
  assertInRange(parameters.frameCount, MIN_FRAME_COUNT, MAX_FRAME_COUNT, 'frameCount')
  assertInRange(parameters.seed, 0, 0xffffffff, 'seed')
  const limits = explosionFrameLimits({ width: parameters.canvasWidth, height: parameters.canvasHeight })
  const shapeCount = explosionShapeCount(parameters.body.shape)
  assertInRange(parameters.body.radius, 2, limits.maxRadius, 'body.radius')
  assertInRange(parameters.body.rotation, 0, 359, 'body.rotation')
  assertInRange(parameters.body.shapeIrregularity, 0, 1, 'body.shapeIrregularity')
  assertInRange(parameters.body.churnAmount, 0, 1, 'body.churnAmount')
  assertInRange(parameters.body.pressureWidth, 1, 24, 'body.pressureWidth')
  assertInRange(parameters.body.pressureSharpness, 0, 1, 'body.pressureSharpness')
  if (parameters.body.shape !== 'billowingFireball' && parameters.body.shape !== 'pressureBurst' && parameters.body.shape !== 'legacyRadial') {
    throw new RangeError('body.shape is invalid.')
  }
  assertValidSurface(parameters.surface)
  assertValidMotion(parameters.motion)
  assertInRange(parameters.core.radius, 0, limits.maxRadius, 'core.radius')
  assertInRange(parameters.core.duration, 0.1, 0.9, 'core.duration')
  assertInRange(parameters.shockwave.thickness, 1, MAX_SHOCKWAVE_THICKNESS, 'shockwave.thickness')
  assertInRange(parameters.shockwave.startRadiusScale, 0, 2, 'shockwave.startRadiusScale')
  assertInRange(parameters.shockwave.endRadiusScale, 0.25, 2.5, 'shockwave.endRadiusScale')
  assertInRange(parameters.shockwave.startTime, 0, 0.8, 'shockwave.startTime')
  assertInRange(parameters.shockwave.duration, 0.1, 1, 'shockwave.duration')
  assertInRange(parameters.shockwave.ringCount, 1, 4, 'shockwave.ringCount')
  assertInRange(parameters.shockwave.ringSpacing, 0, 1, 'shockwave.ringSpacing')
  assertInRange(parameters.shockwave.squash, 0, 1, 'shockwave.squash')
  assertInRange(parameters.shockwave.squashAngle, 0, 359, 'shockwave.squashAngle')
  if (parameters.shockwave.mode !== 'none' && parameters.shockwave.mode !== 'ring' && parameters.shockwave.mode !== 'multiRing') {
    throw new RangeError('shockwave.mode is invalid.')
  }
  if (parameters.shockwave.colorMode !== 'flat' && parameters.shockwave.colorMode !== 'gradient') {
    throw new RangeError('shockwave.colorMode is invalid.')
  }
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
    parameters.body.radius, parameters.body.rotation, parameters.body.pressureWidth,
    parameters.core.radius, parameters.shockwave.thickness, parameters.shockwave.ringCount, parameters.shockwave.squashAngle,
    parameters.tongues.count, parameters.tongues.length, parameters.tongues.width,
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
function assertValidSurface(surface: ExplosionSurfaceParameters): void {
  assertInRange(surface.coverage, 0, 1, 'surface.coverage')
  switch (surface.style) {
    case 'burningLayers':
      assertInRange(surface.bandWarp, 0, 1, 'surface.bandWarp')
      assertInRange(surface.edgeBreakup, 0, 1, 'surface.edgeBreakup')
      return
    case 'rollingSoot':
      assertInRange(surface.sootAmount, 0, 0.65, 'surface.sootAmount')
      assertInRange(surface.sootScale, 6, 24, 'surface.sootScale')
      return
    case 'retroPixel':
      if (surface.dissolveStyle !== 'pixelNoise' && surface.dissolveStyle !== 'scanSweep' && surface.dissolveStyle !== 'blockFade' && surface.dissolveStyle !== 'circleFade' && surface.dissolveStyle !== 'edgeRoll') {
        throw new RangeError('surface.dissolveStyle is invalid.')
      }
      assertInRange(surface.dissolveSize, 3, 8, 'surface.dissolveSize')
      assertInRange(surface.dissolveJitter, 0, 1, 'surface.dissolveJitter')
      assertInRange(surface.dissolveDensity, 0, 1, 'surface.dissolveDensity')
      assertInRange(surface.dissolveSpeed, 0.5, 1.5, 'surface.dissolveSpeed')
      if (!Number.isInteger(surface.dissolveSize)) throw new RangeError('surface.dissolveSize must be an integer.')
      return
    default:
      throw new RangeError('surface.style is invalid.')
  }
}
