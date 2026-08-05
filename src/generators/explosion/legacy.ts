import { isPlainRecord } from '../../shared/project/document'
import type { RgbColor } from '../../shared/pixel/color'

/**
 * Frozen parser for the pre-split Explosion preset schemas (V1/V2/V3). These
 * types exist only so custom presets saved before the family split can be
 * classified and migrated; they are never used by live rendering.
 */

export type LegacyShapeMode = 'lobedFireball' | 'legacyRadial'
export type LegacySurfaceStyle = 'celBands' | 'fracturedChunks' | 'moltenCavities' | 'gridNoise' | 'pixelNoise'

interface LegacySurfaceBase {
  readonly coverage: number
  readonly dissolveStart: number
}

export type LegacySurface =
  | (LegacySurfaceBase & { readonly style: 'celBands'; readonly bandWarp: number; readonly edgeBreakup: number })
  | (LegacySurfaceBase & { readonly style: 'fracturedChunks'; readonly chunkSize: number; readonly crackWidth: number })
  | (LegacySurfaceBase & { readonly style: 'moltenCavities'; readonly cavityAmount: number; readonly cavityScale: number })
  | (LegacySurfaceBase & { readonly style: 'gridNoise' })
  | (LegacySurfaceBase & { readonly style: 'pixelNoise' })

export interface LegacyExplosionFields {
  readonly palette: readonly RgbColor[]
  readonly mode: 'explosion' | 'implosion'
  readonly seed: number
  readonly body: {
    readonly shapeMode: LegacyShapeMode
    readonly radius: number
    readonly lobeCount: number
    readonly lobeStretch: number
    readonly rotation: number
    readonly shapeIrregularity: number
    readonly formationDuration: number
  }
  readonly surface: LegacySurface
  readonly core: { readonly enabled: boolean; readonly radius: number; readonly duration: number }
  readonly shockwave: {
    readonly mode: 'none' | 'lobeArcs' | 'ring'
    readonly thickness: number
    readonly startRadiusScale: number
    readonly endRadiusScale: number
    readonly startTime: number
    readonly duration: number
    readonly arcCount: number
    readonly arcSpan: number
  }
  readonly tongues: {
    readonly enabled: boolean
    readonly count: number
    readonly length: number
    readonly width: number
    readonly curvature: number
    readonly variation: number
  }
  readonly fragments: {
    readonly enabled: boolean
    readonly count: number
    readonly minSize: number
    readonly maxSize: number
    readonly travelDistance: number
    readonly tangentialDrift: number
    readonly lifetime: number
  }
}

const V3_SCHEMA_VERSION = 3
const MAX_RADIUS = 256
const MAX_FRAGMENT_DISTANCE = 128
const MAX_TANGENTIAL_DRIFT = 64
const MAX_TONGUE_LENGTH = 256
const MAX_TONGUE_WIDTH = 64

/** Parses V1, V2, or V3 preset payloads into the normalized V3 semantic groups. */
export function parseLegacyExplosionPayload(value: unknown): LegacyExplosionFields {
  if (!isPlainRecord(value)) throw new RangeError('preset payload must be an object.')
  if (value.schemaVersion === V3_SCHEMA_VERSION) return parseV3(value)
  return 'shapeMode' in value ? parseFlat(value, false) : parseFlat(value, true)
}

