import { isPlainRecord } from '../../shared/project/document'
import type { JsonValue } from '../../shared/project/types'
import type { GeneratorPreset, GeneratorPresetCapability } from '../contract'
import {
  assertValidParameters,
  clampInteger,
  frameLimits,
  MAX_FRAGMENT_SIZE,
  type SlashParameters,
} from './model'
import { readEnum, readInteger, readNumber, readPalette, serializeSlashParameters } from './project'

/** Preset payload covers every effect field except canvas size and frame count. */
export type SlashPresetFields = Omit<SlashParameters, 'canvasWidth' | 'canvasHeight' | 'frameCount'>

/** Generous static bounds used before the per-canvas clamp in apply. */
const MAX_PRESET_RADIUS = 256
const MAX_PRESET_THICKNESS = 256
const MAX_PRESET_TANGENT_SPEED = 128
const MAX_PRESET_OUTWARD_SPEED = 96

const REQUIRED_PRESET_KEYS = [
  'palette',
  'radius',
  'thickness',
  'startAngleDegrees',
  'sweepDegrees',
  'rotationDegrees',
  'tiltDegrees',
  'direction',
  'sweepSpeed',
  'trailLength',
  'dissolveLength',
  'edgeBreakup',
  'dissolveMode',
  'edgeBreakupMode',
  'fragmentMode',
  'fragmentAmount',
  'seed',
  'edgeDepth',
  'fragmentMinSize',
  'fragmentMaxSize',
  'fragmentTangentSpeed',
  'fragmentOutwardSpeed',
  'fragmentLifetime',
] as const

/** Captures the effect-defining fields with stable key order. */
export function captureSlashPreset(parameters: SlashParameters): JsonValue {
  const json = serializeSlashParameters(parameters) as Record<string, unknown>
  const { canvasWidth: _width, canvasHeight: _height, frameCount: _frames, ...rest } = json
  return rest as JsonValue
}

/** Parses one preset payload into typed effect fields with strict bounds. */
export function parseSlashPresetPayload(value: unknown): SlashPresetFields {
  if (!isPlainRecord(value)) {
    throw new RangeError('preset payload must be an object.')
  }
  for (const key of REQUIRED_PRESET_KEYS) {
    if (!(key in value)) {
      throw new RangeError(`Missing preset field: ${key}`)
    }
  }
  return {
    palette: readPalette(value.palette),
    radius: readInteger(value, 'radius', 2, MAX_PRESET_RADIUS),
    thickness: readInteger(value, 'thickness', 1, MAX_PRESET_THICKNESS),
    startAngleDegrees: readNumber(value, 'startAngleDegrees', -180, 180),
    sweepDegrees: readNumber(value, 'sweepDegrees', 30, 720),
    rotationDegrees: readNumber(value, 'rotationDegrees', -180, 180),
    tiltDegrees: readNumber(value, 'tiltDegrees', 0, 90),
    direction: readEnum(value, 'direction', ['clockwise', 'counterClockwise']),
    sweepSpeed: readNumber(value, 'sweepSpeed', 0, 1),
    trailLength: readNumber(value, 'trailLength', 0, 1),
    dissolveLength: readNumber(value, 'dissolveLength', 0, 1),
    edgeBreakup: readNumber(value, 'edgeBreakup', 0, 1),
    dissolveMode: readEnum(value, 'dissolveMode', ['ordered', 'clusteredNoise', 'directionalStreaks']),
    edgeBreakupMode: readEnum(value, 'edgeBreakupMode', ['blockChips', 'jaggedContour', 'slashCuts']),
    fragmentMode: readEnum(value, 'fragmentMode', ['pixelChunks', 'directionalShards', 'energySparks']),
    fragmentAmount: readNumber(value, 'fragmentAmount', 0, 1),
    seed: readInteger(value, 'seed', 0, 0xffffffff),
    edgeDepth: readNumber(value, 'edgeDepth', 0.05, 0.5),
    fragmentMinSize: readInteger(value, 'fragmentMinSize', 1, MAX_FRAGMENT_SIZE),
    fragmentMaxSize: readInteger(value, 'fragmentMaxSize', 1, MAX_FRAGMENT_SIZE),
    fragmentTangentSpeed: readInteger(value, 'fragmentTangentSpeed', 0, MAX_PRESET_TANGENT_SPEED),
    fragmentOutwardSpeed: readInteger(value, 'fragmentOutwardSpeed', 0, MAX_PRESET_OUTWARD_SPEED),
    fragmentLifetime: readNumber(value, 'fragmentLifetime', 0.1, 1),
  }
}

