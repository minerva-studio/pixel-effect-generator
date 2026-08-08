import { isPlainRecord } from '../../shared/project/document'
import type { JsonValue } from '../../shared/project/types'
import type { GeneratorPreset, GeneratorPresetCapability } from '../contract'
import {
  assertValidProjectileParameters,
  clampInteger,
  DEFAULT_PROJECTILE_PARAMETERS,
  MAX_AFTERIMAGE_COUNT,
  MAX_BODY_PALETTE_SIZE,
  MAX_ENERGY_PALETTE_SIZE,
  MAX_LOOP_CYCLES,
  MAX_SPARK_COUNT,
  MIN_BODY_PALETTE_SIZE,
  MIN_ENERGY_PALETTE_SIZE,
  projectileFrameLimits,
  type ProjectileParameters,
} from './model'
import {
  readBoolean,
  readEnum,
  readInteger,
  readNumber,
  readPalette,
  serializeProjectileParameters,
} from './project'

/** Preset payload covers every effect field except canvas size and frame count. */
export type ProjectilePresetFields = Omit<ProjectileParameters, 'canvasWidth' | 'canvasHeight' | 'frameCount'>

/** Generous static bounds used before the per-canvas clamp in apply. */
const MAX_PRESET_RADIUS = 256
const MAX_PRESET_TRAIL_WIDTH = 256

const REQUIRED_PRESET_KEYS = [
  'seed',
  'kind',
  'arrowMaterial',
  'radius',
  'bodyLength',
  'silhouetteVariation',
  'rotationDegrees',
  'loopCycles',
  'pulseAmount',
  'wobbleAmount',
  'trailMode',
  'trailLength',
  'trailWidth',
  'trailWave',
  'trailBreakup',
  'sparksEnabled',
  'sparkCount',
  'sparkSpread',
  'sparkSpacing',
  'sparkFade',
  'afterimagesEnabled',
  'afterimageCount',
  'afterimageSpacing',
  'afterimageDecay',
  'bodyPalette',
  'energyPalette',
] as const

/** Captures the effect-defining fields with stable key order. */
export function captureProjectilePreset(parameters: ProjectileParameters): JsonValue {
  const json = serializeProjectileParameters(parameters) as Record<string, unknown>
  const { canvasWidth: _width, canvasHeight: _height, frameCount: _frames, ...rest } = json
  return rest as JsonValue
}

/** Parses one preset payload into typed effect fields with strict bounds. */
export function parseProjectilePresetPayload(value: unknown): ProjectilePresetFields {
  if (!isPlainRecord(value)) {
    throw new RangeError('preset payload must be an object.')
  }
  for (const key of REQUIRED_PRESET_KEYS) {
    if (!(key in value)) {
      throw new RangeError(`Missing preset field: ${key}`)
    }
  }
  return {
    seed: readInteger(value, 'seed', 0, 0xffffffff),
    kind: readEnum(value, 'kind', ['fireball', 'arrow']),
    arrowMaterial: readEnum(value, 'arrowMaterial', ['solid', 'energy']),
    radius: readInteger(value, 'radius', 2, MAX_PRESET_RADIUS),
    bodyLength: readInteger(value, 'bodyLength', 4, MAX_PRESET_RADIUS * 2),
    silhouetteVariation: readNumber(value, 'silhouetteVariation', 0, 1),
    rotationDegrees: readInteger(value, 'rotationDegrees', 0, 359),
    loopCycles: readInteger(value, 'loopCycles', 1, MAX_LOOP_CYCLES),
    pulseAmount: readNumber(value, 'pulseAmount', 0, 1),
    wobbleAmount: readNumber(value, 'wobbleAmount', 0, 1),
    trailMode: readEnum(value, 'trailMode', ['off', 'fire', 'energy']),
    trailLength: readNumber(value, 'trailLength', 0, 1),
    trailWidth: readInteger(value, 'trailWidth', 1, MAX_PRESET_TRAIL_WIDTH),
    trailWave: readNumber(value, 'trailWave', 0, 1),
    trailBreakup: readNumber(value, 'trailBreakup', 0, 1),
    sparksEnabled: readBoolean(value, 'sparksEnabled'),
    sparkCount: readInteger(value, 'sparkCount', 0, MAX_SPARK_COUNT),
    sparkSpread: readNumber(value, 'sparkSpread', 0, 1),
    sparkSpacing: readNumber(value, 'sparkSpacing', 0, 1),
    sparkFade: readNumber(value, 'sparkFade', 0, 1),
    afterimagesEnabled: readBoolean(value, 'afterimagesEnabled'),
    afterimageCount: readInteger(value, 'afterimageCount', 0, MAX_AFTERIMAGE_COUNT),
    afterimageSpacing: readNumber(value, 'afterimageSpacing', 0, 1),
    afterimageDecay: readNumber(value, 'afterimageDecay', 0, 1),
    bodyPalette: readPalette(value.bodyPalette, MIN_BODY_PALETTE_SIZE, MAX_BODY_PALETTE_SIZE),
    energyPalette: readPalette(value.energyPalette, MIN_ENERGY_PALETTE_SIZE, MAX_ENERGY_PALETTE_SIZE),
  }
}

/**
 * Applies a preset onto the current parameters, keeping the current canvas
 * size and frame count, then clamps every effect field to the current canvas
 * limits so the result always renders legally.
 */
export function applyProjectilePreset(parameters: ProjectileParameters, payload: JsonValue): ProjectileParameters {
  const fields = parseProjectilePresetPayload(payload)
  const merged: ProjectileParameters = {
    ...parameters,
    ...fields,
    canvasWidth: parameters.canvasWidth,
    canvasHeight: parameters.canvasHeight,
    frameCount: parameters.frameCount,
  }
  return clampProjectilePresetParameters(merged)
}

