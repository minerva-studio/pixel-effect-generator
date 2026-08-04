import { clamp01, hashUnit, lerp, smoothStep } from '../../shared/pixel/rng'
import type { SlashParameters } from './model'

const BAYER_4X4 = [
  0, 8, 2, 10,
  12, 4, 14, 6,
  3, 11, 1, 9,
  15, 7, 13, 5,
] as const

/** Returns the normalized threshold for one cell in the fixed 4x4 Bayer matrix. */
export function bayerThreshold(x: number, y: number): number {
  const matrixX = positiveModulo(Math.floor(x), 4)
  const matrixY = positiveModulo(Math.floor(y), 4)
  return (BAYER_4X4[matrixY * 4 + matrixX] + 0.5) / 16
}

/** Resolves the seeded dissolution threshold for the active dissolve mode. */
export function dissolveThreshold(parameters: SlashParameters, x: number, y: number, radius: number): number {
  switch (parameters.dissolveMode) {
    case 'ordered':
      return bayerThreshold(x, y)
    case 'clusteredNoise':
      return clusteredNoiseThreshold(parameters.seed, x, y)
    case 'directionalStreaks':
      return directionalStreakThreshold(parameters.seed, x, y, radius)
  }
}

/**
 * Combines smooth low-frequency value noise with a fine hash detail so the
 * dissolve edge forms irregular contiguous blocks instead of a fixed grid.
 */
function clusteredNoiseThreshold(seed: number, x: number, y: number): number {
  const noiseScale = 0.26
  const coarse = valueNoise(seed, x / 10, y / 10)
  const fine = hashUnit(seed ^ 0x5f3759df, x, y)
  const value = 0.3 + coarse * noiseScale + fine * 0.14
  return smoothStep(clamp01(value))
}

/**
 * Produces stable bands elongated along the sweep direction in arc coordinates;
 * the pattern varies across the arc radius so strips read as speed tears.
 */
function directionalStreakThreshold(seed: number, x: number, y: number, radius: number): number {
  const radialCell = radius / 2.4
  const bandStart = Math.floor(radialCell)
  const local = radialCell - bandStart
  const taper = 0.62
  const current = streakBandValue(seed, bandStart)
  const next = streakBandValue(seed, bandStart + 1)
  const blend = smoothStep(clamp01((local - 0.5) / taper + 0.5))
  const arcVariation = hashUnit(seed ^ 0xa5a5a5a5, x, y) * 0.08
  return clamp01(current + (next - current) * blend + arcVariation)
}

/** Samples one deterministic streak band's width and central threshold. */
function streakBandValue(seed: number, bandIndex: number): number {
  const width = 1 + hashUnit(seed ^ 0x9e3779b9, bandIndex, 0) * 1.6
  const center = 0.3 + hashUnit(seed ^ 0x85ebca6b, bandIndex, 1) * 0.62
  return center / Math.sqrt(width)
}

/** Bilinearly interpolated value noise with deterministic cell hashes. */
export function valueNoise(seed: number, x: number, y: number): number {
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const fx = x - x0
  const fy = y - y0
  const topLeft = hashUnit(seed, x0, y0)
  const topRight = hashUnit(seed, x0 + 1, y0)
  const bottomLeft = hashUnit(seed, x0, y0 + 1)
  const bottomRight = hashUnit(seed, x0 + 1, y0 + 1)
  return lerp(
    lerp(topLeft, topRight, smoothStep(fx)),
    lerp(bottomLeft, bottomRight, smoothStep(fx)),
    smoothStep(fy),
  )
}

/** Decides whether the active edge mode removes this outer-edge pixel. */
export function edgeBreakupCut(
  parameters: SlashParameters,
  directedProgress: number,
  radius: number,
  radialProgress: number,
): boolean {
  switch (parameters.edgeBreakupMode) {
    case 'blockChips': {
      if (radialProgress < 1 - parameters.edgeDepth) {
        return false
      }
      const arcCell = Math.floor(directedProgress * parameters.radius / 2)
      const radialCell = Math.floor((radius - (parameters.radius - parameters.thickness)) / 2)
      return hashUnit(parameters.seed, arcCell, radialCell) < parameters.edgeBreakup
    }
    case 'jaggedContour': {
      if (parameters.edgeBreakup <= 0) {
        return false
      }
      const arcDistancePixels = directedProgress * parameters.radius
      const inset = jaggedContourInset(parameters.seed, arcDistancePixels, parameters.edgeBreakup, parameters.edgeDepth)
      return radialProgress >= 1 - inset
    }
    case 'slashCuts': {
      if (parameters.edgeBreakup <= 0) {
        return false
      }
      const arcDistancePixels = directedProgress * parameters.radius
      return radialProgress >= 1 - slashCutDepth(parameters.seed, arcDistancePixels, parameters.edgeBreakup, parameters.edgeDepth)
    }
  }
}

/** Returns a continuous jagged inset sampled in local arc-length pixels. */
export function jaggedContourInset(seed: number, arcDistancePixels: number, edgeBreakup: number, edgeDepth: number): number {
  const noise = 0.55 + 0.45 * valueNoise(seed ^ 0x1234567, arcDistancePixels / 4, 0)
  return clamp01(noise) * edgeBreakup * edgeDepth
}

/**
 * Samples the sparse, wedge-shaped cut depth at one local arc position. Cuts are
 * gate-hashed so most arc cells remain intact, and depth is capped by
 * `edgeDepth` at maximum intensity.
 */
export function slashCutDepth(seed: number, arcDistancePixels: number, edgeBreakup: number, edgeDepth: number): number {
  const arcCells = arcDistancePixels / 8
  const cell = Math.floor(arcCells)
  const local = arcCells - cell
  let depth = 0
  for (let offset = -1; offset <= 1; offset += 1) {
    const candidateCell = cell + offset
    const gate = hashUnit(seed ^ 0x6a09e667, candidateCell, 0)
    if (gate >= 0.58) {
      continue
    }
    const centerOffset = (hashUnit(seed ^ 0xbb67ae85, candidateCell, 1) - 0.5) * 2.2
    const distanceFromCenter = Math.abs(local - offset - centerOffset)
    if (distanceFromCenter >= 1) {
      continue
    }
    const wedgeWidth = 0.45 + hashUnit(seed ^ 0x3c6ef372, candidateCell, 2) * 0.55
    const coreDepth = 0.35 + hashUnit(seed ^ 0xa54ff53a, candidateCell, 3) * 0.55
    const falloff = 1 - smoothStep(clamp01(distanceFromCenter / wedgeWidth))
    const candidate = coreDepth * (0.55 + 0.45 * falloff)
    depth = Math.max(depth, candidate)
  }
  return clamp01(depth) * edgeBreakup * edgeDepth
}

function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor
}
