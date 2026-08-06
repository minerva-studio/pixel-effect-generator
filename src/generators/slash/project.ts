import { isPlainRecord } from '../../shared/project/document'
import type { GeneratorProjectCodec, JsonValue } from '../../shared/project/types'
import type { RgbColor } from '../../shared/pixel/color'
import {
  assertValidParameters,
  frameLimits,
  MAX_CANVAS_SIZE,
  MAX_FRAGMENT_SIZE,
  MAX_FRAME_COUNT,
  MAX_SWEEP_DEGREES,
  MIN_CANVAS_SIZE,
  MIN_FRAME_COUNT,
  type DissolveMode,
  type EdgeBreakupMode,
  type FragmentMode,
  type SlashDirection,
  type SlashParameters,
} from './model'

const REQUIRED_PARAMETER_KEYS = [
  'palette',
  'canvasWidth',
  'canvasHeight',
  'radius',
  'thickness',
  'startAngleDegrees',
  'sweepDegrees',
  'rotationDegrees',
  'tiltDegrees',
  'frameCount',
  'direction',
  'sweepSpeed',
  'trailLength',
  'dissolveLength',
  'edgeBreakup',
  'dissolveMode',
  'edgeBreakupMode',
  'fragmentMode',
  'fragmentAmount',
  'seed',
  'edgeDepth',
  'fragmentMinSize',
  'fragmentMaxSize',
  'fragmentTangentSpeed',
  'fragmentOutwardSpeed',
  'fragmentLifetime',
] as const

/**
 * Serializes Slash parameters into plain JSON data with a fresh palette array;
 * the returned value never shares references with the input.
 */
export function serializeSlashParameters(parameters: SlashParameters): JsonValue {
  return {
    palette: parameters.palette.map(({ r, g, b, a }) => ({ r, g, b, a })),
    canvasWidth: parameters.canvasWidth,
    canvasHeight: parameters.canvasHeight,
    radius: parameters.radius,
    thickness: parameters.thickness,
    startAngleDegrees: parameters.startAngleDegrees,
    sweepDegrees: parameters.sweepDegrees,
    rotationDegrees: parameters.rotationDegrees,
    tiltDegrees: parameters.tiltDegrees,
    frameCount: parameters.frameCount,
    direction: parameters.direction,
    sweepSpeed: parameters.sweepSpeed,
    trailLength: parameters.trailLength,
    dissolveLength: parameters.dissolveLength,
    edgeBreakup: parameters.edgeBreakup,
    dissolveMode: parameters.dissolveMode,
    edgeBreakupMode: parameters.edgeBreakupMode,
    fragmentMode: parameters.fragmentMode,
    fragmentAmount: parameters.fragmentAmount,
    seed: parameters.seed,
    edgeDepth: parameters.edgeDepth,
    fragmentMinSize: parameters.fragmentMinSize,
    fragmentMaxSize: parameters.fragmentMaxSize,
    fragmentTangentSpeed: parameters.fragmentTangentSpeed,
    fragmentOutwardSpeed: parameters.fragmentOutwardSpeed,
    fragmentLifetime: parameters.fragmentLifetime,
  }
}

/**
 * Strictly parses Slash parameters from an unknown JSON value. Every required
 * v1 field must exist; unknown fields are ignored; validation reuses the same
 * dynamic limits as the renderer via assertValidParameters.
 */
