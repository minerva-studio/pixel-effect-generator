import { clamp01 } from '../../shared/pixel/rng'
import type { Palette } from './types'

/** Converts a normalized surface value into a valid palette index. */
export function paletteIndex(palette: Palette, value: number): number {
  return Math.min(palette.length - 1, Math.floor(clamp01(value) * palette.length))
}
