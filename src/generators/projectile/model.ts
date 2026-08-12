import { assertInRange, assertValidColor, type RgbColor } from '../../shared/pixel/color'
import type { FrameSize } from '../../shared/pixel/frame'

/** Default canvas edge used by the flight loop and the shared preset scaling. */
export const PROJECTILE_FRAME_SIZE = 128
export const MIN_CANVAS_SIZE = 16
export const MAX_CANVAS_SIZE = 512
export const MIN_FRAME_COUNT = 5
export const MAX_FRAME_COUNT = 24

/** Integer cycles per loop keeps every temporal effect periodic in [0, 1). */
export const MAX_LOOP_CYCLES = 4
export const MAX_SPARK_COUNT = 24
export const MAX_AFTERIMAGE_COUNT = 8
export const MIN_BODY_PALETTE_SIZE = 2
export const MAX_BODY_PALETTE_SIZE = 4
export const MIN_ENERGY_PALETTE_SIZE = 2
export const MAX_ENERGY_PALETTE_SIZE = 6

export type ProjectileKind = 'fireball' | 'arrow' | 'crystal'
export type ArrowMaterial = 'solid' | 'energy'
export type CrystalForm = 'spear' | 'core'
export type TrailMode = 'off' | 'fire' | 'energy'

export interface ProjectileParameters {
  readonly canvasWidth: number
  readonly canvasHeight: number
  readonly frameCount: number
  readonly seed: number
  readonly kind: ProjectileKind
  readonly arrowMaterial: ArrowMaterial
  readonly crystalForm: CrystalForm
  readonly fireRearExtension: number
  readonly fireRearTurbulence: number
  readonly fireFlowSpeed: number
  readonly fireMottleAmount: number
  readonly solidHeadLength: number
  readonly solidShaftWidth: number
  readonly solidFletchingSpread: number
  readonly energyCoreLength: number
  readonly energyShellWidth: number
  readonly energyTipSharpness: number
  readonly crystalSpearTaper: number
  readonly crystalSpearThickness: number
  readonly crystalRefractionStrength: number
  readonly crystalGlintStrength: number
  readonly crystalGlintSpeed: number
  readonly crystalCoreScale: number
  readonly crystalOrbitRadius: number
  readonly crystalOrbitSpeed: number
  readonly radius: number
  readonly bodyLength: number
  readonly silhouetteVariation: number
  readonly rotationDegrees: number
  readonly loopCycles: number
  readonly pulseAmount: number
  readonly wobbleAmount: number
  readonly trailMode: TrailMode
  readonly trailLength: number
  readonly trailWidth: number
  readonly trailWave: number
  readonly trailBreakup: number
  readonly sparksEnabled: boolean
  readonly sparkCount: number
  readonly sparkSpread: number
  readonly sparkSpacing: number
  readonly sparkFade: number
  readonly afterimagesEnabled: boolean
  readonly afterimageCount: number
  readonly afterimageSpacing: number
  readonly afterimageDecay: number
  readonly bodyPalette: readonly RgbColor[]
  readonly energyPalette: readonly RgbColor[]
}

/** Size-dependent bounds for one centered flight loop. */
export interface ProjectileFrameLimits {
  readonly maxRadius: number
  readonly maxBodyLength: number
}

/** Returns the default 128×128 canvas for the projectile generator. */
export function defaultProjectileCanvasSize(): FrameSize {
  return { width: PROJECTILE_FRAME_SIZE, height: PROJECTILE_FRAME_SIZE }
}

/** Computes size-dependent limits for a centered projectile. */
export function projectileFrameLimits(size: FrameSize): ProjectileFrameLimits {
  return {
    maxRadius: Math.max(2, Math.floor(Math.min(size.width, size.height) / 2)),
    maxBodyLength: Math.max(4, Math.min(size.width, size.height) - 4),
  }
}

/** Clamps an integer value into inclusive bounds. */
export function clampInteger(value: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(value)) {
    return minimum
  }
  return Math.min(maximum, Math.max(minimum, Math.round(value)))
}

/** Normalizes canvas dimensions into supported integer bounds. */
export function normalizeCanvasSize(size: FrameSize): FrameSize {
  return {
    width: clampInteger(size.width, MIN_CANVAS_SIZE, MAX_CANVAS_SIZE),
    height: clampInteger(size.height, MIN_CANVAS_SIZE, MAX_CANVAS_SIZE),
  }
}

/**
 * Resolves a resize request as a deterministic parameter transform: body
 * dimensions and trail width scale with the short edge while proportional
 * parameters stay untouched.
 */
