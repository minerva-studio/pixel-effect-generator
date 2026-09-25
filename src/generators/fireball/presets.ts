import type { GeneratorPresetCapability } from '../contract'
import type { JsonValue } from '../../shared/project/types'
import { DEFAULT_FIREBALL_PARAMETERS, maxFireballSize, type FireballForm, type FireballParameters } from './model'
import { parseFireballParameters, serializeFireballParameters } from './project'

/** Preset settings omit canvas dimensions and frame count but keep all form edits. */
export function captureFireballPreset(parameters: FireballParameters): JsonValue {
  const { canvasWidth: _width, canvasHeight: _height, frameCount: _count, ...effect } = parameters
  return effect as unknown as JsonValue
}

export function applyFireballPreset(parameters: FireballParameters, payload: JsonValue): FireballParameters {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) throw new RangeError('Invalid fireball preset.')
  const merged = {
    ...parameters, ...payload,
    canvasWidth: parameters.canvasWidth,
    canvasHeight: parameters.canvasHeight,
    frameCount: parameters.frameCount,
  } as FireballParameters
  return parseFireballParameters({
    ...merged,
    size: Math.min(merged.size, maxFireballSize(parameters.canvasWidth, parameters.canvasHeight)),
  })
}

const builtIns = (['wrapped', 'stream', 'puff', 'classic'] as FireballForm[]).map((form) => ({
  id: form,
  name: { wrapped: 'Wrapped fireball', stream: 'Stream fireball', puff: 'Particle fireball', classic: 'Classic fireball' }[form],
  description: { wrapped: 'A hot ball enclosed by moving fire.', stream: 'A streaming fire bolt.', puff: 'A shedding particle mass.', classic: 'The original projectile fireball.' }[form],
  payload: captureFireballPreset({ ...DEFAULT_FIREBALL_PARAMETERS, form }),
}))

export const fireballPresetCapability: GeneratorPresetCapability<FireballParameters> = {
  builtIns,
  capture: captureFireballPreset,
  apply: applyFireballPreset,
  validate(payload) {
    try {
      const result = applyFireballPreset(DEFAULT_FIREBALL_PARAMETERS, payload as JsonValue)
      serializeFireballParameters(result)
      return { ok: true, payload: captureFireballPreset(result) }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) }
    }
  },
}
