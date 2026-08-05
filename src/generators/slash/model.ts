import type { RgbColor } from '../../shared/pixel/color'
import type { FrameSize } from '../../shared/pixel/frame'
import { assertInRange, assertValidColor } from '../../shared/pixel/color'

export const FRAME_SIZE = 128
export const MIN_CANVAS_SIZE = 16
export const MAX_CANVAS_SIZE = 512
export const MIN_FRAME_COUNT = 5
export const MAX_FRAME_COUNT = 24
export const MAX_SWEEP_DEGREES = 720
export const MAX_FRAGMENT_SIZE = 16

export type SlashDirection = 'clockwise' | 'counterClockwise'
export type DissolveMode = 'ordered' | 'clusteredNoise' | 'directionalStreaks'
export type EdgeBreakupMode = 'blockChips' | 'jaggedContour' | 'slashCuts'
export type FragmentMode = 'pixelChunks' | 'directionalShards' | 'energySparks'

export interface SlashParameters {
  readonly palette: readonly RgbColor[]
  readonly canvasWidth: number
  readonly canvasHeight: number
  readonly radius: number
  readonly thickness: number
  readonly startAngleDegrees: number
  readonly sweepDegrees: number
  readonly rotationDegrees: number
  readonly tiltDegrees: number
  readonly frameCount: number
  readonly direction: SlashDirection
  readonly sweepSpeed: number
  readonly trailLength: number
  readonly dissolveLength: number
  readonly edgeBreakup: number
  readonly dissolveMode: DissolveMode
  readonly edgeBreakupMode: EdgeBreakupMode
  readonly fragmentMode: FragmentMode
  readonly fragmentAmount: number
  readonly seed: number
  readonly edgeDepth: number
  readonly fragmentMinSize: number
  readonly fragmentMaxSize: number
  readonly fragmentTangentSpeed: number
  readonly fragmentOutwardSpeed: number
  readonly fragmentLifetime: number
}

export interface SlashFrameLimits {
  readonly maxRadius: number
  readonly maxThickness: number
  readonly maxFragmentSize: number
  readonly maxFragmentTangentSpeed: number
  readonly maxFragmentOutwardSpeed: number
}

/** Returns the default canvas dimensions for the Slash generator. */
export function defaultSlashCanvasSize(): FrameSize {
  return { width: FRAME_SIZE, height: FRAME_SIZE }
}

/** Computes derived numeric limits from an explicit canvas size. */
export function frameLimits(size: FrameSize): SlashFrameLimits {
  const maxRadius = Math.max(2, Math.floor(Math.max(size.width, size.height) / 2))
  const scale = Math.min(size.width, size.height) / FRAME_SIZE
  return {
    maxRadius,
    maxThickness: maxRadius,
    maxFragmentSize: MAX_FRAGMENT_SIZE,
    maxFragmentTangentSpeed: Math.max(0, Math.round(32 * scale)),
    maxFragmentOutwardSpeed: Math.max(0, Math.round(24 * scale)),
  }
}

/** Clamps an integer value into inclusive bounds. */
export function clampInteger(value: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(value)) {
    return minimum
  }
  return Math.min(maximum, Math.max(minimum, Math.round(value)))
}

function clampCanvasDimension(value: number): number {
  return clampInteger(value, MIN_CANVAS_SIZE, MAX_CANVAS_SIZE)
}

/** Normalizes canvas dimensions into supported integer bounds. */
export function normalizeCanvasSize(size: FrameSize): FrameSize {
  return {
    width: clampCanvasDimension(size.width),
    height: clampCanvasDimension(size.height),
  }
}

