import { isPlainRecord } from '../../shared/project/document'
import type { JsonValue } from '../../shared/project/types'
import type { RgbColor } from '../../shared/pixel/color'
import type { GeneratorPreset, GeneratorPresetCapability } from '../contract'
import {
  assertValidExplosionParameters,
  clampInteger,
  createExplosionSurface,
  DEFAULT_EXPLOSION_PARAMETERS,
  MODERN_EXPLOSION_PARAMETERS,
  SMOKE_EXPLOSION_PALETTE,
  explosionFrameLimits,
  explosionShapeCount,
  normalizeExplosionVolume,
  type ExplosionParameters,
  type ExplosionSurfaceParameters,
} from './model'

/** Preset fields cover the effect while excluding canvas size and frame count. */
export type ExplosionPresetFields = Omit<ExplosionParameters, 'canvasWidth' | 'canvasHeight' | 'frameCount'>

export const EXPLOSION_PRESET_SCHEMA_VERSION = 5
export const EXPLOSION_PRESET_FAMILY = 'explosion'

const MAX_PRESET_RADIUS = 256
const MAX_PRESET_FRAGMENT_DISTANCE = 128
const MAX_PRESET_TANGENTIAL_DRIFT = 64
const MAX_PRESET_TONGUE_LENGTH = 256
const MAX_PRESET_TONGUE_WIDTH = 64

/** Captures a versioned V5 payload with stable nested ownership. */
export function captureExplosionPreset(parameters: ExplosionParameters): JsonValue {
  return {
    schemaVersion: EXPLOSION_PRESET_SCHEMA_VERSION,
    family: EXPLOSION_PRESET_FAMILY,
    palette: parameters.palette.map(({ r, g, b, a }) => ({ r, g, b, a })),
    mode: parameters.motion.mode,
    seed: parameters.seed,
    body: { ...parameters.body },
    volume: { ...parameters.volume },
    surface: { ...parameters.surface },
    motion: { ...parameters.motion },
    core: { ...parameters.core },
    shockwave: { ...parameters.shockwave },
    tongues: { ...parameters.tongues },
    fragments: { ...parameters.fragments },
  } as JsonValue
}