/**
 * Applies a preset onto the current parameters, keeping the current canvas
 * size and frame count, then clamps every effect field to the current canvas
 * limits so the result always renders legally.
 */
export function applySlashPreset(parameters: SlashParameters, payload: JsonValue): SlashParameters {
  const fields = parseSlashPresetPayload(payload)
  const merged: SlashParameters = {
    ...parameters,
    ...fields,
    canvasWidth: parameters.canvasWidth,
    canvasHeight: parameters.canvasHeight,
    frameCount: parameters.frameCount,
  }
  return clampSlashPresetParameters(merged)
}

/** Clamps effect fields to the current canvas limits and validates the result. */
export function clampSlashPresetParameters(parameters: SlashParameters): SlashParameters {
  const limits = frameLimits({ width: parameters.canvasWidth, height: parameters.canvasHeight })
  const radius = clampInteger(parameters.radius, 2, limits.maxRadius)
  const thickness = clampInteger(parameters.thickness, 1, radius)
  const fragmentMinSize = clampInteger(parameters.fragmentMinSize, 1, MAX_FRAGMENT_SIZE)
  const fragmentMaxSize = clampInteger(parameters.fragmentMaxSize, 1, MAX_FRAGMENT_SIZE)
  const clamped: SlashParameters = {
    ...parameters,
    radius,
    thickness,
    fragmentMinSize: Math.min(fragmentMinSize, fragmentMaxSize),
    fragmentMaxSize: Math.max(fragmentMinSize, fragmentMaxSize),
    fragmentTangentSpeed: clampInteger(parameters.fragmentTangentSpeed, 0, limits.maxFragmentTangentSpeed),
    fragmentOutwardSpeed: clampInteger(parameters.fragmentOutwardSpeed, 0, limits.maxFragmentOutwardSpeed),
  }
  assertValidParameters(clamped)
  return clamped
}

