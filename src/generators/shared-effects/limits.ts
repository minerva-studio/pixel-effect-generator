import type { FrameSize } from '../../shared/pixel/frame'
import { DEFAULT_CANVAS_SIZE } from './constants'
import type { SharedFrameLimits } from './types'

/** Shared per-family constants for canvas and frame-count bounds. */
export const MIN_CANVAS_SIZE = 16
export const MAX_CANVAS_SIZE = 512
export const MIN_FRAME_COUNT = 5
export const MAX_FRAME_COUNT = 24

/** Computes size-dependent limits for a centered effect. */
export function sharedFrameLimits(size: FrameSize): SharedFrameLimits {
  const halfMinimum = Math.floor(Math.min(size.width, size.height) / 2)
  const scale = Math.min(size.width, size.height) / DEFAULT_CANVAS_SIZE
  return {
    maxRadius: Math.max(2, halfMinimum),
    maxFragmentDistance: Math.max(1, Math.round(64 * scale)),
    maxTangentialDrift: Math.max(1, Math.round(32 * scale)),
    maxTongueLength: Math.max(2, Math.round(halfMinimum * 1.5)),
    maxTongueWidth: Math.max(1, Math.round(halfMinimum * 0.12)),
  }
}