export function parseSlashParameters(value: unknown): SlashParameters {
  if (!isPlainRecord(value)) {
    throw new RangeError('parameters must be an object.')
  }
  for (const key of REQUIRED_PARAMETER_KEYS) {
    if (!(key in value)) {
      throw new RangeError(`Missing parameter: ${key}`)
    }
  }
  const canvasWidth = readInteger(value, 'canvasWidth', MIN_CANVAS_SIZE, MAX_CANVAS_SIZE)
  const canvasHeight = readInteger(value, 'canvasHeight', MIN_CANVAS_SIZE, MAX_CANVAS_SIZE)
  const limits = frameLimits({ width: canvasWidth, height: canvasHeight })
  const parameters: SlashParameters = {
    palette: readPalette(value.palette),
    canvasWidth,
    canvasHeight,
    radius: readInteger(value, 'radius', 2, limits.maxRadius),
    thickness: readInteger(value, 'thickness', 1, limits.maxRadius),
    startAngleDegrees: readNumber(value, 'startAngleDegrees', -180, 180),
    sweepDegrees: readNumber(value, 'sweepDegrees', 30, MAX_SWEEP_DEGREES),
    rotationDegrees: readNumber(value, 'rotationDegrees', -180, 180),
    tiltDegrees: readNumber(value, 'tiltDegrees', 0, 90),
    frameCount: readInteger(value, 'frameCount', MIN_FRAME_COUNT, MAX_FRAME_COUNT),
    direction: readEnum(value, 'direction', ['clockwise', 'counterClockwise']),
    sweepSpeed: readNumber(value, 'sweepSpeed', 0, 1),
    trailLength: readNumber(value, 'trailLength', 0, 1),
    dissolveLength: readNumber(value, 'dissolveLength', 0, 1),
    edgeBreakup: readNumber(value, 'edgeBreakup', 0, 1),
    dissolveMode: readEnum(value, 'dissolveMode', ['ordered', 'clusteredNoise', 'directionalStreaks']),
    edgeBreakupMode: readEnum(value, 'edgeBreakupMode', ['blockChips', 'jaggedContour', 'slashCuts']),
    fragmentMode: readEnum(value, 'fragmentMode', ['pixelChunks', 'directionalShards', 'energySparks']),
    fragmentAmount: readNumber(value, 'fragmentAmount', 0, 1),
    seed: readInteger(value, 'seed', 0, 0xffffffff),
    edgeDepth: readNumber(value, 'edgeDepth', 0.05, 0.5),
    fragmentMinSize: readInteger(value, 'fragmentMinSize', 1, MAX_FRAGMENT_SIZE),
    fragmentMaxSize: readInteger(value, 'fragmentMaxSize', 1, MAX_FRAGMENT_SIZE),
    fragmentTangentSpeed: readNumber(value, 'fragmentTangentSpeed', 0, limits.maxFragmentTangentSpeed),
    fragmentOutwardSpeed: readNumber(value, 'fragmentOutwardSpeed', 0, limits.maxFragmentOutwardSpeed),
    fragmentLifetime: readNumber(value, 'fragmentLifetime', 0.1, 1),
  }
  assertValidParameters(parameters)
  return parameters
}

/** Slash v1 project codec registered on the generator module. */
export const slashProjectCodec: GeneratorProjectCodec<SlashParameters> = {
  generatorId: 'slash',
  version: 1,
  serialize: serializeSlashParameters,
  parse: parseSlashParameters,
}

export function readPalette(value: unknown): RgbColor[] {
  if (!Array.isArray(value) || value.length < 2 || value.length > 6) {
    throw new RangeError('palette must be an array of 2 to 6 colors.')
  }
  return value.map((entry, index) => {
    if (!isPlainRecord(entry)) {
      throw new RangeError(`palette[${index}] must be an object.`)
    }
    return {
      r: readInteger(entry, 'r', 0, 255),
      g: readInteger(entry, 'g', 0, 255),
      b: readInteger(entry, 'b', 0, 255),
      a: readOptionalInteger(entry, 'a', 0, 255, 255),
    }
  })
}

/** Reads an optional bounded integer field, falling back to a default when absent. */
export function readOptionalInteger(record: Readonly<Record<string, unknown>>, key: string, minimum: number, maximum: number, fallback: number): number {
  const value = record[key]
  if (value === undefined) return fallback
  if (typeof value !== 'number' || !Number.isInteger(value) || value < minimum || value > maximum) {
    throw new RangeError(`${key} must be an integer between ${minimum} and ${maximum}.`)
  }
  return value
}

export function readInteger(record: Readonly<Record<string, unknown>>, key: string, minimum: number, maximum: number): number {
  const value = record[key]
  if (typeof value !== 'number' || !Number.isInteger(value) || value < minimum || value > maximum) {
    throw new RangeError(`${key} must be an integer between ${minimum} and ${maximum}.`)
  }
  return value
}

export function readNumber(record: Readonly<Record<string, unknown>>, key: string, minimum: number, maximum: number): number {
  const value = record[key]
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum) {
    throw new RangeError(`${key} must be a number between ${minimum} and ${maximum}.`)
  }
  return value
}

export function readEnum<Value extends string>(
  record: Readonly<Record<string, unknown>>,
  key: string,
  allowed: readonly Value[],
): Value {
  const value = record[key]
  if (typeof value !== 'string' || !allowed.includes(value as Value)) {
    throw new RangeError(`${key} is invalid.`)
  }
  return value as Value
}

export type { DissolveMode, EdgeBreakupMode, FragmentMode, SlashDirection }
