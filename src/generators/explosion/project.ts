import { isPlainRecord } from '../../shared/project/document'
import type { GeneratorProjectCodec, JsonValue } from '../../shared/project/types'
import { assertValidExplosionParameters, type ExplosionParameters } from './model'

const REQUIRED_ROOT_KEYS = [
  'palette', 'canvasWidth', 'canvasHeight', 'frameCount', 'seed',
  'body', 'volume', 'surface', 'motion', 'core', 'shockwave', 'tongues', 'fragments',
] as const

const REQUIRED_NESTED_KEYS = {
  body: ['shape', 'radius', 'rotation', 'shapeIrregularity', 'churnAmount', 'lobeCount', 'pressureWidth', 'pressureCount', 'pressureSharpness', 'blastWidth', 'blastAngle', 'smokeSpread', 'smokeRise', 'smokeCount', 'smokeMotion'],
  volume: ['enabled', 'profile'],
  motion: ['mode', 'formationDuration', 'holdDuration', 'motionCurve', 'dissolveStart'],
  core: ['enabled', 'radius', 'duration'],
  shockwave: ['mode', 'colorMode', 'thickness', 'startRadiusScale', 'endRadiusScale', 'startTime', 'duration', 'ringCount', 'ringSpacing', 'squash', 'squashAngle'],
  tongues: ['enabled', 'count', 'length', 'width', 'curvature', 'variation'],
  fragments: ['enabled', 'count', 'minSize', 'maxSize', 'travelDistance', 'tangentialDrift', 'lifetime'],
} as const

/** Serializes explosion parameters into detached plain JSON data. */
export function serializeExplosionParameters(parameters: ExplosionParameters): JsonValue {
  assertValidExplosionParameters(parameters)
  return JSON.parse(JSON.stringify(parameters)) as JsonValue
}

/** Strictly parses and validates one explosion parameter document. */
export function parseExplosionParameters(value: unknown): ExplosionParameters {
  if (!isPlainRecord(value)) {
    throw new RangeError('parameters must be an object.')
  }
  requireKeys(value, REQUIRED_ROOT_KEYS, 'parameters')
  for (const [group, keys] of Object.entries(REQUIRED_NESTED_KEYS)) {
    const nested = value[group]
    if (!isPlainRecord(nested)) {
      throw new RangeError(`${group} must be an object.`)
    }
    requireKeys(nested, keys, group)
  }
  requireSurface(value.surface)
  requirePalette(value.palette)

  const parameters = JSON.parse(JSON.stringify(value)) as ExplosionParameters
  requireBoolean(parameters.volume.enabled, 'volume.enabled')
  requireBoolean(parameters.core.enabled, 'core.enabled')
  requireBoolean(parameters.tongues.enabled, 'tongues.enabled')
  requireBoolean(parameters.fragments.enabled, 'fragments.enabled')
  try {
    assertValidExplosionParameters(parameters)
  } catch (error) {
    if (error instanceof RangeError) throw error
    throw new RangeError(error instanceof Error ? error.message : String(error))
  }
  return parameters
}

/** Explosion v1 project codec registered on the generator module. */
export const explosionProjectCodec: GeneratorProjectCodec<ExplosionParameters> = {
  generatorId: 'explosion',
  version: 1,
  serialize: serializeExplosionParameters,
  parse: parseExplosionParameters,
}

/** Validates the required fields for the active discriminated surface variant. */
function requireSurface(value: unknown): void {
  if (!isPlainRecord(value)) throw new RangeError('surface must be an object.')
  requireKeys(value, ['style', 'coverage'], 'surface')
  switch (value.style) {
    case 'burningLayers': requireKeys(value, ['bandWarp', 'edgeBreakup'], 'surface'); return
    case 'rollingSoot': requireKeys(value, ['sootAmount', 'sootScale'], 'surface'); return
    case 'retroPixel': requireKeys(value, ['dissolveStyle', 'dissolveSize', 'dissolveJitter', 'dissolveDensity', 'dissolveSpeed'], 'surface'); return
    default: throw new RangeError('surface.style is invalid.')
  }
}

/** Validates palette entries before the shared parameter validator reads them. */
function requirePalette(value: unknown): void {
  if (!Array.isArray(value)) throw new RangeError('palette must be an array.')
  value.forEach((color, index) => {
    if (!isPlainRecord(color)) throw new RangeError(`palette[${index}] must be an object.`)
    requireKeys(color, ['r', 'g', 'b'], `palette[${index}]`)
  })
}

/** Requires every named project field in one parameter group. */
function requireKeys(record: Readonly<Record<string, unknown>>, keys: readonly string[], group: string): void {
  for (const key of keys) {
    if (!(key in record)) throw new RangeError(`Missing parameter: ${group}.${key}`)
  }
}

/** Requires a strict JSON boolean for one enabled flag. */
function requireBoolean(value: unknown, name: string): void {
  if (typeof value !== 'boolean') throw new RangeError(`${name} must be a boolean.`)
}
