import { isPlainRecord } from '../../shared/project/document'
import type { GeneratorProjectCodec, JsonValue } from '../../shared/project/types'
import type { RgbColor } from '../../shared/pixel/color'
import {
  assertValidProjectileParameters,
  MAX_AFTERIMAGE_COUNT,
  MAX_BODY_PALETTE_SIZE,
  MAX_CANVAS_SIZE,
  MAX_ENERGY_PALETTE_SIZE,
  MAX_FRAME_COUNT,
  MAX_LOOP_CYCLES,
  MAX_SPARK_COUNT,
  MIN_BODY_PALETTE_SIZE,
  MIN_CANVAS_SIZE,
  MIN_ENERGY_PALETTE_SIZE,
  MIN_FRAME_COUNT,
  projectileFrameLimits,
  type ArrowMaterial,
  type ProjectileKind,
  type ProjectileParameters,
  type TrailMode,
} from './model'

const REQUIRED_PARAMETER_KEYS = [
  'canvasWidth',
  'canvasHeight',
  'frameCount',
  'seed',
  'kind',
  'arrowMaterial',
  'radius',
  'bodyLength',
  'silhouetteVariation',
  'rotationDegrees',
  'loopCycles',
  'pulseAmount',
  'wobbleAmount',
  'trailMode',
  'trailLength',
  'trailWidth',
  'trailWave',
  'trailBreakup',
  'sparksEnabled',
  'sparkCount',
  'sparkSpread',
  'sparkSpacing',
  'sparkFade',
  'afterimagesEnabled',
  'afterimageCount',
  'afterimageSpacing',
  'afterimageDecay',
  'bodyPalette',
  'energyPalette',
] as const

/**
 * Serializes projectile parameters into plain JSON data with fresh palette
 * arrays; the returned value never shares references with the input.
 */
export function serializeProjectileParameters(parameters: ProjectileParameters): JsonValue {
  return {
    canvasWidth: parameters.canvasWidth,
    canvasHeight: parameters.canvasHeight,
    frameCount: parameters.frameCount,
    seed: parameters.seed,
    kind: parameters.kind,
    arrowMaterial: parameters.arrowMaterial,
    radius: parameters.radius,
    bodyLength: parameters.bodyLength,
    silhouetteVariation: parameters.silhouetteVariation,
    rotationDegrees: parameters.rotationDegrees,
    loopCycles: parameters.loopCycles,
    pulseAmount: parameters.pulseAmount,
    wobbleAmount: parameters.wobbleAmount,
    trailMode: parameters.trailMode,
    trailLength: parameters.trailLength,
    trailWidth: parameters.trailWidth,
    trailWave: parameters.trailWave,
    trailBreakup: parameters.trailBreakup,
    sparksEnabled: parameters.sparksEnabled,
    sparkCount: parameters.sparkCount,
    sparkSpread: parameters.sparkSpread,
    sparkSpacing: parameters.sparkSpacing,
    sparkFade: parameters.sparkFade,
    afterimagesEnabled: parameters.afterimagesEnabled,
    afterimageCount: parameters.afterimageCount,
    afterimageSpacing: parameters.afterimageSpacing,
    afterimageDecay: parameters.afterimageDecay,
    bodyPalette: parameters.bodyPalette.map(({ r, g, b, a }) => ({ r, g, b, a })),
    energyPalette: parameters.energyPalette.map(({ r, g, b, a }) => ({ r, g, b, a })),
  } as JsonValue
}