/** Parses the canonical nested V3 schema. */
function parseV3(value: Readonly<Record<string, unknown>>): LegacyExplosionFields {
  const body = readRecord(value, 'body')
  const surface = readRecord(value, 'surface')
  const core = readRecord(value, 'core')
  const shockwave = readRecord(value, 'shockwave')
  const tongues = readRecord(value, 'tongues')
  const fragments = readRecord(value, 'fragments')
  return {
    palette: readPalette(value.palette),
    mode: readEnum(value, 'mode', ['explosion', 'implosion']),
    seed: readInteger(value, 'seed', 0, 0xffffffff),
    body: {
      shapeMode: readEnum(body, 'shapeMode', ['lobedFireball', 'legacyRadial']),
      radius: readInteger(body, 'radius', 2, MAX_RADIUS),
      lobeCount: readInteger(body, 'lobeCount', 5, 9),
      lobeStretch: readNumber(body, 'lobeStretch', 0, 1),
      rotation: readInteger(body, 'rotation', 0, 359),
      shapeIrregularity: readNumber(body, 'shapeIrregularity', 0, 1),
      formationDuration: readNumber(body, 'formationDuration', 0.1, 0.8),
    },
    surface: parseV3Surface(surface),
    core: {
      enabled: readBoolean(core, 'enabled'),
      radius: readInteger(core, 'radius', 0, MAX_RADIUS),
      duration: readNumber(core, 'duration', 0.1, 0.9),
    },
    shockwave: {
      mode: readEnum(shockwave, 'mode', ['none', 'lobeArcs', 'ring']),
      thickness: readInteger(shockwave, 'thickness', 1, 6),
      startRadiusScale: readNumber(shockwave, 'startRadiusScale', 0, 2),
      endRadiusScale: readNumber(shockwave, 'endRadiusScale', 0.25, 2.5),
      startTime: readNumber(shockwave, 'startTime', 0, 0.8),
      duration: readNumber(shockwave, 'duration', 0.1, 1),
      arcCount: readInteger(shockwave, 'arcCount', 1, 9),
      arcSpan: readInteger(shockwave, 'arcSpan', 10, 120),
    },
    tongues: {
      enabled: readBoolean(tongues, 'enabled'),
      count: readInteger(tongues, 'count', 1, 9),
      length: readInteger(tongues, 'length', 0, MAX_TONGUE_LENGTH),
      width: readInteger(tongues, 'width', 1, MAX_TONGUE_WIDTH),
      curvature: readNumber(tongues, 'curvature', 0, 1),
      variation: readNumber(tongues, 'variation', 0, 1),
    },
    fragments: {
      enabled: readBoolean(fragments, 'enabled'),
      count: readInteger(fragments, 'count', 1, 72),
      minSize: readInteger(fragments, 'minSize', 1, 8),
      maxSize: readInteger(fragments, 'maxSize', 1, 8),
      travelDistance: readInteger(fragments, 'travelDistance', 0, MAX_FRAGMENT_DISTANCE),
      tangentialDrift: readInteger(fragments, 'tangentialDrift', 0, MAX_TANGENTIAL_DRIFT),
      lifetime: readNumber(fragments, 'lifetime', 0.1, 1),
    },
  }
}

/** Parses one V3 discriminated surface object. */
function parseV3Surface(value: Readonly<Record<string, unknown>>): LegacySurface {
  const style = readEnum(value, 'style', ['celBands', 'fracturedChunks', 'moltenCavities', 'gridNoise', 'pixelNoise'])
  const coverage = readNumber(value, 'coverage', 0, 1)
  const dissolveStart = readNumber(value, 'dissolveStart', 0.1, 0.9)
  switch (style) {
    case 'celBands':
      return { style, coverage, dissolveStart, bandWarp: readNumber(value, 'bandWarp', 0, 1), edgeBreakup: readNumber(value, 'edgeBreakup', 0, 1) }
    case 'fracturedChunks':
      return { style, coverage, dissolveStart, chunkSize: readInteger(value, 'chunkSize', 4, 16), crackWidth: readInteger(value, 'crackWidth', 1, 2) }
    case 'moltenCavities':
      return { style, coverage, dissolveStart, cavityAmount: readNumber(value, 'cavityAmount', 0, 0.65), cavityScale: readInteger(value, 'cavityScale', 6, 24) }
    case 'gridNoise':
      return { style, coverage, dissolveStart }
    case 'pixelNoise':
      return { style, coverage, dissolveStart }
  }
}

