import { assertInRange, assertValidColor, type RgbColor } from '../../shared/pixel/color'
import type { FrameSize } from '../../shared/pixel/frame'
import {
  assertValidProjectileParameters, assertValidSparkSettings, DEFAULT_PROJECTILE_PARAMETERS, MAX_CANVAS_SIZE,
  MAX_FRAME_COUNT, MAX_LOOP_CYCLES, MIN_CANVAS_SIZE, MIN_FRAME_COUNT,
  projectileFrameLimits, resizeProjectileCanvas, type ProjectileParameters, type SparkSettings,
} from '../projectile/model'
import { DEFAULT_FIREBALL_PALETTE, type FireballTuning } from './canonical'
import { DEFAULT_PUFF_TUNING, type PuffTuning } from './particleField'

export type FireballForm = 'classic' | 'stream' | 'wrapped' | 'puff'

export type ClassicFireballTuning = Pick<ProjectileParameters,
  'bodyLength' | 'silhouetteVariation' | 'fireRearExtension' | 'fireRearTurbulence' |
  'fireFlowSpeed' | 'fireMottleAmount' | 'pulseAmount' | 'wobbleAmount' |
  'trailMode' | 'trailEnabled' | 'trailLength' | 'trailWidth' | 'trailWave' | 'trailBreakup' |
  'sparksEnabled' | 'sparkCount' | 'sparkSpread' | 'sparkSpacing' | 'sparkFade' |
  'afterimagesEnabled' | 'afterimageCount' | 'afterimageSpacing' | 'afterimageDecay'>

/** Keeps only the controls unique to the legacy fireball artwork. */
export function classicFireballTuning(projectile: ClassicFireballTuning): ClassicFireballTuning {
  const { bodyLength, silhouetteVariation, fireRearExtension, fireRearTurbulence,
    fireFlowSpeed, fireMottleAmount, pulseAmount, wobbleAmount,
    trailMode, trailEnabled, trailLength, trailWidth, trailWave, trailBreakup,
    sparksEnabled, sparkCount, sparkSpread, sparkSpacing, sparkFade,
    afterimagesEnabled, afterimageCount, afterimageSpacing, afterimageDecay } = projectile
  return { bodyLength, silhouetteVariation, fireRearExtension, fireRearTurbulence,
    fireFlowSpeed, fireMottleAmount, pulseAmount, wobbleAmount,
    trailMode, trailEnabled: trailEnabled ?? trailMode !== 'off', trailLength, trailWidth, trailWave, trailBreakup,
    sparksEnabled, sparkCount, sparkSpread, sparkSpacing, sparkFade,
    afterimagesEnabled, afterimageCount, afterimageSpacing, afterimageDecay }
}

/** Each form owns its tuning so switching forms preserves edits. */
export interface FireballParameters {
  readonly canvasWidth: number
  readonly canvasHeight: number
  readonly frameCount: number
  readonly seed: number
  readonly form: FireballForm
  /** Head radius relative to the reviewed 15 px reference. */
  readonly size: number
  readonly rotationDegrees: number
  readonly loopCycles: number
  readonly warmPalette: readonly RgbColor[]
  readonly smokePalette: readonly RgbColor[]
  readonly stream: FireballTuning
  readonly wrapped: FireballTuning
  readonly puff: PuffTuning
  readonly classic: ClassicFireballTuning
  /** Classic trailing sparks for the stream, wrapped and puff forms; classic keeps its own. */
  readonly sparks: SparkSettings
}

/** Selects a fireball form while retaining each form's independent settings. */
export function selectFireballShape(parameters: FireballParameters, form: FireballForm): FireballParameters {
  return { ...parameters, form }
}

export const DEFAULT_FIREBALL_TUNING: FireballTuning = {
  fireballAngular: 0.55,
  fireballContour: 0.5,
  fireballBandWarp: 0.5,
  fireballBreakup: 0.25,
  fireballTrail: 'cooling',
  fireballRibbons: 3,
  fireballBall: 'hot',
}

/** Classic's spark look, switched off until the user opts in. */
export const DEFAULT_FIREBALL_SPARKS: SparkSettings = {
  sparksEnabled: false,
  sparkCount: DEFAULT_PROJECTILE_PARAMETERS.sparkCount,
  sparkSpread: DEFAULT_PROJECTILE_PARAMETERS.sparkSpread,
  sparkSpacing: DEFAULT_PROJECTILE_PARAMETERS.sparkSpacing,
  sparkFade: DEFAULT_PROJECTILE_PARAMETERS.sparkFade,
}

export const DEFAULT_FIREBALL_PARAMETERS: FireballParameters = {
  canvasWidth: 128,
  canvasHeight: 128,
  frameCount: 24,
  seed: 20260923,
  form: 'wrapped',
  size: 15,
  rotationDegrees: 0,
  loopCycles: 1,
  warmPalette: DEFAULT_FIREBALL_PALETTE.warm.map((color) => ({ ...color })),
  smokePalette: DEFAULT_FIREBALL_PALETTE.smoke.map((color) => ({ ...color })),
  stream: { ...DEFAULT_FIREBALL_TUNING },
  wrapped: { ...DEFAULT_FIREBALL_TUNING },
  puff: { ...DEFAULT_PUFF_TUNING },
  classic: classicFireballTuning(DEFAULT_PROJECTILE_PARAMETERS),
  sparks: DEFAULT_FIREBALL_SPARKS,
}

