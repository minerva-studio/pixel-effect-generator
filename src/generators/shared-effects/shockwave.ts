import { clamp01, easeOutCubic, lerp, smoothStep } from '../../shared/pixel/rng'
import { angularDistance, selectBalancedIndices } from './balanced'
import { writePixel } from './output'
import type { Palette, SharedShockwaveParameters } from './types'

/**
 * Draws either balanced central arc sectors or one complete central ring.
 * The wave consumes only the body radius, timing, and direction list, so it
 * never perturbs the selected body silhouette.
 */
export function renderShockwave(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  palette: Palette,
  mode: 'explosion' | 'implosion',
  bodyRadius: number,
  shockwave: SharedShockwaveParameters,
  directions: readonly number[],
  seed: number,
  time: number,
): void {
  if (shockwave.mode === 'none') return
  const local = (time - shockwave.startTime) / shockwave.duration
  if (local < 0 || local > 1) return
  const baseProgress = easeOutCubic(clamp01(local ** lerp(1.6, 0.5, 0.72)))
  const progress = mode === 'explosion' ? baseProgress : 1 - smoothStep(baseProgress)
  const radius = bodyRadius * lerp(shockwave.startRadiusScale, shockwave.endRadiusScale, progress)
  const centerX = width / 2
  const centerY = height / 2
  const arcIndices = shockwave.mode === 'lobeArcs'
    ? selectBalancedIndices(directions.length, Math.min(shockwave.arcCount, directions.length), seed ^ 0x4e91)
    : []
  const halfSpan = shockwave.arcSpan / 360 * Math.PI
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const dx = x + 0.5 - centerX
      const dy = y + 0.5 - centerY
      if (Math.abs(Math.hypot(dx, dy) - radius) > shockwave.thickness / 2) continue
      if (shockwave.mode === 'lobeArcs') {
        const angle = Math.atan2(dy, dx)
        if (!arcIndices.some((index) => angularDistance(angle, directions[index]) <= halfSpan)) continue
      }
      writePixel(pixels, width, height, x, y, palette[Math.min(1, palette.length - 1)])
    }
  }
}