/** Resolves a resize request as a deterministic parameter transform. */
export function resizeSlashCanvas(parameters: SlashParameters, nextSize: FrameSize, scaleEffect = true): SlashParameters {
  const oldSize = normalizeCanvasSize({ width: parameters.canvasWidth, height: parameters.canvasHeight })
  const scaledSize = normalizeCanvasSize(nextSize)
  const scale = scaleEffect ? Math.min(scaledSize.width, scaledSize.height) / Math.min(oldSize.width, oldSize.height) : 1
  const limits = frameLimits(scaledSize)
  const nextRadius = clampInteger(
    scaleEffect ? parameters.radius * scale : parameters.radius,
    2,
    limits.maxRadius,
  )
  const nextThicknessBase = scaleEffect ? parameters.thickness * scale : parameters.thickness
  const nextThickness = clampInteger(nextThicknessBase, 1, nextRadius)
  const scaledMinSize = clampInteger(
    scaleEffect ? parameters.fragmentMinSize * scale : parameters.fragmentMinSize,
    1,
    MAX_FRAGMENT_SIZE,
  )
  const scaledMaxSize = clampInteger(
    scaleEffect ? parameters.fragmentMaxSize * scale : parameters.fragmentMaxSize,
    1,
    MAX_FRAGMENT_SIZE,
  )
  return {
    ...parameters,
    canvasWidth: scaledSize.width,
    canvasHeight: scaledSize.height,
    radius: nextRadius,
    thickness: nextThickness,
    fragmentMinSize: Math.min(scaledMinSize, scaledMaxSize),
    fragmentMaxSize: Math.max(scaledMinSize, scaledMaxSize),
    fragmentTangentSpeed: clampInteger(
      scaleEffect ? parameters.fragmentTangentSpeed * scale : parameters.fragmentTangentSpeed,
      0,
      limits.maxFragmentTangentSpeed,
    ),
    fragmentOutwardSpeed: clampInteger(
      scaleEffect ? parameters.fragmentOutwardSpeed * scale : parameters.fragmentOutwardSpeed,
      0,
      limits.maxFragmentOutwardSpeed,
    ),
  }
}

/** Updates the minimum fragment size, raising the maximum so the range stays valid. */
export function updateFragmentMinSize(parameters: SlashParameters, value: number): SlashParameters {
  const minimum = clampInteger(value, 1, MAX_FRAGMENT_SIZE)
  return {
    ...parameters,
    fragmentMinSize: minimum,
    fragmentMaxSize: Math.max(minimum, parameters.fragmentMaxSize),
  }
}

/** Updates the maximum fragment size, lowering the minimum so the range stays valid. */
export function updateFragmentMaxSize(parameters: SlashParameters, value: number): SlashParameters {
  const maximum = clampInteger(value, 1, MAX_FRAGMENT_SIZE)
  return {
    ...parameters,
    fragmentMaxSize: maximum,
    fragmentMinSize: Math.min(maximum, parameters.fragmentMinSize),
  }
}

export const DEFAULT_SLASH_PARAMETERS: SlashParameters = {
  palette: [
    { r: 255, g: 255, b: 255 },
    { r: 154, g: 198, b: 255 },
    { r: 52, g: 140, b: 255 },
  ],
  canvasWidth: FRAME_SIZE,
  canvasHeight: FRAME_SIZE,
  radius: 44,
  thickness: 12,
  startAngleDegrees: -90,
  sweepDegrees: 180,
  rotationDegrees: 0,
  tiltDegrees: 0,
  frameCount: 8,
  direction: 'clockwise',
  sweepSpeed: 0.5,
  trailLength: 0.25,
  dissolveLength: 0.25,
  edgeBreakup: 0.08,
  dissolveMode: 'clusteredNoise',
  edgeBreakupMode: 'slashCuts',
  fragmentMode: 'directionalShards',
  fragmentAmount: 0.2,
  seed: 1337,
  edgeDepth: 0.24,
  fragmentMinSize: 1,
  fragmentMaxSize: 2,
  fragmentTangentSpeed: 14,
  fragmentOutwardSpeed: 7,
  fragmentLifetime: 0.38,
}

