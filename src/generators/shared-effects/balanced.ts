/** Selects a stable angularly balanced subset from an ordered ring. */
export function selectBalancedIndices(total: number, requested: number, seed: number): number[] {
  const count = Math.min(total, Math.max(0, requested))
  if (count === 0) return []
  const phase = Math.abs(seed) % total
  return Array.from({ length: count }, (_, index) => (phase + Math.floor(index * total / count)) % total)
}

/** Returns the shortest absolute distance between two angles. */
export function angularDistance(first: number, second: number): number {
  return Math.abs(Math.atan2(Math.sin(first - second), Math.cos(first - second)))
}