export function resizeProjectileCanvas(
  parameters: ProjectileParameters,
  nextSize: FrameSize,
  scaleEffect = true,
): ProjectileParameters {
  const oldSize = normalizeCanvasSize({ width: parameters.canvasWidth, height: parameters.canvasHeight })
  const scaledSize = normalizeCanvasSize(nextSize)
  const scale = scaleEffect ? Math.min(scaledSize.width, scaledSize.height) / Math.min(oldSize.width, oldSize.height) : 1
  const limits = projectileFrameLimits(scaledSize)
  const radius = clampInteger(
    scaleEffect ? parameters.radius * scale : parameters.radius,
    2,
    limits.maxRadius,
  )
  const bodyLength = clampInteger(
    scaleEffect ? parameters.bodyLength * scale : parameters.bodyLength,
    4,
    limits.maxBodyLength,
  )
  const trailWidth = clampInteger(
    scaleEffect ? parameters.trailWidth * scale : parameters.trailWidth,
    1,
    radius,
  )
  return {
    ...parameters,
    canvasWidth: scaledSize.width,
    canvasHeight: scaledSize.height,
    radius,
    bodyLength,
    trailWidth,
  }
}

/** Default in-place flight loop: a pulsing fireball with a fire trail. */
export const DEFAULT_PROJECTILE_PARAMETERS: ProjectileParameters = {
  canvasWidth: PROJECTILE_FRAME_SIZE,
  canvasHeight: PROJECTILE_FRAME_SIZE,
  frameCount: 10,
  seed: 20260806,
  kind: 'fireball',
  arrowMaterial: 'solid',
  crystalForm: 'spear',
  fireRearExtension: 0.5,
  fireRearTurbulence: 0.6,
  fireFlowSpeed: 1,
  fireMottleAmount: 0.22,
  solidHeadLength: 0.3,
  solidShaftWidth: 0.16,
  solidFletchingSpread: 0.58,
  energyCoreLength: 0.55,
  energyShellWidth: 0.25,
  energyTipSharpness: 0.55,
  crystalSpearTaper: 0.5,
  crystalSpearThickness: 1,
  crystalRefractionStrength: 0.55,
  crystalGlintStrength: 0.55,
  crystalGlintSpeed: 1,
  crystalCoreScale: 1,
  crystalOrbitRadius: 1.35,
  crystalOrbitSpeed: 1,
  radius: 18,
  bodyLength: 38,
  silhouetteVariation: 0.4,
  rotationDegrees: 0,
  loopCycles: 1,
  pulseAmount: 0.18,
  wobbleAmount: 0.08,
  trailMode: 'fire',
  trailLength: 0.72,
  trailWidth: 12,
  trailWave: 0.24,
  trailBreakup: 0.18,
  sparksEnabled: true,
  sparkCount: 14,
  sparkSpread: 0.7,
  sparkSpacing: 0.8,
  sparkFade: 0.45,
  afterimagesEnabled: true,
  afterimageCount: 2,
  afterimageSpacing: 0.18,
  afterimageDecay: 0.75,
  bodyPalette: [
    { r: 235, g: 235, b: 235, a: 255 },
    { r: 150, g: 128, b: 116, a: 255 },
    { r: 74, g: 60, b: 52, a: 255 },
  ],
  energyPalette: [
    { r: 255, g: 244, b: 176, a: 255 },
    { r: 255, g: 196, b: 77, a: 255 },
    { r: 240, g: 107, b: 36, a: 255 },
    { r: 122, g: 30, b: 22, a: 255 },
  ],
}

