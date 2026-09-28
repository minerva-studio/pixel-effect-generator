import { isPlainRecord } from '../../shared/project/document'
import type { GeneratorProjectCodec, JsonValue } from '../../shared/project/types'
import { assertValidBloomParameters, type BloomParameters } from './model'
import { captureBloomPreset, parseBloomPresetPayload } from './presets'

/** Parses one share payload: the current preset fields plus canvas size and frame count, without clamping. */
export function parseBloomShareParameters(value: unknown): BloomParameters {
  if (!isPlainRecord(value)) throw new RangeError('Energy bloom parameters must be an object.')
  const parameters: BloomParameters = {
    ...parseBloomPresetPayload(value),
    canvasWidth: readInteger(value, 'canvasWidth'),
    canvasHeight: readInteger(value, 'canvasHeight'),
    frameCount: readInteger(value, 'frameCount'),
  }
  assertValidBloomParameters(parameters)
  return parameters
}

/** Share-only codec; energy bloom still has no project file support. */
export const bloomShareCodec: GeneratorProjectCodec<BloomParameters> = {
  generatorId: 'energyBloom', version: 1,
  serialize: (parameters) => {
    const preset = captureBloomPreset(parameters) as { readonly [key: string]: JsonValue }
    return { ...preset, canvasWidth: parameters.canvasWidth, canvasHeight: parameters.canvasHeight, frameCount: parameters.frameCount }
  },
  parse: parseBloomShareParameters,
}

/** Reads one required integer field; range checks belong to the parameter validator. */
function readInteger(record: Readonly<Record<string, unknown>>, key: string): number {
  const value = record[key]
  if (typeof value !== 'number' || !Number.isInteger(value)) throw new RangeError(`${key} must be an integer.`)
  return value
}