/** Validates the complete Slash parameter contract before rendering. */
export function assertValidParameters(parameters: SlashParameters): void {
  if (parameters.palette.length < 2 || parameters.palette.length > 6) {
    throw new RangeError('palette must contain between 2 and 6 colors.')
  }
  parameters.palette.forEach((color, index) => assertValidColor(color, `palette[${index}]`))
  assertInRange(parameters.canvasWidth, MIN_CANVAS_SIZE, MAX_CANVAS_SIZE, 'canvasWidth')
  assertInRange(parameters.canvasHeight, MIN_CANVAS_SIZE, MAX_CANVAS_SIZE, 'canvasHeight')
  const limits = frameLimits({
    width: parameters.canvasWidth,
    height: parameters.canvasHeight,
  })
  assertInRange(parameters.radius, 2, limits.maxRadius, 'radius')
  assertInRange(parameters.thickness, 1, parameters.radius, 'thickness')
  assertInRange(parameters.startAngleDegrees, -180, 180, 'startAngleDegrees')
  assertInRange(parameters.sweepDegrees, 30, MAX_SWEEP_DEGREES, 'sweepDegrees')
  assertInRange(parameters.rotationDegrees, -180, 180, 'rotationDegrees')
  assertInRange(parameters.tiltDegrees, 0, 90, 'tiltDegrees')
  assertInRange(parameters.frameCount, MIN_FRAME_COUNT, MAX_FRAME_COUNT, 'frameCount')
  assertInRange(parameters.sweepSpeed, 0, 1, 'sweepSpeed')
  assertInRange(parameters.trailLength, 0, 1, 'trailLength')
  assertInRange(parameters.dissolveLength, 0, 1, 'dissolveLength')
  assertInRange(parameters.edgeBreakup, 0, 1, 'edgeBreakup')
  assertInRange(parameters.fragmentAmount, 0, 1, 'fragmentAmount')
  assertInRange(parameters.seed, 0, 0xffffffff, 'seed')
  assertInRange(parameters.edgeDepth, 0.05, 0.5, 'edgeDepth')
  assertInRange(parameters.fragmentMinSize, 1, MAX_FRAGMENT_SIZE, 'fragmentMinSize')
  assertInRange(parameters.fragmentMaxSize, 1, MAX_FRAGMENT_SIZE, 'fragmentMaxSize')
  if (parameters.fragmentMinSize > parameters.fragmentMaxSize) {
    throw new RangeError('fragmentMinSize must not exceed fragmentMaxSize.')
  }
  assertInRange(parameters.fragmentTangentSpeed, 0, limits.maxFragmentTangentSpeed, 'fragmentTangentSpeed')
  assertInRange(parameters.fragmentOutwardSpeed, 0, limits.maxFragmentOutwardSpeed, 'fragmentOutwardSpeed')
  assertInRange(parameters.fragmentLifetime, 0.1, 1, 'fragmentLifetime')
  if (
    !Number.isInteger(parameters.frameCount)
    || !Number.isInteger(parameters.canvasWidth)
    || !Number.isInteger(parameters.canvasHeight)
    || !Number.isInteger(parameters.radius)
    || !Number.isInteger(parameters.thickness)
    || !Number.isInteger(parameters.seed)
    || !Number.isInteger(parameters.fragmentMinSize)
    || !Number.isInteger(parameters.fragmentMaxSize)
  ) {
    throw new RangeError('frameCount, canvas sizes, radius, thickness, seed, and fragment sizes must be integers.')
  }
  if (parameters.direction !== 'clockwise' && parameters.direction !== 'counterClockwise') {
    throw new RangeError('direction is invalid.')
  }
  if (
    parameters.dissolveMode !== 'ordered'
    && parameters.dissolveMode !== 'clusteredNoise'
    && parameters.dissolveMode !== 'directionalStreaks'
  ) {
    throw new RangeError('dissolveMode is invalid.')
  }
  if (
    parameters.edgeBreakupMode !== 'blockChips'
    && parameters.edgeBreakupMode !== 'jaggedContour'
    && parameters.edgeBreakupMode !== 'slashCuts'
  ) {
    throw new RangeError('edgeBreakupMode is invalid.')
  }
  if (
    parameters.fragmentMode !== 'pixelChunks'
    && parameters.fragmentMode !== 'directionalShards'
    && parameters.fragmentMode !== 'energySparks'
  ) {
    throw new RangeError('fragmentMode is invalid.')
  }
}