/** Converts either flat schema (V1/V2) into V3 semantic groups. */
function parseFlat(value: Readonly<Record<string, unknown>>, legacy: boolean): LegacyExplosionFields {
  const bodyStyle = legacy ? readEnum(value, 'bodyStyle', ['cleanClusters', 'pixelNoise']) : undefined
  const shapeMode: LegacyShapeMode = legacy
    ? bodyStyle === 'pixelNoise' ? 'legacyRadial' : 'lobedFireball'
    : readEnum(value, 'shapeMode', ['lobedFireball', 'legacyRadial'])
  const surfaceStyle: LegacySurfaceStyle = legacy
    ? bodyStyle === 'pixelNoise' ? 'pixelNoise' : 'gridNoise'
    : readEnum(value, 'surfaceStyle', ['celBands', 'fracturedChunks', 'moltenCavities', 'gridNoise', 'pixelNoise'])
  const lobeCount = legacy ? 7 : readInteger(value, 'lobeCount', 5, 9)
  const lobeStretch = legacy ? 0.58 : readNumber(value, 'lobeStretch', 0, 1)
  const tongueAmount = readNumber(value, legacy ? 'trailAmount' : 'tongueAmount', 0, 1)
  const tongueLength = readInteger(value, legacy ? 'trailLength' : 'tongueLength', 0, MAX_TONGUE_LENGTH)
  const tongueWidth = readInteger(value, legacy ? 'trailWidth' : 'tongueWidth', 1, MAX_TONGUE_WIDTH)
  const tongueVariation = readNumber(value, legacy ? 'trailLengthRandomness' : 'tongueLengthRandomness', 0, 1)
  const fragmentAmount = readNumber(value, 'fragmentAmount', 0, 1)
  const shockwaveWidth = readInteger(value, 'shockwaveWidth', 0, MAX_RADIUS)
  const shockwaveSpeed = readNumber(value, 'shockwaveSpeed', 0, 1)
  const coverage = readNumber(value, 'bodyStrength', 0, 1)
  const dissolveStart = readNumber(value, 'dissolveStart', 0.1, 0.9)
  const surface = createLegacySurface(surfaceStyle, coverage, dissolveStart)
  const oldShockwaveStyle = legacy && 'shockwaveStyle' in value ? readEnum(value, 'shockwaveStyle', ['segmentedArc', 'fullRing']) : undefined
  const ring = oldShockwaveStyle === 'fullRing' || (!oldShockwaveStyle && shapeMode === 'legacyRadial' && surfaceStyle === 'pixelNoise')
  return {
    palette: readPalette(value.palette),
    mode: readEnum(value, 'mode', ['explosion', 'implosion']),
    seed: readInteger(value, 'seed', 0, 0xffffffff),
    body: {
      shapeMode,
      radius: readInteger(value, 'radius', 2, MAX_RADIUS),
      lobeCount,
      lobeStretch,
      rotation: 0,
      shapeIrregularity: readNumber(value, 'irregularity', 0, 1),
      formationDuration: lerp(0.68, 0.32, readNumber(value, 'expansionSpeed', 0, 1)),
    },
    surface,
    core: {
      enabled: readInteger(value, 'coreRadius', 0, MAX_RADIUS) > 0,
      radius: readInteger(value, 'coreRadius', 0, MAX_RADIUS),
      duration: readNumber(value, 'coreDuration', 0.1, 0.9),
    },
    shockwave: {
      mode: shockwaveWidth === 0 ? 'none' : ring ? 'ring' : 'lobeArcs',
      thickness: clampInteger(Math.max(1, shockwaveWidth), 1, 6),
      startRadiusScale: ring ? 0 : 0.72,
      endRadiusScale: ring ? 1.18 : 1.38,
      startTime: ring ? 0 : 0.12,
      duration: lerp(0.72, 0.28, shockwaveSpeed),
      arcCount: Math.ceil(lobeCount / 2),
      arcSpan: 30,
    },
    tongues: {
      enabled: tongueAmount > 0 && tongueLength > 0,
      count: Math.max(1, Math.round(tongueAmount * lobeCount)),
      length: tongueLength,
      width: tongueWidth,
      curvature: 0.3,
      variation: tongueVariation,
    },
    fragments: {
      enabled: fragmentAmount > 0,
      count: Math.max(1, Math.round(fragmentAmount * 72)),
      minSize: readInteger(value, 'fragmentMinSize', 1, 8),
      maxSize: readInteger(value, 'fragmentMaxSize', 1, 8),
      travelDistance: readInteger(value, 'fragmentRadialSpeed', 0, MAX_FRAGMENT_DISTANCE),
      tangentialDrift: readInteger(value, 'fragmentTangentialJitter', 0, MAX_TANGENTIAL_DRIFT),
      lifetime: readNumber(value, 'fragmentLifetime', 0.1, 1),
    },
  }
}

/** Creates the default legacy surface object for one style. */
function createLegacySurface(
  style: LegacySurfaceStyle,
  coverage: number,
  dissolveStart: number,
): LegacySurface {
  switch (style) {
    case 'celBands': return { style, coverage, dissolveStart, bandWarp: 0.15, edgeBreakup: 0.3 }
    case 'fracturedChunks': return { style, coverage, dissolveStart, chunkSize: 8, crackWidth: 1 }
    case 'moltenCavities': return { style, coverage, dissolveStart, cavityAmount: 0.28, cavityScale: 11 }
    case 'gridNoise': return { style, coverage, dissolveStart }
    case 'pixelNoise': return { style, coverage, dissolveStart }
  }
}

/** Reads a required nested object. */
function readRecord(record: Readonly<Record<string, unknown>>, key: string): Readonly<Record<string, unknown>> {
  const value = record[key]
  if (!isPlainRecord(value)) throw new RangeError(`${key} must be an object.`)
  return value
}

/** Reads a two-to-six-color palette. */
function readPalette(value: unknown): RgbColor[] {
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

/** Clamps and rounds a numeric value into inclusive integer bounds. */
function clampInteger(value: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(value)) return minimum
  return Math.min(maximum, Math.max(minimum, Math.round(value)))
}

/** Linear interpolation used by deterministic legacy migrations. */
function lerp(start: number, end: number, amount: number): number {
  return start + (end - start) * amount
}
