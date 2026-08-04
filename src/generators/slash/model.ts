import type { RgbColor } from '../../shared/pixel/color'
import { assertInRange, assertValidColor } from '../../shared/pixel/color'

export const FRAME_SIZE = 128
export const MIN_FRAME_COUNT = 5
export const MAX_FRAME_COUNT = 24
export const MAX_SWEEP_DEGREES = 720

export type SlashDirection = 'clockwise' | 'counterClockwise'
export type DissolveMode = 'ordered' | 'clusteredNoise' | 'directionalStreaks'
export type EdgeBreakupMode = 'blockChips' | 'jaggedContour' | 'slashCuts'
export type FragmentMode = 'pixelChunks' | 'directionalShards' | 'energySparks'

export interface SlashParameters {
  readonly palette: readonly RgbColor[]
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
  readonly fragmentSize: number
  readonly fragmentTangentSpeed: number
  readonly fragmentOutwardSpeed: number
  readonly fragmentLifetime: number
}

export const DEFAULT_SLASH_PARAMETERS: SlashParameters = {
  palette: [
    { r: 255, g: 255, b: 255 },
    { r: 154, g: 198, b: 255 },
    { r: 52, g: 140, b: 255 },
  ],
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
  fragmentSize: 1,
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
  assertInRange(parameters.radius, 2, FRAME_SIZE / 2 - 1, 'radius')
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
  assertInRange(parameters.fragmentSize, 1, 3, 'fragmentSize')
  assertInRange(parameters.fragmentTangentSpeed, 0, 32, 'fragmentTangentSpeed')
  assertInRange(parameters.fragmentOutwardSpeed, 0, 24, 'fragmentOutwardSpeed')
  assertInRange(parameters.fragmentLifetime, 0.1, 1, 'fragmentLifetime')
  if (
    !Number.isInteger(parameters.frameCount)
    || !Number.isInteger(parameters.seed)
    || !Number.isInteger(parameters.fragmentSize)
  ) {
    throw new RangeError('frameCount, seed, and fragmentSize must be integers.')
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
