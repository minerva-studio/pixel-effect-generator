import { isPlainRecord } from '../../shared/project/document'
import type { GeneratorProjectCodec, JsonValue } from '../../shared/project/types'
import { assertValidFireballParameters, classicFireballTuning, type ClassicFireballTuning, type FireballParameters } from './model'

/** Reads the standalone fireball document without accepting a legacy projectile body. */
export function parseFireballParameters(value: unknown): FireballParameters {
  if (!isPlainRecord(value) || !isPlainRecord(value.stream) || !isPlainRecord(value.wrapped)
    || !isPlainRecord(value.puff) || !isPlainRecord(value.classic)
    || !Array.isArray(value.warmPalette) || !Array.isArray(value.smokePalette)) {
    throw new RangeError('Invalid fireball parameters.')
  }
  const parameters = {
    ...value,
    classic: classicFireballTuning(value.classic as unknown as ClassicFireballTuning),
  } as unknown as FireballParameters
  assertValidFireballParameters(parameters)
  return parameters
}

/** All fireball form settings are persisted, including inactive forms. */
export function serializeFireballParameters(parameters: FireballParameters): JsonValue {
  assertValidFireballParameters(parameters)
  return parameters as unknown as JsonValue
}

export const fireballProjectCodec: GeneratorProjectCodec<FireballParameters> = {
  generatorId: 'fireball',
  version: 1,
  serialize: serializeFireballParameters,
  parse: parseFireballParameters,
}
