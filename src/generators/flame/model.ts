import type { FrameSize } from '../../shared/pixel/frame'
import { assertValidColor, type RgbColor } from '../../shared/pixel/color'
import { builtinPalette } from '../../shared/palette/library'

export type FlameShape = 'candle' | 'torch' | 'campfire'
export const FLAME_SHAPES = ['candle', 'torch', 'campfire'] as const
export const MIN_CANVAS_SIZE = 16
export const MAX_CANVAS_SIZE = 512
export const MIN_FRAME_COUNT = 5
export const MAX_FRAME_COUNT = 24

/** A bottom-anchored flame. Pixel dimensions scale on resize; all other amounts are dimensionless. */
export interface FlameParameters {
  readonly canvasWidth: number
  readonly canvasHeight: number
  readonly frameCount: number
  readonly seed: number
  readonly shape: FlameShape
  readonly width: number
  readonly height: number
  readonly baseWidth: number
  /** Strength of upper-contour splitting within the advected flame field. */
  readonly fork: number
  readonly roughness: number
  readonly loopCycles: number
  readonly sway: number
  readonly flicker: number
  readonly flowSpeed: number
  /** Coupled silhouette and color-layer distortion, from gentle flow to vigorous curling. */
  readonly turbulence: number
  readonly coreSize: number
  readonly bandWarp: number
  /** Outer-shell erosion strength; permits a few detached flame chips independently of sparks. */
  readonly edgeBreakup: number
  readonly sparksEnabled: boolean
  readonly sparkCount: number
  readonly sparkSpread: number
  readonly sparkRise: number
  readonly palette: readonly RgbColor[]
}

/** Reserves room for the animated silhouette and its bottom anchor. */
export function flameFrameLimits(size: FrameSize) {
  return { width: Math.max(4, Math.floor((size.width - 4) / 1.4)), height: Math.max(4, Math.floor((size.height - 4) / 1.2)), sparkRise: size.height - 4 }
}

/** Shared bounds drive the controls and strict model validation. */
export function flameNumericBounds(p: Pick<FlameParameters, 'canvasWidth' | 'canvasHeight' | 'width'>): Record<Exclude<keyof FlameParameters, 'shape' | 'palette' | 'sparksEnabled'>, readonly [number, number, number]> {
  const limits = flameFrameLimits({ width: p.canvasWidth, height: p.canvasHeight })
  return {
    canvasWidth: [16, 512, 1], canvasHeight: [16, 512, 1], frameCount: [5, 24, 1], seed: [0, 0xffffffff, 1],
    width: [4, limits.width, 1], height: [4, limits.height, 1], baseWidth: [2, p.width, 1],
    fork: [0, 1, 0.01], roughness: [0, 1, 0.01], loopCycles: [1, 4, 1], sway: [0, 1, 0.01], flicker: [0, 1, 0.01],
    flowSpeed: [1, 4, 1], turbulence: [0, 1, 0.01], coreSize: [0, 1, 0.01], bandWarp: [0, 1, 0.01], edgeBreakup: [0, 1, 0.01],
    sparkCount: [0, 24, 1], sparkSpread: [0, 1, 0.01], sparkRise: [0, limits.sparkRise, 1],
  }
}

export const DEFAULT_FLAME_PARAMETERS: FlameParameters = {
  canvasWidth: 128, canvasHeight: 128, frameCount: 12, seed: 20260919, shape: 'torch',
  width: 44, height: 82, baseWidth: 22, fork: 0.65, roughness: 0.22,
  loopCycles: 1, sway: 0.4, flicker: 0.4, flowSpeed: 1, turbulence: 0.45,
  coreSize: 0.5, bandWarp: 0.4, edgeBreakup: 0.25,
  sparksEnabled: true, sparkCount: 4, sparkSpread: 0.35, sparkRise: 25,
  palette: builtinPalette('flameGlow'),
}

/** Rejects malformed projects and non-opaque palettes before rendering. */
export function assertValidFlameParameters(p: FlameParameters): void {
  if (!FLAME_SHAPES.includes(p.shape)) throw new RangeError('Invalid flame shape.')
  for (const [key, [min, max, step]] of Object.entries(flameNumericBounds(p))) {
    const value = p[key as keyof ReturnType<typeof flameNumericBounds>]
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (step === 1 && !Number.isInteger(value))) throw new RangeError(`Invalid flame ${key}.`)
  }
  if (typeof p.sparksEnabled !== 'boolean') throw new RangeError('Invalid sparksEnabled.')
  if (!Array.isArray(p.palette) || p.palette.length < 3 || p.palette.length > 6) throw new RangeError('Flame palette requires 3–6 colors.')
  for (const color of p.palette) {
    assertValidColor(color, 'flame.palette')
    if (color.a !== 255) throw new RangeError('Flame palette colors must be opaque.')
  }
}

/** Resizes pixel dimensions using the short-edge ratio and clamps dependent bounds. */
export function resizeFlameCanvas(p: FlameParameters, size: FrameSize, scaleEffect = true): FlameParameters {
  const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, Math.round(Number.isFinite(n) ? n : min)))
  const canvasWidth = clamp(size.width, 16, 512)
  const canvasHeight = clamp(size.height, 16, 512)
  const scale = scaleEffect ? Math.min(canvasWidth, canvasHeight) / Math.min(p.canvasWidth, p.canvasHeight) : 1
  const limits = flameFrameLimits({ width: canvasWidth, height: canvasHeight })
  const width = clamp(p.width * scale, 4, limits.width)
  return { ...p, canvasWidth, canvasHeight, width, height: clamp(p.height * scale, 4, limits.height), baseWidth: clamp(p.baseWidth * scale, 2, width), sparkRise: clamp(p.sparkRise * scale, 0, limits.sparkRise) }
}
