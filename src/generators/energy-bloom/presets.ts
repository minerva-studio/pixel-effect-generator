import { isPlainRecord } from '../../shared/project/document'
import type { JsonValue } from '../../shared/project/types'
import type { GeneratorPreset, GeneratorPresetCapability } from '../contract'
import {
  assertValidBloomParameters,
  bloomFrameLimits,
  bloomShapeCount,
  clampInteger,
  createBloomSurface,
  DEFAULT_BLOOM_PARAMETERS,
  type BloomParameters,
  type BloomSurfaceParameters,
} from './model'

/** Preset fields cover the effect while excluding canvas size and frame count. */
export type BloomPresetFields = Omit<BloomParameters, 'canvasWidth' | 'canvasHeight' | 'frameCount'>

export const BLOOM_PRESET_SCHEMA_VERSION = 4
export const BLOOM_PRESET_FAMILY = 'energyBloom'

const MAX_PRESET_RADIUS = 256
const MAX_PRESET_FRAGMENT_DISTANCE = 128
const MAX_PRESET_TANGENTIAL_DRIFT = 64
const MAX_PRESET_TONGUE_LENGTH = 256
const MAX_PRESET_TONGUE_WIDTH = 64

/** Captures a versioned V4 payload with stable nested ownership. */
export function captureBloomPreset(parameters: BloomParameters): JsonValue {
  return {
    schemaVersion: BLOOM_PRESET_SCHEMA_VERSION,
    family: BLOOM_PRESET_FAMILY,
    palette: parameters.palette.map(({ r, g, b }) => ({ r, g, b })),
    mode: parameters.motion.mode,
    seed: parameters.seed,
    body: { ...parameters.body },
    surface: { ...parameters.surface },
    motion: { ...parameters.motion },
    core: { ...parameters.core },
    shockwave: { ...parameters.shockwave },
    tongues: { ...parameters.tongues },
    fragments: { ...parameters.fragments },
  } as JsonValue
}

