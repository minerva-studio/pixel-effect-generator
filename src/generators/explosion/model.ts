import { assertInRange, assertValidColor, type RgbColor } from '../../shared/pixel/color'
import type { FrameSize } from '../../shared/pixel/frame'

export const DEFAULT_CANVAS_SIZE = 128
export const MIN_CANVAS_SIZE = 16
export const MAX_CANVAS_SIZE = 512
export const MIN_FRAME_COUNT = 5
export const MAX_FRAME_COUNT = 24
export const MAX_FRAGMENT_SIZE = 8

export type ExplosionMode = 'explosion' | 'implosion'
export type ExplosionBodyStyle = 'cleanClusters' | 'pixelNoise'
export type ExplosionShockwaveStyle = 'segmentedArc' | 'fullRing'
export type ExplosionTrailMode = 'energyRays' | 'flameStrands'

export interface ExplosionParameters {
  readonly palette: readonly RgbColor[]
  readonly canvasWidth: number
  readonly canvasHeight: number
  readonly mode: ExplosionMode
  readonly bodyStyle: ExplosionBodyStyle
  readonly shockwaveStyle: ExplosionShockwaveStyle
  readonly trailMode: ExplosionTrailMode
  readonly radius: number
  readonly bodyStrength: number
  readonly irregularity: number
  readonly coreRadius: number
  readonly shockwaveWidth: number
  readonly frameCount: number
  readonly expansionSpeed: number
  readonly coreDuration: number
  readonly shockwaveSpeed: number
  readonly dissolveStart: number
  readonly fragmentAmount: number
  readonly fragmentMinSize: number
  readonly fragmentMaxSize: number
  readonly fragmentRadialSpeed: number
  readonly fragmentTangentialJitter: number
  readonly fragmentLifetime: number
  readonly trailAmount: number
  readonly trailLength: number
  readonly trailWidth: number
  readonly trailLengthRandomness: number
  readonly seed: number
}

export interface ExplosionFrameLimits {
  readonly maxRadius: number
  readonly maxFragmentSpeed: number
  readonly maxTangentialJitter: number
  readonly maxTrailLength: number
  readonly maxTrailWidth: number
}

/** Computes size-dependent limits for a centered radial effect. */
export function explosionFrameLimits(size: FrameSize): ExplosionFrameLimits {
  const halfMinimum = Math.floor(Math.min(size.width, size.height) / 2)
  const scale = Math.min(size.width, size.height) / DEFAULT_CANVAS_SIZE
  return {
    maxRadius: Math.max(2, halfMinimum),
    maxFragmentSpeed: Math.max(1, Math.round(64 * scale)),
    maxTangentialJitter: Math.max(1, Math.round(32 * scale)),
    maxTrailLength: Math.max(2, Math.round(halfMinimum * 1.5)),
    maxTrailWidth: Math.max(1, Math.round(halfMinimum * 0.2)),
  }
}

/** Clamps and rounds a numeric value into inclusive integer bounds. */
export function clampInteger(value: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(value)) {
    return minimum
  }
  return Math.min(maximum, Math.max(minimum, Math.round(value)))
}

/** Updates the minimum fragment size without invalidating the size interval. */
export function updateFragmentMinSize(parameters: ExplosionParameters, value: number): ExplosionParameters {
  const minimum = clampInteger(value, 1, MAX_FRAGMENT_SIZE)
  return {
    ...parameters,
    fragmentMinSize: minimum,
    fragmentMaxSize: Math.max(minimum, parameters.fragmentMaxSize),
  }
}

/** Updates the maximum fragment size without invalidating the size interval. */
export function updateFragmentMaxSize(parameters: ExplosionParameters, value: number): ExplosionParameters {
  const maximum = clampInteger(value, 1, MAX_FRAGMENT_SIZE)
  return {
    ...parameters,
    fragmentMaxSize: maximum,
    fragmentMinSize: Math.min(maximum, parameters.fragmentMinSize),
  }
}

/** Resizes the centered effect and optionally scales its pixel-space parameters. */
export function resizeExplosionCanvas(
  parameters: ExplosionParameters,
  nextSize: FrameSize,
  scaleEffect = true,
): ExplosionParameters {
  const width = clampInteger(nextSize.width, MIN_CANVAS_SIZE, MAX_CANVAS_SIZE)
  const height = clampInteger(nextSize.height, MIN_CANVAS_SIZE, MAX_CANVAS_SIZE)
  const oldMinimum = Math.min(parameters.canvasWidth, parameters.canvasHeight)
  const scale = scaleEffect ? Math.min(width, height) / oldMinimum : 1
  const limits = explosionFrameLimits({ width, height })
  return {
    ...parameters,
    canvasWidth: width,
    canvasHeight: height,
    radius: clampInteger(parameters.radius * scale, 2, limits.maxRadius),
    coreRadius: clampInteger(parameters.coreRadius * scale, 0, limits.maxRadius),
    shockwaveWidth: clampInteger(parameters.shockwaveWidth * scale, 0, limits.maxRadius),
    fragmentRadialSpeed: clampInteger(parameters.fragmentRadialSpeed * scale, 0, limits.maxFragmentSpeed),
    fragmentTangentialJitter: clampInteger(parameters.fragmentTangentialJitter * scale, 0, limits.maxTangentialJitter),
    trailLength: clampInteger(parameters.trailLength * scale, 0, limits.maxTrailLength),
    trailWidth: clampInteger(parameters.trailWidth * scale, 1, limits.maxTrailWidth),
  }
}