/** Validates the complete projectile flight-loop parameter contract. */
export function assertValidProjectileParameters(parameters: ProjectileParameters): void {
  assertInRange(parameters.canvasWidth, MIN_CANVAS_SIZE, MAX_CANVAS_SIZE, 'canvasWidth')
  assertInRange(parameters.canvasHeight, MIN_CANVAS_SIZE, MAX_CANVAS_SIZE, 'canvasHeight')
  assertInRange(parameters.frameCount, MIN_FRAME_COUNT, MAX_FRAME_COUNT, 'frameCount')
  assertInRange(parameters.seed, 0, 0xffffffff, 'seed')
  if (parameters.kind !== 'fireball' && parameters.kind !== 'arrow' && parameters.kind !== 'crystal') {
    throw new RangeError('kind is invalid.')
  }
  if (parameters.arrowMaterial !== 'solid' && parameters.arrowMaterial !== 'energy') {
    throw new RangeError('arrowMaterial is invalid.')
  }
  if (parameters.crystalForm !== 'spear' && parameters.crystalForm !== 'core') {
    throw new RangeError('crystalForm is invalid.')
  }
  assertInRange(parameters.fireRearExtension, 0, 1, 'fireRearExtension')
  assertInRange(parameters.fireRearTurbulence, 0, 1, 'fireRearTurbulence')
  assertInRange(parameters.fireFlowSpeed, 0.25, 3, 'fireFlowSpeed')
  assertInRange(parameters.fireMottleAmount, 0, 1, 'fireMottleAmount')
  assertInRange(parameters.solidHeadLength, 0.15, 0.55, 'solidHeadLength')
  assertInRange(parameters.solidShaftWidth, 0.08, 0.4, 'solidShaftWidth')
  assertInRange(parameters.solidFletchingSpread, 0.2, 1, 'solidFletchingSpread')
  assertInRange(parameters.energyCoreLength, 0.25, 0.85, 'energyCoreLength')
  assertInRange(parameters.energyShellWidth, 0.05, 0.5, 'energyShellWidth')
  assertInRange(parameters.energyTipSharpness, 0.2, 0.8, 'energyTipSharpness')
  assertInRange(parameters.crystalSpearTaper, 0.2, 0.8, 'crystalSpearTaper')
  assertInRange(parameters.crystalSpearThickness, 0.5, 1.5, 'crystalSpearThickness')
  assertInRange(parameters.crystalRefractionStrength, 0, 1, 'crystalRefractionStrength')
  assertInRange(parameters.crystalGlintStrength, 0, 1, 'crystalGlintStrength')
  assertInRange(parameters.crystalGlintSpeed, 0.25, 3, 'crystalGlintSpeed')
  assertInRange(parameters.crystalCoreScale, 0.5, 1.5, 'crystalCoreScale')
  assertInRange(parameters.crystalOrbitRadius, 0.75, 2.25, 'crystalOrbitRadius')
  assertInRange(parameters.crystalOrbitSpeed, 0.25, 3, 'crystalOrbitSpeed')
  const limits = projectileFrameLimits({ width: parameters.canvasWidth, height: parameters.canvasHeight })
  assertInRange(parameters.radius, 2, limits.maxRadius, 'radius')
  assertInRange(parameters.bodyLength, 4, limits.maxBodyLength, 'bodyLength')
  assertInRange(parameters.silhouetteVariation, 0, 1, 'silhouetteVariation')
  assertInRange(parameters.rotationDegrees, 0, 359, 'rotationDegrees')
  assertInRange(parameters.loopCycles, 1, MAX_LOOP_CYCLES, 'loopCycles')
  assertInRange(parameters.pulseAmount, 0, 1, 'pulseAmount')
  assertInRange(parameters.wobbleAmount, 0, 1, 'wobbleAmount')
  if (parameters.trailMode !== 'off' && parameters.trailMode !== 'fire' && parameters.trailMode !== 'energy') {
    throw new RangeError('trailMode is invalid.')
  }
  assertInRange(parameters.trailLength, 0, 1, 'trailLength')
  assertInRange(parameters.trailWidth, 1, parameters.radius, 'trailWidth')
  assertInRange(parameters.trailWave, 0, 1, 'trailWave')
  assertInRange(parameters.trailBreakup, 0, 1, 'trailBreakup')
  if (typeof parameters.sparksEnabled !== 'boolean') throw new RangeError('sparksEnabled must be a boolean.')
  assertInRange(parameters.sparkCount, 0, MAX_SPARK_COUNT, 'sparkCount')
  assertInRange(parameters.sparkSpread, 0, 1, 'sparkSpread')
  assertInRange(parameters.sparkSpacing, 0, 1, 'sparkSpacing')
  assertInRange(parameters.sparkFade, 0, 1, 'sparkFade')
  if (typeof parameters.afterimagesEnabled !== 'boolean') throw new RangeError('afterimagesEnabled must be a boolean.')
  assertInRange(parameters.afterimageCount, 0, MAX_AFTERIMAGE_COUNT, 'afterimageCount')
  assertInRange(parameters.afterimageSpacing, 0, 1, 'afterimageSpacing')
  assertInRange(parameters.afterimageDecay, 0, 1, 'afterimageDecay')
  if (parameters.bodyPalette.length < MIN_BODY_PALETTE_SIZE || parameters.bodyPalette.length > MAX_BODY_PALETTE_SIZE) {
    throw new RangeError(`bodyPalette must contain between ${MIN_BODY_PALETTE_SIZE} and ${MAX_BODY_PALETTE_SIZE} colors.`)
  }
  parameters.bodyPalette.forEach((color, index) => assertValidColor(color, `bodyPalette[${index}]`))
  if (parameters.energyPalette.length < MIN_ENERGY_PALETTE_SIZE || parameters.energyPalette.length > MAX_ENERGY_PALETTE_SIZE) {
    throw new RangeError(`energyPalette must contain between ${MIN_ENERGY_PALETTE_SIZE} and ${MAX_ENERGY_PALETTE_SIZE} colors.`)
  }
  parameters.energyPalette.forEach((color, index) => assertValidColor(color, `energyPalette[${index}]`))
}
