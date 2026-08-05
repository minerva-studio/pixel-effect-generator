/** Unity 6 hard limit for the longest atlas edge in pixels. */
export const UNITY_MAX_ATLAS_SIZE = 16384

/** Legal Unity 6 max texture sizes, rounded up to the next power of two. */
export const UNITY_TEXTURE_SIZE_STEPS = [
  32, 64, 128, 256, 512, 1024, 2048, 4096, 8192, 16384,
] as const

/**
 * Resolves the Unity `maxTextureSize` for an atlas: the longest edge rounded
 * up to the nearest legal power of two (32..16384). Throws for non-positive
 * dimensions and for atlases whose longest edge exceeds the Unity 6 limit.
 */
export function resolveUnityMaxTextureSize(width: number, height: number): number {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new RangeError('Atlas dimensions must be positive integers.')
  }
  const longestEdge = Math.max(width, height)
  if (longestEdge > UNITY_MAX_ATLAS_SIZE) {
    throw new RangeError(`Unity atlas edge exceeds ${UNITY_MAX_ATLAS_SIZE}px: ${longestEdge}px.`)
  }
  for (const size of UNITY_TEXTURE_SIZE_STEPS) {
    if (longestEdge <= size) {
      return size
    }
  }
  return UNITY_MAX_ATLAS_SIZE
}
