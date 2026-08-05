import { isPlainRecord } from '../../shared/project/document'
import type { JsonValue } from '../../shared/project/types'
import type { RgbColor } from '../../shared/pixel/color'
import type { GeneratorPreset, GeneratorPresetCapability } from '../contract'
import {
  assertValidExplosionParameters,
  clampInteger,
  explosionFrameLimits,
  MAX_FRAGMENT_SIZE,
  type ExplosionBodyStyle,
  type ExplosionParameters,
  type ExplosionShockwaveStyle,
  type ExplosionTrailMode,
} from './model'

/** Preset payload covers every effect field except canvas size and frame count. */
export type ExplosionPresetFields = Omit<ExplosionParameters, 'canvasWidth' | 'canvasHeight' | 'frameCount'>

/** Generous static bounds used before the per-canvas clamp in apply. */
const MAX_PRESET_RADIUS = 256
const MAX_PRESET_FRAGMENT_SPEED = 128
const MAX_PRESET_TANGENTIAL_JITTER = 64
const MAX_PRESET_TRAIL_LENGTH = 256
const MAX_PRESET_TRAIL_WIDTH = 64

const REQUIRED_PRESET_KEYS = [
  'palette',
  'mode',
  'bodyStyle',
  'shockwaveStyle',
  'trailMode',
  'radius',
  'bodyStrength',
  'irregularity',
  'coreRadius',
  'shockwaveWidth',
  'expansionSpeed',
  'coreDuration',
  'shockwaveSpeed',
  'dissolveStart',
  'fragmentAmount',
  'fragmentMinSize',
  'fragmentMaxSize',
  'fragmentRadialSpeed',
  'fragmentTangentialJitter',
  'fragmentLifetime',
  'trailAmount',
  'trailLength',
  'trailWidth',
  'trailLengthRandomness',
  'seed',
] as const

/** Captures the effect-defining fields with stable key order. */
export function captureExplosionPreset(parameters: ExplosionParameters): JsonValue {
  return {
    palette: parameters.palette.map(({ r, g, b }) => ({ r, g, b })),
    mode: parameters.mode,
    bodyStyle: parameters.bodyStyle,
    shockwaveStyle: parameters.shockwaveStyle,
    trailMode: parameters.trailMode,
    radius: parameters.radius,
    bodyStrength: parameters.bodyStrength,
    irregularity: parameters.irregularity,
    coreRadius: parameters.coreRadius,
    shockwaveWidth: parameters.shockwaveWidth,
    expansionSpeed: parameters.expansionSpeed,
    coreDuration: parameters.coreDuration,
    shockwaveSpeed: parameters.shockwaveSpeed,
    dissolveStart: parameters.dissolveStart,
    fragmentAmount: parameters.fragmentAmount,
    fragmentMinSize: parameters.fragmentMinSize,
    fragmentMaxSize: parameters.fragmentMaxSize,
    fragmentRadialSpeed: parameters.fragmentRadialSpeed,
    fragmentTangentialJitter: parameters.fragmentTangentialJitter,
    fragmentLifetime: parameters.fragmentLifetime,
    trailAmount: parameters.trailAmount,
    trailLength: parameters.trailLength,
    trailWidth: parameters.trailWidth,
    trailLengthRandomness: parameters.trailLengthRandomness,
    seed: parameters.seed,
  } as JsonValue
}