/** Validates one payload and returns its canonical captured form. */
export function validateSlashPreset(payload: unknown): { readonly ok: true; readonly payload: JsonValue } | { readonly ok: false; readonly error: string } {
  try {
    const fields = parseSlashPresetPayload(payload)
    return { ok: true, payload: captureSlashPreset({ ...fields } as SlashParameters) }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

/** Read-only built-in Slash presets; names are translated through i18n. */
export const SLASH_BUILTIN_PRESETS: readonly GeneratorPreset[] = [
  {
    id: 'cleanArc',
    name: 'Clean Arc',
    description: 'A crisp, low-breakup base slash.',
    payload: {
      palette: [
        { r: 255, g: 255, b: 255 },
        { r: 154, g: 198, b: 255 },
        { r: 52, g: 140, b: 255 },
      ],
      radius: 44,
      thickness: 10,
      startAngleDegrees: -90,
      sweepDegrees: 180,
      rotationDegrees: 0,
      tiltDegrees: 0,
      direction: 'clockwise',
      sweepSpeed: 0.45,
      trailLength: 0.3,
      dissolveLength: 0.2,
      edgeBreakup: 0.02,
      dissolveMode: 'ordered',
      edgeBreakupMode: 'blockChips',
      fragmentMode: 'pixelChunks',
      fragmentAmount: 0.04,
      seed: 1337,
      edgeDepth: 0.12,
      fragmentMinSize: 1,
      fragmentMaxSize: 1,
      fragmentTangentSpeed: 10,
      fragmentOutwardSpeed: 4,
      fragmentLifetime: 0.35,
    },
  },
  {
    id: 'heavyCleave',
    name: 'Heavy Cleave',
    description: 'A thick arc with a long, heavy trail.',
    payload: {
      palette: [
        { r: 255, g: 240, b: 220 },
        { r: 255, g: 140, b: 90 },
        { r: 190, g: 60, b: 40 },
      ],
      radius: 48,
      thickness: 18,
      startAngleDegrees: -90,
      sweepDegrees: 200,
      rotationDegrees: 0,
      tiltDegrees: 8,
      direction: 'clockwise',
      sweepSpeed: 0.4,
      trailLength: 0.55,
      dissolveLength: 0.18,
      edgeBreakup: 0.12,
      dissolveMode: 'clusteredNoise',
      edgeBreakupMode: 'jaggedContour',
      fragmentMode: 'directionalShards',
      fragmentAmount: 0.25,
      seed: 7,
      edgeDepth: 0.3,
      fragmentMinSize: 2,
      fragmentMaxSize: 5,
      fragmentTangentSpeed: 12,
      fragmentOutwardSpeed: 6,
      fragmentLifetime: 0.45,
    },
  },
  {
    id: 'energySweep',
    name: 'Energy Sweep',
    description: 'A bright palette with fast energy sparks.',
    payload: {
      palette: [
        { r: 255, g: 255, b: 255 },
        { r: 255, g: 220, b: 120 },
        { r: 140, g: 240, b: 255 },
      ],
      radius: 40,
      thickness: 8,
      startAngleDegrees: -90,
      sweepDegrees: 240,
      rotationDegrees: 0,
      tiltDegrees: 0,
      direction: 'clockwise',
      sweepSpeed: 0.55,
      trailLength: 0.2,
      dissolveLength: 0.25,
      edgeBreakup: 0.05,
      dissolveMode: 'directionalStreaks',
      edgeBreakupMode: 'slashCuts',
      fragmentMode: 'energySparks',
      fragmentAmount: 0.4,
      seed: 99,
      edgeDepth: 0.15,
      fragmentMinSize: 1,
      fragmentMaxSize: 3,
      fragmentTangentSpeed: 20,
      fragmentOutwardSpeed: 10,
      fragmentLifetime: 0.3,
    },
  },
  {
    id: 'shatteredEdge',
    name: 'Shattered Edge',
    description: 'A heavily broken edge with directional shards.',
    payload: {
      palette: [
        { r: 255, g: 255, b: 255 },
        { r: 154, g: 198, b: 255 },
        { r: 52, g: 140, b: 255 },
      ],
      radius: 44,
      thickness: 12,
      startAngleDegrees: -90,
      sweepDegrees: 180,
      rotationDegrees: 0,
      tiltDegrees: 10,
      direction: 'clockwise',
      sweepSpeed: 0.5,
      trailLength: 0.25,
      dissolveLength: 0.35,
      edgeBreakup: 0.35,
      dissolveMode: 'clusteredNoise',
      edgeBreakupMode: 'slashCuts',
      fragmentMode: 'directionalShards',
      fragmentAmount: 0.5,
      seed: 4242,
      edgeDepth: 0.4,
      fragmentMinSize: 2,
      fragmentMaxSize: 6,
      fragmentTangentSpeed: 14,
      fragmentOutwardSpeed: 8,
      fragmentLifetime: 0.5,
    },
  },
  {
    id: 'fullCircle',
    name: 'Full Circle',
    description: 'A complete 360-degree ring sweep.',
    payload: {
      palette: [
        { r: 255, g: 255, b: 255 },
        { r: 180, g: 200, b: 255 },
        { r: 90, g: 120, b: 255 },
      ],
      radius: 42,
      thickness: 10,
      startAngleDegrees: -90,
      sweepDegrees: 360,
      rotationDegrees: 0,
      tiltDegrees: 0,
      direction: 'clockwise',
      sweepSpeed: 0.6,
      trailLength: 0.4,
      dissolveLength: 0.3,
      edgeBreakup: 0.08,
      dissolveMode: 'ordered',
      edgeBreakupMode: 'blockChips',
      fragmentMode: 'pixelChunks',
      fragmentAmount: 0.15,
      seed: 2024,
      edgeDepth: 0.2,
      fragmentMinSize: 1,
      fragmentMaxSize: 2,
      fragmentTangentSpeed: 10,
      fragmentOutwardSpeed: 5,
      fragmentLifetime: 0.4,
    },
  },
]

/** Slash v1 preset capability registered on the generator module. */
export const slashPresetCapability: GeneratorPresetCapability<SlashParameters> = {
  builtIns: SLASH_BUILTIN_PRESETS,
  capture: captureSlashPreset,
  apply: applySlashPreset,
  validate: validateSlashPreset,
}
