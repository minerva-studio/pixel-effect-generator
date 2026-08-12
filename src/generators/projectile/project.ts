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
  type CrystalForm,
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
    crystalForm: parameters.crystalForm,
    fireRearExtension: parameters.fireRearExtension,
    fireRearTurbulence: parameters.fireRearTurbulence,
    fireFlowSpeed: parameters.fireFlowSpeed,
    fireMottleAmount: parameters.fireMottleAmount,
    solidHeadLength: parameters.solidHeadLength,
    solidShaftWidth: parameters.solidShaftWidth,
    solidFletchingSpread: parameters.solidFletchingSpread,
    energyCoreLength: parameters.energyCoreLength,
    energyShellWidth: parameters.energyShellWidth,
    energyTipSharpness: parameters.energyTipSharpness,
    crystalSpearTaper: parameters.crystalSpearTaper,
    crystalSpearThickness: parameters.crystalSpearThickness,
    crystalRefractionStrength: parameters.crystalRefractionStrength,
    crystalGlintStrength: parameters.crystalGlintStrength,
    crystalGlintSpeed: parameters.crystalGlintSpeed,
    crystalCoreScale: parameters.crystalCoreScale,
    crystalOrbitRadius: parameters.crystalOrbitRadius,
    crystalOrbitSpeed: parameters.crystalOrbitSpeed,
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
    kind: readEnum(value, 'kind', ['fireball', 'arrow', 'crystal']),
    arrowMaterial: readEnum(value, 'arrowMaterial', ['solid', 'energy']),
    // Crystal form was added after the first projectile projects shipped;
    // old documents resolve to the compact spear rather than being rejected.
    crystalForm: readOptionalEnum(value, 'crystalForm', ['spear', 'core'], 'spear'),
    fireRearExtension: readOptionalNumber(value, 'fireRearExtension', 0, 1, 0.5),
    fireRearTurbulence: readOptionalNumber(value, 'fireRearTurbulence', 0, 1, 0.6),
    fireFlowSpeed: readOptionalNumber(value, 'fireFlowSpeed', 0.25, 3, 1),
    fireMottleAmount: readOptionalNumber(value, 'fireMottleAmount', 0, 1, 0),
    solidHeadLength: readOptionalNumber(value, 'solidHeadLength', 0.15, 0.55, 0.3),
    solidShaftWidth: readOptionalNumber(value, 'solidShaftWidth', 0.08, 0.4, 0.16),
    solidFletchingSpread: readOptionalNumber(value, 'solidFletchingSpread', 0.2, 1, 0.58),
    energyCoreLength: readOptionalNumber(value, 'energyCoreLength', 0.25, 0.85, 0.55),
    energyShellWidth: readOptionalNumber(value, 'energyShellWidth', 0.05, 0.5, 0.25),
    energyTipSharpness: readOptionalNumber(value, 'energyTipSharpness', 0.2, 0.8, 0.55),
    crystalSpearTaper: readOptionalNumber(value, 'crystalSpearTaper', 0.2, 0.8, 0.5),
    crystalSpearThickness: readOptionalNumber(value, 'crystalSpearThickness', 0.5, 1.5, 1),
    crystalRefractionStrength: readOptionalNumber(value, 'crystalRefractionStrength', 0, 1, 0.55),
    crystalGlintStrength: readOptionalNumber(value, 'crystalGlintStrength', 0, 1, 0),
    crystalGlintSpeed: readOptionalNumber(value, 'crystalGlintSpeed', 0.25, 3, 1),
    crystalCoreScale: readOptionalNumber(value, 'crystalCoreScale', 0.5, 1.5, 1),
    crystalOrbitRadius: readOptionalNumber(value, 'crystalOrbitRadius', 0.75, 2.25, 1.35),
    crystalOrbitSpeed: readOptionalNumber(value, 'crystalOrbitSpeed', 0.25, 3, 1),
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

/** Reads an optional bounded number while preserving valid legacy snapshots. */
export function readOptionalNumber(record: Readonly<Record<string, unknown>>, key: string, minimum: number, maximum: number, fallback: number): number {
  if (record[key] === undefined) return fallback
  return readNumber(record, key, minimum, maximum)
}

/** Reads an optional enum field while preserving valid legacy project snapshots. */
export function readOptionalEnum<Value extends string>(
  record: Readonly<Record<string, unknown>>,
  key: string,
  allowed: readonly Value[],
  fallback: Value,
): Value {
  if (record[key] === undefined) return fallback
  return readEnum(record, key, allowed)
}

/** Reads one required boolean field. */
export function readBoolean(record: Readonly<Record<string, unknown>>, key: string): boolean {
  const value = record[key]
  if (typeof value !== 'boolean') {
    throw new RangeError(`${key} must be a boolean.`)
  }
  return value
}

export type { ProjectileKind, ArrowMaterial, CrystalForm, TrailMode }