/** Parses one preset payload into typed effect fields with strict bounds. */
export function parseExplosionPresetPayload(value: unknown): ExplosionPresetFields {
  if (!isPlainRecord(value)) {
    throw new RangeError('preset payload must be an object.')
  }
  for (const key of REQUIRED_PRESET_KEYS) {
    if (!(key in value)) {
      throw new RangeError(`Missing preset field: ${key}`)
    }
  }
  return {
    palette: readPalette(value.palette),
    mode: readEnum(value, 'mode', ['explosion', 'implosion']),
    bodyStyle: readEnum(value, 'bodyStyle', ['cleanClusters', 'pixelNoise']),
    shockwaveStyle: readEnum(value, 'shockwaveStyle', ['segmentedArc', 'fullRing']),
    trailMode: readEnum(value, 'trailMode', ['energyRays', 'flameStrands']),
    radius: readInteger(value, 'radius', 2, MAX_PRESET_RADIUS),
    bodyStrength: readNumber(value, 'bodyStrength', 0, 1),
    irregularity: readNumber(value, 'irregularity', 0, 1),
    coreRadius: readInteger(value, 'coreRadius', 0, MAX_PRESET_RADIUS),
    shockwaveWidth: readInteger(value, 'shockwaveWidth', 0, MAX_PRESET_RADIUS),
    expansionSpeed: readNumber(value, 'expansionSpeed', 0, 1),
    coreDuration: readNumber(value, 'coreDuration', 0.1, 0.9),
    shockwaveSpeed: readNumber(value, 'shockwaveSpeed', 0, 1),
    dissolveStart: readNumber(value, 'dissolveStart', 0.1, 0.9),
    fragmentAmount: readNumber(value, 'fragmentAmount', 0, 1),
    fragmentMinSize: readInteger(value, 'fragmentMinSize', 1, MAX_FRAGMENT_SIZE),
    fragmentMaxSize: readInteger(value, 'fragmentMaxSize', 1, MAX_FRAGMENT_SIZE),
    fragmentRadialSpeed: readInteger(value, 'fragmentRadialSpeed', 0, MAX_PRESET_FRAGMENT_SPEED),
    fragmentTangentialJitter: readInteger(value, 'fragmentTangentialJitter', 0, MAX_PRESET_TANGENTIAL_JITTER),
    fragmentLifetime: readNumber(value, 'fragmentLifetime', 0.1, 1),
    trailAmount: readNumber(value, 'trailAmount', 0, 1),
    trailLength: readInteger(value, 'trailLength', 0, MAX_PRESET_TRAIL_LENGTH),
    trailWidth: readInteger(value, 'trailWidth', 1, MAX_PRESET_TRAIL_WIDTH),
    trailLengthRandomness: readNumber(value, 'trailLengthRandomness', 0, 1),
    seed: readInteger(value, 'seed', 0, 0xffffffff),
  }
}

/**
 * Applies a preset onto the current parameters, keeping the current canvas
 * size and frame count, then clamps every effect field to the current canvas
 * limits so the result always renders legally.
 */
export function applyExplosionPreset(parameters: ExplosionParameters, payload: JsonValue): ExplosionParameters {
  const fields = parseExplosionPresetPayload(payload)
  const merged: ExplosionParameters = {
    ...parameters,
    ...fields,
    canvasWidth: parameters.canvasWidth,
    canvasHeight: parameters.canvasHeight,
    frameCount: parameters.frameCount,
  }
  return clampExplosionPresetParameters(merged)
}

/** Clamps effect fields to the current canvas limits and validates the result. */
export function clampExplosionPresetParameters(parameters: ExplosionParameters): ExplosionParameters {
  const limits = explosionFrameLimits({ width: parameters.canvasWidth, height: parameters.canvasHeight })
  const fragmentMinSize = clampInteger(parameters.fragmentMinSize, 1, MAX_FRAGMENT_SIZE)
  const fragmentMaxSize = clampInteger(parameters.fragmentMaxSize, 1, MAX_FRAGMENT_SIZE)
  const clamped: ExplosionParameters = {
    ...parameters,
    radius: clampInteger(parameters.radius, 2, limits.maxRadius),
    coreRadius: clampInteger(parameters.coreRadius, 0, limits.maxRadius),
    shockwaveWidth: clampInteger(parameters.shockwaveWidth, 0, limits.maxRadius),
    fragmentMinSize: Math.min(fragmentMinSize, fragmentMaxSize),
    fragmentMaxSize: Math.max(fragmentMinSize, fragmentMaxSize),
    fragmentRadialSpeed: clampInteger(parameters.fragmentRadialSpeed, 0, limits.maxFragmentSpeed),
    fragmentTangentialJitter: clampInteger(parameters.fragmentTangentialJitter, 0, limits.maxTangentialJitter),
    trailLength: clampInteger(parameters.trailLength, 0, limits.maxTrailLength),
    trailWidth: clampInteger(parameters.trailWidth, 1, limits.maxTrailWidth),
  }
  assertValidExplosionParameters(clamped)
  return clamped
}