export const DEFAULT_EXPLOSION_PARAMETERS: ExplosionParameters = {
  palette: [
    { r: 255, g: 255, b: 255 },
    { r: 255, g: 196, b: 58 },
    { r: 255, g: 102, b: 84 },
    { r: 86, g: 44, b: 122 },
  ],
  canvasWidth: DEFAULT_CANVAS_SIZE,
  canvasHeight: DEFAULT_CANVAS_SIZE,
  mode: 'explosion',
  bodyStyle: 'cleanClusters',
  shockwaveStyle: 'segmentedArc',
  trailMode: 'energyRays',
  radius: 42,
  bodyStrength: 0.9,
  irregularity: 0.26,
  coreRadius: 16,
  shockwaveWidth: 3,
  frameCount: 10,
  expansionSpeed: 0.72,
  coreDuration: 0.26,
  shockwaveSpeed: 0.82,
  dissolveStart: 0.5,
  fragmentAmount: 0.42,
  fragmentMinSize: 1,
  fragmentMaxSize: 3,
  fragmentRadialSpeed: 30,
  fragmentTangentialJitter: 9,
  fragmentLifetime: 0.74,
  trailAmount: 0.45,
  trailLength: 54,
  trailWidth: 3,
  trailLengthRandomness: 0.35,
  seed: 20260805,
}

/** Validates the complete experimental explosion parameter contract. */
export function assertValidExplosionParameters(parameters: ExplosionParameters): void {
  if (parameters.palette.length < 2 || parameters.palette.length > 6) {
    throw new RangeError('palette must contain between 2 and 6 colors.')
  }
  parameters.palette.forEach((color, index) => assertValidColor(color, `palette[${index}]`))
  assertInRange(parameters.canvasWidth, MIN_CANVAS_SIZE, MAX_CANVAS_SIZE, 'canvasWidth')
  assertInRange(parameters.canvasHeight, MIN_CANVAS_SIZE, MAX_CANVAS_SIZE, 'canvasHeight')
  const limits = explosionFrameLimits({ width: parameters.canvasWidth, height: parameters.canvasHeight })
  assertInRange(parameters.radius, 2, limits.maxRadius, 'radius')
  assertInRange(parameters.bodyStrength, 0, 1, 'bodyStrength')
  assertInRange(parameters.irregularity, 0, 1, 'irregularity')
  assertInRange(parameters.coreRadius, 0, limits.maxRadius, 'coreRadius')
  assertInRange(parameters.shockwaveWidth, 0, limits.maxRadius, 'shockwaveWidth')
  assertInRange(parameters.frameCount, MIN_FRAME_COUNT, MAX_FRAME_COUNT, 'frameCount')
  assertInRange(parameters.expansionSpeed, 0, 1, 'expansionSpeed')
  assertInRange(parameters.coreDuration, 0.1, 0.9, 'coreDuration')
  assertInRange(parameters.shockwaveSpeed, 0, 1, 'shockwaveSpeed')
  assertInRange(parameters.dissolveStart, 0.1, 0.9, 'dissolveStart')
  assertInRange(parameters.fragmentAmount, 0, 1, 'fragmentAmount')
  assertInRange(parameters.fragmentMinSize, 1, MAX_FRAGMENT_SIZE, 'fragmentMinSize')
  assertInRange(parameters.fragmentMaxSize, 1, MAX_FRAGMENT_SIZE, 'fragmentMaxSize')
  assertInRange(parameters.fragmentRadialSpeed, 0, limits.maxFragmentSpeed, 'fragmentRadialSpeed')
  assertInRange(parameters.fragmentTangentialJitter, 0, limits.maxTangentialJitter, 'fragmentTangentialJitter')
  assertInRange(parameters.fragmentLifetime, 0.1, 1, 'fragmentLifetime')
  assertInRange(parameters.trailAmount, 0, 1, 'trailAmount')
  assertInRange(parameters.trailLength, 0, limits.maxTrailLength, 'trailLength')
  assertInRange(parameters.trailWidth, 1, limits.maxTrailWidth, 'trailWidth')
  assertInRange(parameters.trailLengthRandomness, 0, 1, 'trailLengthRandomness')
  assertInRange(parameters.seed, 0, 0xffffffff, 'seed')
  if (parameters.fragmentMinSize > parameters.fragmentMaxSize) {
    throw new RangeError('fragmentMinSize must not exceed fragmentMaxSize.')
  }
  if (parameters.mode !== 'explosion' && parameters.mode !== 'implosion') {
    throw new RangeError('mode is invalid.')
  }
  if (parameters.bodyStyle !== 'cleanClusters' && parameters.bodyStyle !== 'pixelNoise') {
    throw new RangeError('bodyStyle is invalid.')
  }
  if (parameters.shockwaveStyle !== 'segmentedArc' && parameters.shockwaveStyle !== 'fullRing') {
    throw new RangeError('shockwaveStyle is invalid.')
  }
  if (parameters.trailMode !== 'energyRays' && parameters.trailMode !== 'flameStrands') {
    throw new RangeError('trailMode is invalid.')
  }
  const integers = [
    parameters.canvasWidth,
    parameters.canvasHeight,
    parameters.radius,
    parameters.coreRadius,
    parameters.shockwaveWidth,
    parameters.frameCount,
    parameters.fragmentMinSize,
    parameters.fragmentMaxSize,
    parameters.fragmentRadialSpeed,
    parameters.fragmentTangentialJitter,
    parameters.trailLength,
    parameters.trailWidth,
    parameters.seed,
  ]
  if (integers.some((value) => !Number.isInteger(value))) {
    throw new RangeError('pixel-space values, frameCount, and seed must be integers.')
  }
}
