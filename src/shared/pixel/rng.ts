/** Creates a portable xorshift32 source that yields unsigned 32-bit values. */
export function createXorshift32(seed: number): () => number {
  let state = seed >>> 0
  if (state === 0) {
    state = 0x6d2b79f5
  }
  return () => {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    return state >>> 0
  }
}

/** Deterministic unsigned integer hash in the unit interval for grid sampling. */
export function hashUnit(seed: number, x: number, y: number): number {
  let value = (seed ^ Math.imul(x, 0x45d9f3b) ^ Math.imul(y, 0x119de1f3)) >>> 0
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b)
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b)
  return ((value ^ (value >>> 16)) >>> 0) / 0x100000000
}

/** Clamps a number to the inclusive unit interval. */
export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

/** Linear interpolation between two numbers. */
export function lerp(start: number, end: number, progress: number): number {
  return start + (end - start) * progress
}

/** Smooth cubic step for interpolated noise and timing curves. */
export function smoothStep(value: number): number {
  return value * value * (3 - 2 * value)
}

/** Ease-out cubic timing curve used for the sweep head. */
export function easeOutCubic(value: number): number {
  return 1 - (1 - value) ** 3
}

/** Resolves a value into the non-negative range of a circular measure. */
export function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor
}