/** Parses one V5 or compatible V4 payload into typed effect fields with strict bounds. */
export function parseExplosionPresetPayload(value: unknown): ExplosionPresetFields {
  if (!isPlainRecord(value)) throw new RangeError('preset payload must be an object.')
  if ((value.schemaVersion !== EXPLOSION_PRESET_SCHEMA_VERSION && value.schemaVersion !== 4) || value.family !== EXPLOSION_PRESET_FAMILY) {
    throw new RangeError('preset payload is not the current explosion schema.')
  }
  const body = readRecord(value, 'body')
  const volumeRecord = value.volume === undefined ? undefined : readRecord(value, 'volume')
  const surface = readRecord(value, 'surface')
  const motion = readRecord(value, 'motion')
  const core = readRecord(value, 'core')
  const shockwave = readRecord(value, 'shockwave')
  const tongues = readRecord(value, 'tongues')
  const fragments = readRecord(value, 'fragments')
  const shape = readExplosionShape(body, value.schemaVersion)
  const volume = normalizeExplosionVolume(shape, {
    enabled: volumeRecord ? readBoolean(volumeRecord, 'enabled') : false,
    profile: volumeRecord ? readEnum(volumeRecord, 'profile', ['hardShell', 'moltenCore', 'smokeFire']) : 'hardShell',
  })
  return {
    palette: readPalette(value.palette),
    seed: readInteger(value, 'seed', 0, 0xffffffff),
    body: {
      shape,
      radius: readInteger(body, 'radius', 2, MAX_PRESET_RADIUS),
      rotation: readInteger(body, 'rotation', 0, 359),
      shapeIrregularity: readNumber(body, 'shapeIrregularity', 0, 1),
      churnAmount: readNumber(body, 'churnAmount', 0, 1),
      lobeCount: readOptionalInteger(body, 'lobeCount', 3, 9, 5),
      pressureWidth: readInteger(body, 'pressureWidth', 1, 24),
      pressureSharpness: readNumber(body, 'pressureSharpness', 0, 1),
      blastWidth: readOptionalNumber(body, 'blastWidth', 0.2, 1, 0.58),
      blastAngle: readOptionalInteger(body, 'blastAngle', 0, 359, 0),
      smokeSpread: readOptionalNumber(body, 'smokeSpread', 0.2, 1.4, 0.72),
      smokeRise: readOptionalNumber(body, 'smokeRise', -0.6, 0.6, 0.18),
      smokeCount: readOptionalInteger(body, 'smokeCount', 3, 9, 5),
      smokeMotion: readOptionalEnum(body, 'smokeMotion', ['billowing', 'particulate'], 'billowing'),
    },
    volume,
    surface: parseV4Surface(surface),
    motion: {
      mode: readEnum(motion, 'mode', ['explosion', 'implosion']),
      formationDuration: readNumber(motion, 'formationDuration', 0.1, 0.8),
      holdDuration: readNumber(motion, 'holdDuration', 0, 0.5),
      motionCurve: readEnum(motion, 'motionCurve', ['crisp', 'balanced', 'drifting']),
      dissolveStart: readNumber(motion, 'dissolveStart', 0.1, 0.9),
    },
    core: {
      enabled: readBoolean(core, 'enabled'),
      radius: readInteger(core, 'radius', 0, MAX_PRESET_RADIUS),
      duration: readNumber(core, 'duration', 0.1, 0.9),
    },
    shockwave: {
      mode: readShockwaveMode(shockwave, 'mode'),
      colorMode: readOptionalEnum(shockwave, 'colorMode', ['flat', 'gradient'], 'flat'),
      thickness: readInteger(shockwave, 'thickness', 1, 6),
      startRadiusScale: readNumber(shockwave, 'startRadiusScale', 0, 2),
      endRadiusScale: readNumber(shockwave, 'endRadiusScale', 0.25, 2.5),
      startTime: readNumber(shockwave, 'startTime', 0, 0.8),
      duration: readNumber(shockwave, 'duration', 0.1, 1),
      ringCount: readOptionalInteger(shockwave, 'ringCount', 1, 4, 3),
      ringSpacing: readOptionalNumber(shockwave, 'ringSpacing', 0, 1, 0.55),
      squash: readOptionalNumber(shockwave, 'squash', 0, 1, 0),
      squashAngle: readOptionalInteger(shockwave, 'squashAngle', 0, 359, 0),
    },
    tongues: {
      enabled: readBoolean(tongues, 'enabled'),
      count: readInteger(tongues, 'count', 1, 9),
      length: readInteger(tongues, 'length', 0, MAX_PRESET_TONGUE_LENGTH),
      width: readInteger(tongues, 'width', 1, MAX_PRESET_TONGUE_WIDTH),
      curvature: readNumber(tongues, 'curvature', 0, 1),
      variation: readNumber(tongues, 'variation', 0, 1),
    },
    fragments: {
      enabled: readBoolean(fragments, 'enabled'),
      count: readInteger(fragments, 'count', 1, 72),
      minSize: readInteger(fragments, 'minSize', 1, 8),
      maxSize: readInteger(fragments, 'maxSize', 1, 8),
      travelDistance: readInteger(fragments, 'travelDistance', 0, MAX_PRESET_FRAGMENT_DISTANCE),
      tangentialDrift: readInteger(fragments, 'tangentialDrift', 0, MAX_PRESET_TANGENTIAL_DRIFT),
      lifetime: readNumber(fragments, 'lifetime', 0.1, 1),
    },
  }
}

/** Parses one V4 discriminated surface object. */
function parseV4Surface(value: Readonly<Record<string, unknown>>): ExplosionSurfaceParameters {
  const style = readEnum(value, 'style', ['burningLayers', 'rollingSoot', 'retroPixel'])
  const coverage = readNumber(value, 'coverage', 0, 1)
  switch (style) {
    case 'burningLayers':
      return { style, coverage, bandWarp: readNumber(value, 'bandWarp', 0, 1), edgeBreakup: readNumber(value, 'edgeBreakup', 0, 1) }
    case 'rollingSoot':
      return { style, coverage, sootAmount: readNumber(value, 'sootAmount', 0, 0.65), sootScale: readInteger(value, 'sootScale', 6, 24) }
    case 'retroPixel':
      return {
        style,
        coverage,
        dissolveStyle: readOptionalEnum(value, 'dissolveStyle', ['pixelNoise', 'scanSweep', 'blockFade', 'circleFade', 'edgeRoll'], 'pixelNoise'),
        dissolveSize: readOptionalInteger(value, 'dissolveSize', 3, 8, 6),
        dissolveJitter: readOptionalNumber(value, 'dissolveJitter', 0, 1, 0.5),
        dissolveDensity: readOptionalNumber(value, 'dissolveDensity', 0, 1, 0),
        dissolveSpeed: readOptionalNumber(value, 'dissolveSpeed', 0.5, 1.5, 1),
      }
  }
}