/** Projects shared fireball settings into the classic drawing algorithm. */
export function classicProjectileParameters(parameters: FireballParameters): ProjectileParameters {
  const limits = projectileFrameLimits({ width: parameters.canvasWidth, height: parameters.canvasHeight })
  const radius = Math.min(limits.maxRadius, Math.max(2, Math.round(parameters.size * 18 / 15)))
  return {
    ...DEFAULT_PROJECTILE_PARAMETERS,
    ...parameters.classic,
    canvasWidth: parameters.canvasWidth,
    canvasHeight: parameters.canvasHeight,
    frameCount: parameters.frameCount,
    seed: parameters.seed,
    kind: 'fireball',
    radius,
    bodyLength: Math.min(limits.maxBodyLength, parameters.classic.bodyLength),
    trailWidth: Math.min(radius, parameters.classic.trailWidth),
    rotationDegrees: parameters.rotationDegrees,
    loopCycles: parameters.loopCycles,
    energyPalette: parameters.warmPalette,
  }
}

/** The studied wake can rotate inside the canvas when scaled by its shorter side. */
export function maxFireballSize(width: number, height: number): number {
  return Math.max(1, Math.floor(Math.min(width, height) * 18 / 128))
}

/** Keeps a resized fireball proportional to the canvas's shorter edge. */
export function resizeFireballCanvas(parameters: FireballParameters, size: FrameSize, scaleEffect: boolean): FireballParameters {
  const canvasWidth = Math.max(MIN_CANVAS_SIZE, Math.min(MAX_CANVAS_SIZE, Math.round(size.width)))
  const canvasHeight = Math.max(MIN_CANVAS_SIZE, Math.min(MAX_CANVAS_SIZE, Math.round(size.height)))
  const ratio = scaleEffect ? Math.min(canvasWidth, canvasHeight) / Math.min(parameters.canvasWidth, parameters.canvasHeight) : 1
  const newSize = Math.max(1, Math.min(maxFireballSize(canvasWidth, canvasHeight), Math.round(parameters.size * ratio)))
  return {
    ...parameters, canvasWidth, canvasHeight, size: newSize,
    classic: classicFireballTuning(resizeProjectileCanvas(classicProjectileParameters(parameters), { width: canvasWidth, height: canvasHeight }, scaleEffect)),
  }
}

/** Validates every retained form, including forms that are not selected. */
export function assertValidFireballParameters(parameters: FireballParameters): void {
  assertInRange(parameters.canvasWidth, MIN_CANVAS_SIZE, MAX_CANVAS_SIZE, 'canvasWidth')
  assertInRange(parameters.canvasHeight, MIN_CANVAS_SIZE, MAX_CANVAS_SIZE, 'canvasHeight')
  assertInRange(parameters.frameCount, MIN_FRAME_COUNT, MAX_FRAME_COUNT, 'frameCount')
  assertInRange(parameters.seed, 0, 0xffffffff, 'seed')
  if (!['classic', 'stream', 'wrapped', 'puff'].includes(parameters.form)) throw new RangeError('form is invalid.')
  assertInRange(parameters.size, 1, maxFireballSize(parameters.canvasWidth, parameters.canvasHeight), 'size')
  assertInRange(parameters.rotationDegrees, 0, 359, 'rotationDegrees')
  assertInRange(parameters.loopCycles, 1, MAX_LOOP_CYCLES, 'loopCycles')
  if (!Number.isInteger(parameters.canvasWidth) || !Number.isInteger(parameters.canvasHeight)
    || !Number.isInteger(parameters.frameCount) || !Number.isInteger(parameters.seed)
    || !Number.isInteger(parameters.size) || !Number.isInteger(parameters.rotationDegrees)
    || !Number.isInteger(parameters.loopCycles)) throw new RangeError('Integer field is invalid.')
  if ([parameters.warmPalette, parameters.smokePalette].some((palette) => palette.length < 2 || palette.length > 6)) {
    throw new RangeError('Fireball palettes must contain between two and six colors.')
  }
  parameters.warmPalette.forEach((color, index) => assertValidColor(color, `warmPalette[${index}]`))
  parameters.smokePalette.forEach((color, index) => assertValidColor(color, `smokePalette[${index}]`))
  for (const tuning of [parameters.stream, parameters.wrapped]) {
    for (const value of [tuning.fireballAngular, tuning.fireballContour, tuning.fireballBandWarp, tuning.fireballBreakup, tuning.flowStrength ?? 1]) {
      assertInRange(value, 0, 1, 'fireball tuning')
    }
    if (!['cooling', 'flame', 'smoke'].includes(tuning.fireballTrail)) throw new RangeError('fireballTrail is invalid.')
    assertInRange(tuning.fireballRibbons, 1, 6, 'fireballRibbons')
    if (!Number.isInteger(tuning.fireballRibbons)) throw new RangeError('fireballRibbons must be an integer.')
    if (!['hot', 'molten'].includes(tuning.fireballBall)) throw new RangeError('fireballBall is invalid.')
  }
  assertInRange(parameters.puff.trailCount, 4, 18, 'trailCount')
  if (!Number.isInteger(parameters.puff.trailCount)) throw new RangeError('trailCount must be an integer.')
  assertInRange(parameters.puff.trailLength, 0, 1, 'trailLength')
  assertInRange(parameters.puff.billow, 0, 1, 'billow')
  if (typeof parameters.puff.smoke !== 'boolean') throw new RangeError('puff.smoke must be a boolean.')
  assertValidSparkSettings(parameters.sparks)
  if (!Number.isInteger(parameters.sparks.sparkCount)) throw new RangeError('sparkCount must be an integer.')
  assertValidProjectileParameters(classicProjectileParameters(parameters))
}