/** Parses one projectile parameter snapshot with strict bounds. */
export function parseProjectileParameters(value: unknown): ProjectileParameters {
  if (!isPlainRecord(value)) {
    throw new RangeError('projectile parameters must be an object.')
  }
  for (const key of REQUIRED_PARAMETER_KEYS) {
    if (!(key in value)) {
      throw new RangeError(`Missing projectile field: ${key}`)
    }
  }
  const canvasWidth = readInteger(value, 'canvasWidth', MIN_CANVAS_SIZE, MAX_CANVAS_SIZE)
  const canvasHeight = readInteger(value, 'canvasHeight', MIN_CANVAS_SIZE, MAX_CANVAS_SIZE)
  const limits = projectileFrameLimits({ width: canvasWidth, height: canvasHeight })
  const parameters: ProjectileParameters = {
    canvasWidth,
    canvasHeight,
    frameCount: readInteger(value, 'frameCount', MIN_FRAME_COUNT, MAX_FRAME_COUNT),
    seed: readInteger(value, 'seed', 0, 0xffffffff),
    kind: readEnum(value, 'kind', ['fireball', 'arrow']),
    arrowMaterial: readEnum(value, 'arrowMaterial', ['solid', 'energy']),
    radius: readInteger(value, 'radius', 2, limits.maxRadius),
    bodyLength: readInteger(value, 'bodyLength', 4, limits.maxBodyLength),
    silhouetteVariation: readNumber(value, 'silhouetteVariation', 0, 1),
    rotationDegrees: readInteger(value, 'rotationDegrees', 0, 359),
    loopCycles: readInteger(value, 'loopCycles', 1, MAX_LOOP_CYCLES),
    pulseAmount: readNumber(value, 'pulseAmount', 0, 1),
    wobbleAmount: readNumber(value, 'wobbleAmount', 0, 1),
    trailMode: readEnum(value, 'trailMode', ['off', 'fire', 'energy']),
    trailLength: readNumber(value, 'trailLength', 0, 1),
    trailWidth: readInteger(value, 'trailWidth', 1, limits.maxRadius),
    trailWave: readNumber(value, 'trailWave', 0, 1),
    trailBreakup: readNumber(value, 'trailBreakup', 0, 1),
    sparksEnabled: readBoolean(value, 'sparksEnabled'),
    sparkCount: readInteger(value, 'sparkCount', 0, MAX_SPARK_COUNT),
    sparkSpread: readNumber(value, 'sparkSpread', 0, 1),
    sparkSpacing: readNumber(value, 'sparkSpacing', 0, 1),
    sparkFade: readNumber(value, 'sparkFade', 0, 1),
    afterimagesEnabled: readBoolean(value, 'afterimagesEnabled'),
    afterimageCount: readInteger(value, 'afterimageCount', 0, MAX_AFTERIMAGE_COUNT),
    afterimageSpacing: readNumber(value, 'afterimageSpacing', 0, 1),
    afterimageDecay: readNumber(value, 'afterimageDecay', 0, 1),
    bodyPalette: readPalette(value.bodyPalette, MIN_BODY_PALETTE_SIZE, MAX_BODY_PALETTE_SIZE),
    energyPalette: readPalette(value.energyPalette, MIN_ENERGY_PALETTE_SIZE, MAX_ENERGY_PALETTE_SIZE),
  }
  assertValidProjectileParameters(parameters)
  return parameters
}

/** Projectile v1 project codec registered on the generator module. */
export const projectileProjectCodec: GeneratorProjectCodec<ProjectileParameters> = {
  generatorId: 'projectile',
  version: 1,
  serialize: serializeProjectileParameters,
  parse: parseProjectileParameters,
}

/** Reads a palette entry array with the given inclusive size bounds. */
export function readPalette(value: unknown, minimum: number, maximum: number): RgbColor[] {
  if (!Array.isArray(value) || value.length < minimum || value.length > maximum) {
    throw new RangeError(`palette must be an array of ${minimum} to ${maximum} colors.`)
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

/** Reads one bounded integer field. */
export function readInteger(record: Readonly<Record<string, unknown>>, key: string, minimum: number, maximum: number): number {
  const value = record[key]
  if (typeof value !== 'number' || !Number.isInteger(value) || value < minimum || value > maximum) {
    throw new RangeError(`${key} must be an integer between ${minimum} and ${maximum}.`)
  }
  return value
}

/** Reads one bounded finite numeric field. */
export function readNumber(record: Readonly<Record<string, unknown>>, key: string, minimum: number, maximum: number): number {
  const value = record[key]
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum) {
    throw new RangeError(`${key} must be a number between ${minimum} and ${maximum}.`)
  }
  return value
}

/** Reads one required enum field. */
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

/** Reads one required boolean field. */
export function readBoolean(record: Readonly<Record<string, unknown>>, key: string): boolean {
  const value = record[key]
  if (typeof value !== 'boolean') {
    throw new RangeError(`${key} must be a boolean.`)
  }
  return value
}

export type { ProjectileKind, ArrowMaterial, TrailMode }