/** Validates one payload and returns its canonical captured form. */
export function validateExplosionPreset(
  payload: unknown,
): { readonly ok: true; readonly payload: JsonValue } | { readonly ok: false; readonly error: string } {
  try {
    const fields = parseExplosionPresetPayload(payload)
    return { ok: true, payload: captureExplosionPreset({ ...fields } as ExplosionParameters) }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

/** Read-only built-in Explosion presets; names are translated through i18n. */
export const EXPLOSION_BUILTIN_PRESETS: readonly GeneratorPreset[] = [
  {
    id: 'modernBurst',
    name: 'Modern Burst',
    description: 'The modern flame body with segmented arcs and energy rays.',
    payload: {
      palette: [
        { r: 255, g: 255, b: 255 },
        { r: 255, g: 196, b: 58 },
        { r: 255, g: 102, b: 84 },
        { r: 86, g: 44, b: 122 },
      ],
      mode: 'explosion',
      bodyStyle: 'cleanClusters',
      shockwaveStyle: 'segmentedArc',
      trailMode: 'energyRays',
      radius: 42,
      bodyStrength: 0.9,
      irregularity: 0.26,
      coreRadius: 16,
      shockwaveWidth: 3,
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
    },
  },
  {
    id: 'modernImplosion',
    name: 'Modern Implosion',
    description: 'The same modern language collapsing inward with longer flame strands.',
    payload: {
      palette: [
        { r: 255, g: 255, b: 255 },
        { r: 255, g: 196, b: 58 },
        { r: 255, g: 102, b: 84 },
        { r: 86, g: 44, b: 122 },
      ],
      mode: 'implosion',
      bodyStyle: 'cleanClusters',
      shockwaveStyle: 'segmentedArc',
      trailMode: 'flameStrands',
      radius: 42,
      bodyStrength: 0.88,
      irregularity: 0.3,
      coreRadius: 18,
      shockwaveWidth: 3,
      expansionSpeed: 0.62,
      coreDuration: 0.3,
      shockwaveSpeed: 0.78,
      dissolveStart: 0.42,
      fragmentAmount: 0.5,
      fragmentMinSize: 1,
      fragmentMaxSize: 3,
      fragmentRadialSpeed: 30,
      fragmentTangentialJitter: 8,
      fragmentLifetime: 0.8,
      trailAmount: 0.55,
      trailLength: 54,
      trailWidth: 4,
      trailLengthRandomness: 0.45,
      seed: 20260101,
    },
  },
  {
    id: 'retroBurst',
    name: 'Retro Burst',
    description: 'The original warm ring with dense pixel noise and square debris.',
    payload: {
      palette: [
        { r: 255, g: 250, b: 224 },
        { r: 255, g: 201, b: 72 },
        { r: 242, g: 95, b: 44 },
        { r: 105, g: 42, b: 52 },
      ],
      mode: 'explosion',
      bodyStyle: 'pixelNoise',
      shockwaveStyle: 'fullRing',
      trailMode: 'energyRays',
      radius: 42,
      bodyStrength: 0.9,
      irregularity: 0.28,
      coreRadius: 16,
      shockwaveWidth: 3,
      expansionSpeed: 0.62,
      coreDuration: 0.42,
      shockwaveSpeed: 0.72,
      dissolveStart: 0.58,
      fragmentAmount: 0.42,
      fragmentMinSize: 1,
      fragmentMaxSize: 3,
      fragmentRadialSpeed: 30,
      fragmentTangentialJitter: 9,
      fragmentLifetime: 0.68,
      trailAmount: 0,
      trailLength: 0,
      trailWidth: 1,
      trailLengthRandomness: 0,
      seed: 20260805,
    },
  },
]

/** Explosion experimental preset capability registered on the generator module. */
export const explosionPresetCapability: GeneratorPresetCapability<ExplosionParameters> = {
  builtIns: EXPLOSION_BUILTIN_PRESETS,
  capture: captureExplosionPreset,
  apply: applyExplosionPreset,
  validate: validateExplosionPreset,
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
    }
  })
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

export type { ExplosionBodyStyle, ExplosionShockwaveStyle, ExplosionTrailMode }