/** Migrates the previous combustion shape names into the replacement geometry. */
function readExplosionShape(body: Readonly<Record<string, unknown>>, version: unknown): ExplosionParameters['body']['shape'] {
  const value = body.shape
  if (version === 4) {
    if (value === 'billowingFireball') return 'gameFireball'
    if (value === 'pressureBurst') return 'gameFireball'
  }
  if (value === 'turbulentFireball') return 'smokeBurst'
  if (value === 'shockBlast') return 'gameFireball'
  if (typeof value !== 'string' || !['gameFireball', 'directionalBlast', 'smokeBurst', 'legacyRadial'].includes(value)) {
    throw new RangeError('body.shape is invalid.')
  }
  return value as ExplosionParameters['body']['shape']
}

/** Applies a preset while preserving active canvas dimensions and frame count. */
export function applyExplosionPreset(parameters: ExplosionParameters, payload: JsonValue): ExplosionParameters {
  const fields = parseExplosionPresetPayload(payload)
  return clampExplosionPresetParameters({
    ...fields,
    canvasWidth: parameters.canvasWidth,
    canvasHeight: parameters.canvasHeight,
    frameCount: parameters.frameCount,
  })
}

/** Clamps preset values to the active canvas and validates the result. */
export function clampExplosionPresetParameters(parameters: ExplosionParameters): ExplosionParameters {
  const limits = explosionFrameLimits({ width: parameters.canvasWidth, height: parameters.canvasHeight })
  const lobeCount = clampInteger(parameters.body.lobeCount, 3, 9)
  const smokeCount = clampInteger(parameters.body.smokeCount, 3, 9)
  const shapeCount = explosionShapeCount(parameters.body.shape, lobeCount)
  const minSize = clampInteger(parameters.fragments.minSize, 1, 8)
  const maxSize = clampInteger(parameters.fragments.maxSize, 1, 8)
  const formationDuration = Math.min(0.8, Math.max(0.1, parameters.motion.formationDuration))
  const holdDuration = Math.min(0.5, Math.max(0, parameters.motion.holdDuration), Math.max(0, parameters.motion.dissolveStart - formationDuration))
  const surface = parameters.surface.style === 'rollingSoot'
    ? { ...parameters.surface, sootScale: clampInteger(parameters.surface.sootScale, 6, 24) }
    : parameters.surface
  const clamped: ExplosionParameters = {
    ...parameters,
    volume: normalizeExplosionVolume(parameters.body.shape, parameters.volume),
    body: {
      ...parameters.body,
      radius: clampInteger(parameters.body.radius, 2, limits.maxRadius),
      lobeCount,
      smokeCount,
      pressureWidth: clampInteger(parameters.body.pressureWidth, 1, 24),
    },
    surface,
    motion: { ...parameters.motion, formationDuration, holdDuration },
    core: { ...parameters.core, radius: clampInteger(parameters.core.radius, 0, limits.maxRadius) },
    shockwave: {
      ...parameters.shockwave,
      thickness: clampInteger(parameters.shockwave.thickness, 1, 6),
      ringCount: clampInteger(parameters.shockwave.ringCount, 1, 4),
      ringSpacing: Math.min(1, Math.max(0, parameters.shockwave.ringSpacing)),
      squash: Math.min(1, Math.max(0, parameters.shockwave.squash)),
      squashAngle: clampInteger(parameters.shockwave.squashAngle, 0, 359),
    },
    tongues: {
      ...parameters.tongues,
      count: clampInteger(parameters.tongues.count, 1, shapeCount),
      length: clampInteger(parameters.tongues.length, 0, limits.maxTongueLength),
      width: clampInteger(parameters.tongues.width, 1, limits.maxTongueWidth),
    },
    fragments: {
      ...parameters.fragments,
      count: clampInteger(parameters.fragments.count, 1, 72),
      minSize: Math.min(minSize, maxSize),
      maxSize: Math.max(minSize, maxSize),
      travelDistance: clampInteger(parameters.fragments.travelDistance, 0, limits.maxFragmentDistance),
      tangentialDrift: clampInteger(parameters.fragments.tangentialDrift, 0, limits.maxTangentialDrift),
    },
  }
  assertValidExplosionParameters(clamped)
  return clamped
}