/** Parses one V4 payload into typed effect fields with strict bounds. */
export function parseBloomPresetPayload(value: unknown): BloomPresetFields {
  if (!isPlainRecord(value)) throw new RangeError('preset payload must be an object.')
  if (value.schemaVersion !== BLOOM_PRESET_SCHEMA_VERSION || value.family !== BLOOM_PRESET_FAMILY) {
    throw new RangeError('preset payload is not the current energy bloom schema.')
  }
  const body = readRecord(value, 'body')
  const surface = readRecord(value, 'surface')
  const motion = readRecord(value, 'motion')
  const core = readRecord(value, 'core')
  const shockwave = readRecord(value, 'shockwave')
  const tongues = readRecord(value, 'tongues')
  const fragments = readRecord(value, 'fragments')
  return {
    palette: readPalette(value.palette),
    seed: readInteger(value, 'seed', 0, 0xffffffff),
    body: {
      shape: readEnum(body, 'shape', ['softPetals', 'sharpStarburst', 'layeredCorolla']),
      radius: readInteger(body, 'radius', 2, MAX_PRESET_RADIUS),
      rotation: readInteger(body, 'rotation', 0, 359),
      shapeIrregularity: readNumber(body, 'shapeIrregularity', 0, 1),
      petalCount: readInteger(body, 'petalCount', 5, 9),
      petalStretch: readNumber(body, 'petalStretch', 0, 1),
      rayCount: readInteger(body, 'rayCount', 6, 16),
      rayTaper: readNumber(body, 'rayTaper', 0, 1),
      corollaLayers: readInteger(body, 'corollaLayers', 2, 3),
      layerDelay: readNumber(body, 'layerDelay', 0, 0.4),
    },
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
      count: readInteger(tongues, 'count', 1, 16),
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
function parseV4Surface(value: Readonly<Record<string, unknown>>): BloomSurfaceParameters {
  const style = readEnum(value, 'style', ['celBands', 'moltenCavities', 'crystalShards', 'gridNoise', 'pixelNoise'])
  const coverage = readNumber(value, 'coverage', 0, 1)
  switch (style) {
    case 'celBands':
      return { style, coverage, bandWarp: readNumber(value, 'bandWarp', 0, 1), edgeBreakup: readNumber(value, 'edgeBreakup', 0, 1) }
    case 'moltenCavities':
      return { style, coverage, cavityAmount: readNumber(value, 'cavityAmount', 0, 0.65), cavityScale: readInteger(value, 'cavityScale', 6, 24) }
    case 'crystalShards':
      return { style, coverage, chunkSize: readInteger(value, 'chunkSize', 4, 16), crackWidth: readInteger(value, 'crackWidth', 1, 2) }
    case 'gridNoise':
      return { style, coverage }
    case 'pixelNoise':
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

/** Applies a preset while preserving active canvas dimensions and frame count. */
export function applyBloomPreset(parameters: BloomParameters, payload: JsonValue): BloomParameters {
  const fields = parseBloomPresetPayload(payload)
  return clampBloomPresetParameters({
    ...fields,
    canvasWidth: parameters.canvasWidth,
    canvasHeight: parameters.canvasHeight,
    frameCount: parameters.frameCount,
  })
}

/** Clamps preset values to the active canvas and validates the result. */
export function clampBloomPresetParameters(parameters: BloomParameters): BloomParameters {
  const limits = bloomFrameLimits({ width: parameters.canvasWidth, height: parameters.canvasHeight })
  const shapeCount = bloomShapeCount(parameters.body)
  const minSize = clampInteger(parameters.fragments.minSize, 1, 8)
  const maxSize = clampInteger(parameters.fragments.maxSize, 1, 8)
  const formationDuration = Math.min(0.8, Math.max(0.1, parameters.motion.formationDuration))
  const holdDuration = Math.min(0.5, Math.max(0, parameters.motion.holdDuration), Math.max(0, parameters.motion.dissolveStart - formationDuration))
  const surface = parameters.surface.style === 'moltenCavities'
    ? { ...parameters.surface, cavityScale: clampInteger(parameters.surface.cavityScale, 6, 24) }
    : parameters.surface.style === 'crystalShards'
      ? {
          ...parameters.surface,
          chunkSize: clampInteger(parameters.surface.chunkSize, 4, 16),
          crackWidth: clampInteger(parameters.surface.crackWidth, 1, 2),
        }
      : parameters.surface
  const clamped: BloomParameters = {
    ...parameters,
    body: { ...parameters.body, radius: clampInteger(parameters.body.radius, 2, limits.maxRadius) },
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
  assertValidBloomParameters(clamped)
  return clamped
}

/** Validates and canonicalizes one built-in or custom preset payload. */
export function validateBloomPreset(
  payload: unknown,
): { readonly ok: true; readonly payload: JsonValue } | { readonly ok: false; readonly error: string } {
  try {
    const fields = parseBloomPresetPayload(payload)
    const parameters = clampBloomPresetParameters({
      ...fields,
      canvasWidth: 128,
      canvasHeight: 128,
      frameCount: 10,
    })
    return { ok: true, payload: captureBloomPreset(parameters) }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

/** Read-only built-ins for the energy bloom family. */
export const BLOOM_BUILTIN_PRESETS: readonly GeneratorPreset[] = [
  {
    id: 'softPetals',
    name: 'Soft Petals',
    description: 'Rounded cartoon petals with cel bands; tongues are off by default.',
    payload: captureBloomPreset(DEFAULT_BLOOM_PARAMETERS),
  },
  {
    id: 'sharpStarburst',
    name: 'Sharp Starburst',
    description: 'Controlled tapered star rays with a crystalline surface.',
    payload: captureBloomPreset({
      ...DEFAULT_BLOOM_PARAMETERS,
      seed: 20260303,
      body: {
        ...DEFAULT_BLOOM_PARAMETERS.body,
        shape: 'sharpStarburst',
        rayCount: 12,
        rayTaper: 0.75,
        shapeIrregularity: 0.12,
      },
      surface: { style: 'crystalShards', coverage: 0.95, chunkSize: 10, crackWidth: 1 },
      tongues: { ...DEFAULT_BLOOM_PARAMETERS.tongues, enabled: true, count: 6, length: 26, width: 2, curvature: 0.15 },
    }),
  },
  {
    id: 'layeredCorolla',
    name: 'Layered Corolla',
    description: 'Two staggered petal layers that open in sequence.',
    payload: captureBloomPreset({
      ...DEFAULT_BLOOM_PARAMETERS,
      seed: 20260404,
      body: {
        ...DEFAULT_BLOOM_PARAMETERS.body,
        shape: 'layeredCorolla',
        corollaLayers: 2,
        layerDelay: 0.2,
        petalCount: 8,
      },
      surface: { style: 'moltenCavities', coverage: 0.94, cavityAmount: 0.22, cavityScale: 12 },
      tongues: { ...DEFAULT_BLOOM_PARAMETERS.tongues, enabled: true, count: 8, length: 18, width: 2 },
    }),
  },
  {
    id: 'softPetalsImplosion',
    name: 'Soft Petals Implosion',
    description: 'Rounded petals collapse inward onto a closing flash.',
    payload: captureBloomPreset({
      ...DEFAULT_BLOOM_PARAMETERS,
      seed: 20260101,
      motion: { ...DEFAULT_BLOOM_PARAMETERS.motion, mode: 'implosion', formationDuration: 0.4, holdDuration: 0.08 },
    }),
  },
  {
    id: 'starburstImplosion',
    name: 'Starburst Implosion',
    description: 'Sharp star rays converge into the center from the rim.',
    payload: captureBloomPreset({
      ...DEFAULT_BLOOM_PARAMETERS,
      seed: 20260505,
      body: { ...DEFAULT_BLOOM_PARAMETERS.body, shape: 'sharpStarburst', rayCount: 12, rayTaper: 0.8 },
      surface: { style: 'pixelNoise', coverage: 0.92, dissolveStyle: 'pixelNoise', dissolveSize: 6, dissolveJitter: 0.5, dissolveDensity: 0, dissolveSpeed: 1 },
      motion: { ...DEFAULT_BLOOM_PARAMETERS.motion, mode: 'implosion', formationDuration: 0.36, holdDuration: 0.06, motionCurve: 'crisp' },
      tongues: { ...DEFAULT_BLOOM_PARAMETERS.tongues, enabled: true, count: 6, length: 30, width: 2 },
    }),
  },
  {
    id: 'corollaImplosion',
    name: 'Corolla Implosion',
    description: 'Staggered corolla layers close inward, outer layer first.',
    payload: captureBloomPreset({
      ...DEFAULT_BLOOM_PARAMETERS,
      seed: 20260707,
      body: {
        ...DEFAULT_BLOOM_PARAMETERS.body,
        shape: 'layeredCorolla',
        corollaLayers: 3,
        layerDelay: 0.16,
        petalCount: 8,
      },
      surface: { style: 'gridNoise', coverage: 0.9 },
      motion: { ...DEFAULT_BLOOM_PARAMETERS.motion, mode: 'implosion', formationDuration: 0.44, holdDuration: 0.1, motionCurve: 'drifting' },
      tongues: { ...DEFAULT_BLOOM_PARAMETERS.tongues, enabled: true, count: 8, length: 22, width: 2 },
    }),
  },
]

/** Energy bloom preset capability registered on the generator module. */
export const bloomPresetCapability: GeneratorPresetCapability<BloomParameters> = {
  builtIns: BLOOM_BUILTIN_PRESETS,
  capture: captureBloomPreset,
  apply: applyBloomPreset,
  validate: validateBloomPreset,
}

/** Reads a required nested object. */
function readRecord(record: Readonly<Record<string, unknown>>, key: string): Readonly<Record<string, unknown>> {
  const value = record[key]
  if (!isPlainRecord(value)) throw new RangeError(`${key} must be an object.`)
  return value
}

/** Reads a two-to-six-color palette. */
function readPalette(value: unknown): { readonly r: number; readonly g: number; readonly b: number }[] {
  if (!Array.isArray(value) || value.length < 2 || value.length > 6) throw new RangeError('palette must be an array of 2 to 6 colors.')
  return value.map((entry, index) => {
    if (!isPlainRecord(entry)) throw new RangeError(`palette[${index}] must be an object.`)
    return { r: readInteger(entry, 'r', 0, 255), g: readInteger(entry, 'g', 0, 255), b: readInteger(entry, 'b', 0, 255) }
  })
}

/** Reads one bounded integer field. */
function readInteger(record: Readonly<Record<string, unknown>>, key: string, minimum: number, maximum: number): number {
  const value = record[key]
  if (typeof value !== 'number' || !Number.isInteger(value) || value < minimum || value > maximum) throw new RangeError(`${key} must be an integer between ${minimum} and ${maximum}.`)
  return value
}

/** Reads one bounded finite numeric field. */
function readNumber(record: Readonly<Record<string, unknown>>, key: string, minimum: number, maximum: number): number {
  const value = record[key]
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum) throw new RangeError(`${key} must be a number between ${minimum} and ${maximum}.`)
  return value
}

/** Reads one required boolean field. */
function readBoolean(record: Readonly<Record<string, unknown>>, key: string): boolean {
  const value = record[key]
  if (typeof value !== 'boolean') throw new RangeError(`${key} must be a boolean.`)
  return value
}

/** Reads one string enum field. */
function readEnum<Value extends string>(record: Readonly<Record<string, unknown>>, key: string, allowed: readonly Value[]): Value {
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

export type { BloomSurfaceParameters }
export { createBloomSurface }
