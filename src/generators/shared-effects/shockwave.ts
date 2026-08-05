import { clamp01, easeOutCubic, lerp, smoothStep } from '../../shared/pixel/rng'
import { paletteIndex } from './palette'
import { writePixel } from './output'
import type { Palette, SharedShockwaveParameters } from './types'

/**
 * Draws one complete central ring or a compound set of rings that chase each
 * other outward. Rings may carry a radial gradient across their band and can
 * be elliptically squashed along one axis. The wave consumes only the body
 * radius and timing, so it never perturbs the selected body silhouette.
 */
export function renderShockwave(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  palette: Palette,
  mode: 'explosion' | 'implosion',
  bodyRadius: number,
  shockwave: SharedShockwaveParameters,
  time: number,
): void {
  if (shockwave.mode === 'none') return
  const local = (time - shockwave.startTime) / shockwave.duration
  if (local < 0 || local > 1) return
  if (shockwave.mode === 'ring' && shockwave.colorMode === 'flat' && shockwave.squash === 0) {
    renderFlatCircularRing(pixels, width, height, palette, mode, bodyRadius, shockwave, local)
    return
  }
  renderCompoundShockwave(pixels, width, height, palette, mode, bodyRadius, shockwave, local)
}

/** Legacy circular single-ring path kept byte-for-byte for retro presets. */
function renderFlatCircularRing(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  palette: Palette,
  mode: 'explosion' | 'implosion',
  bodyRadius: number,
  shockwave: SharedShockwaveParameters,
  local: number,
): void {
  const baseProgress = easeOutCubic(clamp01(local ** lerp(1.6, 0.5, 0.72)))
  const progress = mode === 'explosion' ? baseProgress : 1 - smoothStep(baseProgress)
  const radius = bodyRadius * lerp(shockwave.startRadiusScale, shockwave.endRadiusScale, progress)
  const centerX = width / 2
  const centerY = height / 2
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const dx = x + 0.5 - centerX
      const dy = y + 0.5 - centerY
      if (Math.abs(Math.hypot(dx, dy) - radius) > shockwave.thickness / 2) continue
      writePixel(pixels, width, height, x, y, palette[Math.min(1, palette.length - 1)])
    }
  }
}

/**
 * Draws the squashed, gradient-capable ring path. Every ring shares the same
 * squash axis; multi-ring waves delay each later ring so they chase the first
 * one and converge on the same radius path at the end.
 */
function renderCompoundShockwave(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  palette: Palette,
  mode: 'explosion' | 'implosion',
  bodyRadius: number,
  shockwave: SharedShockwaveParameters,
  local: number,
): void {
  const centerX = width / 2
  const centerY = height / 2
  const ringCount = shockwave.mode === 'multiRing'
    ? Math.max(1, Math.min(4, shockwave.ringCount))
    : 1
  const delayStep = shockwave.ringSpacing * 0.6 / Math.max(1, ringCount - 1)
  const squash = shockwave.squash
  const angle = -shockwave.squashAngle / 180 * Math.PI
  const cosAngle = Math.cos(angle)
  const sinAngle = Math.sin(angle)
  const verticalScale = squash > 0 ? 1 / (1 - squash * 0.4) : 1
  const flatColor = palette[Math.min(1, palette.length - 1)]
  const gradient = shockwave.colorMode === 'gradient'
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const dx = x + 0.5 - centerX
      const dy = y + 0.5 - centerY
      const distance = squash > 0
        ? Math.hypot(dx * cosAngle - dy * sinAngle, (dx * sinAngle + dy * cosAngle) * verticalScale)
        : Math.hypot(dx, dy)
      for (let ring = 0; ring < ringCount; ring += 1) {
        const delay = ring * delayStep
        const ringLocal = delay === 0 ? local : (local - delay) / (1 - delay)
        if (ringLocal <= 0) continue
        const baseProgress = easeOutCubic(clamp01(ringLocal ** lerp(1.6, 0.5, 0.72)))
        const progress = mode === 'explosion' ? baseProgress : 1 - smoothStep(baseProgress)
        const radius = bodyRadius * lerp(shockwave.startRadiusScale, shockwave.endRadiusScale, progress)
        if (Math.abs(distance - radius) > shockwave.thickness / 2) continue
        const color = gradient
          ? palette[paletteIndex(palette, (radius + shockwave.thickness / 2 - distance) / shockwave.thickness)]
          : flatColor
        writePixel(pixels, width, height, x, y, color)
        break
      }
    }
  }
}