/** Clamps effect fields to the current canvas limits and validates the result. */
export function clampProjectilePresetParameters(parameters: ProjectileParameters): ProjectileParameters {
  const limits = projectileFrameLimits({ width: parameters.canvasWidth, height: parameters.canvasHeight })
  const radius = clampInteger(parameters.radius, 2, limits.maxRadius)
  const clamped: ProjectileParameters = {
    ...parameters,
    radius,
    bodyLength: clampInteger(parameters.bodyLength, 4, limits.maxBodyLength),
    trailWidth: clampInteger(parameters.trailWidth, 1, radius),
  }
  assertValidProjectileParameters(clamped)
  return clamped
}

/** Validates one payload and returns its canonical captured form. */
export function validateProjectilePreset(
  payload: unknown,
): { readonly ok: true; readonly payload: JsonValue } | { readonly ok: false; readonly error: string } {
  try {
    const fields = parseProjectilePresetPayload(payload)
    return { ok: true, payload: captureProjectilePreset({ ...fields } as ProjectileParameters) }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

/** Read-only built-in projectile presets; names are translated through i18n. */
export const PROJECTILE_BUILTIN_PRESETS: readonly GeneratorPreset[] = [
  {
    id: 'fireball',
    name: 'Fireball',
    description: 'A pulsing fireball with a flickering flame trail and sparks.',
    payload: captureProjectilePreset(DEFAULT_PROJECTILE_PARAMETERS),
  },
  {
    id: 'blastBolt',
    name: 'Blast Bolt',
    description: 'A compact fire projectile with a broad broken wake and strongly advected sparks.',
    payload: captureProjectilePreset({
      ...DEFAULT_PROJECTILE_PARAMETERS,
      seed: 20260812,
      radius: 14,
      bodyLength: 30,
      silhouetteVariation: 0.34,
      pulseAmount: 0.12,
      wobbleAmount: 0.03,
      trailLength: 0.86,
      trailWidth: 11,
      trailWave: 0.12,
      trailBreakup: 0.38,
      sparksEnabled: true,
      sparkCount: 22,
      sparkSpread: 0.46,
      sparkSpacing: 0.92,
      sparkFade: 0.62,
      afterimagesEnabled: true,
      afterimageCount: 1,
      afterimageSpacing: 0.2,
      afterimageDecay: 0.84,
    }),
  },
  {
    id: 'enchantedArrow',
    name: 'Enchanted Arrow',
    description: 'A solid magic arrow wrapped in an energy trail.',
    payload: captureProjectilePreset({
      ...DEFAULT_PROJECTILE_PARAMETERS,
      kind: 'arrow',
      arrowMaterial: 'solid',
      radius: 7,
      bodyLength: 54,
      silhouetteVariation: 0.2,
      pulseAmount: 0.08,
      wobbleAmount: 0.05,
      trailMode: 'energy',
      trailLength: 0.62,
      trailWidth: 6,
      trailWave: 0.25,
      trailBreakup: 0.12,
      sparksEnabled: true,
      sparkCount: 8,
      afterimagesEnabled: true,
      afterimageCount: 3,
      afterimageSpacing: 0.18,
      afterimageDecay: 0.8,
      bodyPalette: [
        { r: 245, g: 245, b: 250, a: 255 },
        { r: 165, g: 150, b: 190, a: 255 },
        { r: 85, g: 70, b: 115, a: 255 },
      ],
      energyPalette: [
        { r: 255, g: 255, b: 255, a: 255 },
        { r: 170, g: 210, b: 255, a: 255 },
        { r: 90, g: 130, b: 255, a: 255 },
        { r: 35, g: 45, b: 120, a: 255 },
      ],
    }),
  },
  {
    id: 'energyArrow',
    name: 'Energy Arrow',
    description: 'A pure energy arrow with a crisp edge glow and wide spark spread.',
    payload: captureProjectilePreset({
      ...DEFAULT_PROJECTILE_PARAMETERS,
      kind: 'arrow',
      arrowMaterial: 'energy',
      radius: 8,
      bodyLength: 50,
      silhouetteVariation: 0.35,
      pulseAmount: 0.12,
      wobbleAmount: 0.08,
      trailMode: 'energy',
      trailLength: 0.8,
      trailWidth: 9,
      trailWave: 0.45,
      trailBreakup: 0.2,
      sparksEnabled: true,
      sparkCount: 16,
      sparkSpread: 0.75,
      afterimagesEnabled: true,
      afterimageCount: 4,
      afterimageSpacing: 0.16,
      afterimageDecay: 0.82,
      bodyPalette: [
        { r: 240, g: 240, b: 255, a: 255 },
        { r: 150, g: 150, b: 220, a: 255 },
        { r: 60, g: 60, b: 120, a: 255 },
      ],
      energyPalette: [
        { r: 255, g: 255, b: 255, a: 255 },
        { r: 140, g: 240, b: 255, a: 255 },
        { r: 70, g: 140, b: 255, a: 255 },
        { r: 30, g: 40, b: 130, a: 255 },
      ],
    }),
  },
]

/** Projectile v1 preset capability registered on the generator module. */
export const projectilePresetCapability: GeneratorPresetCapability<ProjectileParameters> = {
  builtIns: PROJECTILE_BUILTIN_PRESETS,
  capture: captureProjectilePreset,
  apply: applyProjectilePreset,
  validate: validateProjectilePreset,
}
