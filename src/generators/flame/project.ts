import { isPlainRecord } from '../../shared/project/document'
import type { GeneratorProjectCodec, JsonValue } from '../../shared/project/types'
import { assertValidFlameParameters, DEFAULT_FLAME_PARAMETERS, type FlameParameters } from './model'

/** Creates a validated, detached snapshot containing only owned parameter fields. */
export function parseFlameParameters(value: unknown): FlameParameters {
  if (!isPlainRecord(value)) throw new RangeError('Flame parameters must be an object.')
  const result: Record<string, unknown> = {}
  for (const key of Object.keys(DEFAULT_FLAME_PARAMETERS)) {
    if (!(key in value)) throw new RangeError(`Missing flame field: ${key}`)
    result[key] = value[key]
  }
  const parameters = result as unknown as FlameParameters
  assertValidFlameParameters(parameters)
  return { ...parameters, palette: parameters.palette.map(({ r, g, b, a }) => ({ r, g, b, a })) }
}

export const flameProjectCodec: GeneratorProjectCodec<FlameParameters> = {
  generatorId: 'flame', version: 1,
  serialize: (parameters) => parseFlameParameters(parameters) as unknown as JsonValue,
  parse: parseFlameParameters,
}
