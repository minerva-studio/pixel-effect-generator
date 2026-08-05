import { smoothStep } from '../../shared/pixel/rng'
import { fillDisc } from './output'
import type { Palette, SharedCoreParameters } from './types'

/** Draws the short-lived hot core at the active mode's impact end. */
export function renderCore(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  palette: Palette,
  mode: 'explosion' | 'implosion',
  core: SharedCoreParameters,
  time: number,
): void {
  if (!core.enabled || core.radius === 0) return
  const coreTime = mode === 'explosion' ? time : 1 - time
  if (coreTime >= core.duration) return
  const radius = Math.max(0.5, core.radius * (1 - smoothStep(coreTime / core.duration)))
  fillDisc(pixels, width, height, radius, palette[0])
}
