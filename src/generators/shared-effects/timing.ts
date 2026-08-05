import { clamp01, easeOutCubic, lerp, smoothStep } from '../../shared/pixel/rng'
import type { EffectMode, MotionCurve, SharedMotionParameters } from './types'

/** Maps a motion curve choice onto a formation easing exponent. */
export function formationExponent(curve: MotionCurve): number {
  switch (curve) {
    case 'crisp': return 2.4
    case 'balanced': return 1.5
    case 'drifting': return 0.9
  }
}

/**
 * Resolves the shared formation growth at one lifecycle point: eases to full
 * size during formation, holds there, then remains full while the surface
 * dissolves. Implosion runs the same timeline backwards.
 */
export function formationGrowth(
  mode: EffectMode,
  motion: SharedMotionParameters,
  lifecycle: number,
  delay = 0,
): number {
  const local = clamp01((lifecycle - delay) / Math.max(0.01, motion.formationDuration - delay))
  return easeOutCubic(local ** formationExponent(motion.motionCurve))
}

/** Resolves the active lifecycle from chronological time. */
export function lifecycleAt(mode: EffectMode, time: number): number {
  return mode === 'explosion' ? time : 1 - time
}

/** Resolves the shared dissolve amount after the configured start point. */
export function dissolveAmount(motion: SharedMotionParameters, lifecycle: number): number {
  return lifecycle <= motion.dissolveStart
    ? 0
    : clamp01((lifecycle - motion.dissolveStart) / (1 - motion.dissolveStart))
}

/** Reconstructs the former radial growth curve for byte-stable Retro Burst. */
export function legacyRadialProgress(mode: EffectMode, time: number): number {
  const speed = 0.62
  const exponent = lerp(1.8, 0.42, speed)
  const outward = clamp01(time ** exponent)
  return mode === 'explosion' ? easeOutCubic(outward) : 1 - smoothStep(outward)
}