/** Validates and canonicalizes one built-in or custom preset payload. */
export function validateExplosionPreset(
  payload: unknown,
): { readonly ok: true; readonly payload: JsonValue } | { readonly ok: false; readonly error: string } {
  try {
    const fields = parseExplosionPresetPayload(payload)
    const parameters = clampExplosionPresetParameters({
      ...fields,
      canvasWidth: 128,
      canvasHeight: 128,
      frameCount: 10,
    })
    return { ok: true, payload: captureExplosionPreset(parameters) }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

/** Read-only built-ins for the combustion explosion family. */
export const EXPLOSION_BUILTIN_PRESETS: readonly GeneratorPreset[] = [
  {
    id: 'rollingFireball',
    name: 'Game Fireball',
    description: 'A connected, irregular combustion volume with a clean readable silhouette.',
    payload: captureExplosionPreset(MODERN_EXPLOSION_PARAMETERS),
  },
  {
    id: 'moltenCoreFireball',
    name: 'Molten Core Fireball',
    description: 'A dark shell with a persistent exposed molten core.',
    payload: captureExplosionPreset({
      ...MODERN_EXPLOSION_PARAMETERS,
      seed: 20260809,
      volume: { enabled: true, profile: 'moltenCore' },
      core: { ...MODERN_EXPLOSION_PARAMETERS.core, radius: 18, duration: 0.82 },
    }),
  },
  {
    id: 'smokeBurst',
    name: 'Smoke Burst',
    description: 'Independently curling charcoal smoke above a fading ember bed.',
    payload: captureExplosionPreset({
      ...MODERN_EXPLOSION_PARAMETERS,
      seed: 20260808,
      palette: SMOKE_EXPLOSION_PALETTE,
      body: { ...MODERN_EXPLOSION_PARAMETERS.body, shape: 'smokeBurst', smokeSpread: 1.2, smokeRise: 0.18, smokeCount: 5, smokeMotion: 'billowing' },
      volume: { enabled: true, profile: 'smokeFire' },
      surface: { style: 'rollingSoot', coverage: 0.94, sootAmount: 0.38, sootScale: 15 },
      core: { ...MODERN_EXPLOSION_PARAMETERS.core, enabled: false, radius: 9, duration: 0.12 },
      fragments: { ...MODERN_EXPLOSION_PARAMETERS.fragments, count: 8, travelDistance: 16 },
    }),
  },
  {
    id: 'particleSmokeBurst',
    name: 'Particle Smoke Burst',
    description: 'A connected smoke burst that breaks into independently drifting pixel chunks.',
    payload: captureExplosionPreset({
      ...MODERN_EXPLOSION_PARAMETERS,
      seed: 20260810,
      palette: SMOKE_EXPLOSION_PALETTE,
      body: { ...MODERN_EXPLOSION_PARAMETERS.body, shape: 'smokeBurst', smokeSpread: 1.16, smokeRise: 0.16, smokeCount: 5, smokeMotion: 'particulate' },
      volume: { enabled: true, profile: 'smokeFire' },
      surface: { style: 'rollingSoot', coverage: 0.94, sootAmount: 0.38, sootScale: 15 },
      core: { ...MODERN_EXPLOSION_PARAMETERS.core, enabled: false, radius: 9, duration: 0.12 },
      fragments: { ...MODERN_EXPLOSION_PARAMETERS.fragments, enabled: false },
    }),
  },
  {
    id: 'directionalBlast',
    name: 'Directional Blast',
    description: 'A short broad blast projected along one readable direction.',
    payload: captureExplosionPreset({
      ...MODERN_EXPLOSION_PARAMETERS,
      seed: 20260807,
      body: { ...MODERN_EXPLOSION_PARAMETERS.body, shape: 'directionalBlast', blastWidth: 0.62, blastAngle: 0 },
      volume: { enabled: true, profile: 'hardShell' },
      core: { ...MODERN_EXPLOSION_PARAMETERS.core, radius: 11, duration: 0.14 },
      fragments: { ...MODERN_EXPLOSION_PARAMETERS.fragments, enabled: false },
    }),
  },
  {
    id: 'retroBurst',
    name: 'Retro Burst',
    description: 'The original radial ring with dense per-pixel noise.',
    payload: captureExplosionPreset({
      ...DEFAULT_EXPLOSION_PARAMETERS,
      palette: [
        { r: 255, g: 250, b: 224, a: 255 },
        { r: 255, g: 201, b: 72, a: 255 },
        { r: 242, g: 95, b: 44, a: 255 },
        { r: 105, g: 42, b: 52, a: 255 },
      ],
      seed: 20260805,
      body: {
        shape: 'legacyRadial',
        radius: 42,
        rotation: 0,
        shapeIrregularity: 0.28,
        churnAmount: 0.5,
        lobeCount: 5,
        pressureWidth: 6,
        pressureSharpness: 0.8,
        blastWidth: 0.58,
        blastAngle: 0,
        smokeSpread: 0.72,
        smokeRise: 0.18,
        smokeCount: 5,
        smokeMotion: 'billowing',
      },
      volume: { enabled: false, profile: 'hardShell' },
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
    }),
  },
]

/** Combustion explosion preset capability registered on the generator module. */
export const explosionPresetCapability: GeneratorPresetCapability<ExplosionParameters> = {
  builtIns: EXPLOSION_BUILTIN_PRESETS,
  capture: captureExplosionPreset,
  apply: applyExplosionPreset,
  validate: validateExplosionPreset,
}

/** Reads a required nested object. */
function readRecord(record: Readonly<Record<string, unknown>>, key: string): Readonly<Record<string, unknown>> {
  const value = record[key]
  if (!isPlainRecord(value)) throw new RangeError(`${key} must be an object.`)
  return value
}

/** Reads a two-to-six-color palette. */
export function readPalette(value: unknown): RgbColor[] {
  if (!Array.isArray(value) || value.length < 2 || value.length > 6) throw new RangeError('palette must be an array of 2 to 6 colors.')
  return value.map((entry, index) => {
    if (!isPlainRecord(entry)) throw new RangeError(`palette[${index}] must be an object.`)
    return {
      r: readInteger(entry, 'r', 0, 255),
      g: readInteger(entry, 'g', 0, 255),
      b: readInteger(entry, 'b', 0, 255),
      a: readOptionalInteger(entry, 'a', 0, 255, 255),
    }
  })
}

/** Reads one bounded integer field. */
export function readInteger(record: Readonly<Record<string, unknown>>, key: string, minimum: number, maximum: number): number {
  const value = record[key]
  if (typeof value !== 'number' || !Number.isInteger(value) || value < minimum || value > maximum) throw new RangeError(`${key} must be an integer between ${minimum} and ${maximum}.`)
  return value
}

/** Reads one bounded finite numeric field. */
export function readNumber(record: Readonly<Record<string, unknown>>, key: string, minimum: number, maximum: number): number {
  const value = record[key]
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum) throw new RangeError(`${key} must be a number between ${minimum} and ${maximum}.`)
  return value
}

/** Reads one required boolean field. */
export function readBoolean(record: Readonly<Record<string, unknown>>, key: string): boolean {
  const value = record[key]
  if (typeof value !== 'boolean') throw new RangeError(`${key} must be a boolean.`)
  return value
}

/** Reads one string enum field. */
export function readEnum<Value extends string>(record: Readonly<Record<string, unknown>>, key: string, allowed: readonly Value[]): Value {
  const value = record[key]
  if (typeof value !== 'string' || !allowed.includes(value as Value)) throw new RangeError(`${key} is invalid.`)
  return value as Value
}

/** Reads the shockwave mode, normalizing legacy lobe arcs to multi-ring. */
function readShockwaveMode(record: Readonly<Record<string, unknown>>, key: string): 'none' | 'ring' | 'multiRing' {
  const value = record[key]
  if (typeof value !== 'string') throw new RangeError(`${key} is invalid.`)
  if (value === 'lobeArcs') return 'multiRing'
  if (value === 'none' || value === 'ring' || value === 'multiRing') return value
  throw new RangeError(`${key} is invalid.`)
}

/** Reads one optional enum field with a fallback default. */
function readOptionalEnum<Value extends string>(
  record: Readonly<Record<string, unknown>>,
  key: string,
  allowed: readonly Value[],
  fallback: Value,
): Value {
  const value = record[key]
  if (value === undefined) return fallback
  if (typeof value !== 'string' || !allowed.includes(value as Value)) throw new RangeError(`${key} is invalid.`)
  return value as Value
}

/** Reads one optional bounded integer field with a fallback default. */
function readOptionalInteger(
  record: Readonly<Record<string, unknown>>,
  key: string,
  minimum: number,
  maximum: number,
  fallback: number,
): number {
  const value = record[key]
  if (value === undefined) return fallback
  if (typeof value !== 'number' || !Number.isInteger(value) || value < minimum || value > maximum) throw new RangeError(`${key} must be an integer between ${minimum} and ${maximum}.`)
  return value
}

/** Reads one optional bounded finite numeric field with a fallback default. */
function readOptionalNumber(
  record: Readonly<Record<string, unknown>>,
  key: string,
  minimum: number,
  maximum: number,
  fallback: number,
): number {
  const value = record[key]
  if (value === undefined) return fallback
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum) throw new RangeError(`${key} must be a number between ${minimum} and ${maximum}.`)
  return value
}

export type { ExplosionSurfaceParameters }
export { createExplosionSurface }
