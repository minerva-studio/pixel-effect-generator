import { isPlainRecord } from '../../shared/project/document'
import type { JsonValue } from '../../shared/project/types'
import type { GeneratorPresetCapability } from '../contract'
import { DEFAULT_FLAME_PARAMETERS, FLAME_SHAPES, resizeFlameCanvas, type FlameParameters, type FlameShape } from './model'
import { parseFlameParameters } from './project'

/** Shape defaults also supply fixed-seed card previews. */
export const FLAME_SHAPE_DEFAULTS: Readonly<Record<FlameShape, FlameParameters>> = {
  candle: { ...DEFAULT_FLAME_PARAMETERS, shape: 'candle', width: 24, height: 72, baseWidth: 8, fork: 0.15, sway: 0.2, flicker: 0.15, turbulence: 0.15, roughness: 0.1, edgeBreakup: 0.1, sparksEnabled: false, sparkCount: 0 },
  torch: DEFAULT_FLAME_PARAMETERS,
  campfire: { ...DEFAULT_FLAME_PARAMETERS, shape: 'campfire', width: 76, height: 76, baseWidth: 54, fork: 0.9, sway: 0.5, turbulence: 0.75, bandWarp: 0.65, sparksEnabled: true, sparkCount: 9, sparkSpread: 0.65, sparkRise: 36 },
}

/** Captures all effect parameters, excluding canvas dimensions and frame count. */
export function captureFlamePreset(parameters: FlameParameters): JsonValue {
  const { canvasWidth, canvasHeight, frameCount, ...effect } = parseFlameParameters(parameters)
  return effect as unknown as JsonValue
}

function parsePreset(payload: unknown): FlameParameters {
  if (!isPlainRecord(payload)) throw new RangeError('Flame preset must be an object.')
  return parseFlameParameters({ ...payload, canvasWidth: 512, canvasHeight: 512, frameCount: 12 })
}

/** Applies effect fields at their saved pixel sizes, clamped to the current canvas. */
export function applyFlamePreset(current: FlameParameters, payload: JsonValue): FlameParameters {
  const parsed = parsePreset(payload)
  return resizeFlameCanvas({ ...parsed, frameCount: current.frameCount }, { width: current.canvasWidth, height: current.canvasHeight }, false)
}

export const flamePresetCapability: GeneratorPresetCapability<FlameParameters> = {
  builtIns: FLAME_SHAPES.map((shape) => ({ id: shape, name: `${shape[0].toUpperCase()}${shape.slice(1)} Flame`, description: `A looping ${shape} flame.`, payload: captureFlamePreset(FLAME_SHAPE_DEFAULTS[shape]) })),
  capture: captureFlamePreset,
  apply: applyFlamePreset,
  validate: (payload) => {
    try { return { ok: true, payload: captureFlamePreset(parsePreset(payload)) } }
    catch (error) { return { ok: false, error: error instanceof Error ? error.message : 'Invalid flame preset.' } }
  },
}
