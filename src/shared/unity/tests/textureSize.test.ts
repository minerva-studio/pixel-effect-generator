import { describe, expect, it } from 'vitest'
import { UNITY_MAX_ATLAS_SIZE, resolveUnityMaxTextureSize } from '../textureSize'

describe('resolveUnityMaxTextureSize', () => {
  it('rounds the longest edge up to the nearest legal power of two', () => {
    expect(resolveUnityMaxTextureSize(32, 32)).toBe(32)
    expect(resolveUnityMaxTextureSize(31, 16)).toBe(32)
    expect(resolveUnityMaxTextureSize(1024, 128)).toBe(1024)
    expect(resolveUnityMaxTextureSize(2048, 512)).toBe(2048)
    expect(resolveUnityMaxTextureSize(3072, 128)).toBe(4096)
    expect(resolveUnityMaxTextureSize(12288, 512)).toBe(16384)
    expect(resolveUnityMaxTextureSize(16384, 1)).toBe(16384)
  })

  it('treats the smaller edge as irrelevant when it is not the longest', () => {
    expect(resolveUnityMaxTextureSize(128, 1024)).toBe(1024)
    expect(resolveUnityMaxTextureSize(1, 64)).toBe(64)
  })

  it('rejects atlases beyond the Unity 6 limit', () => {
    expect(() => resolveUnityMaxTextureSize(16385, 128)).toThrow(RangeError)
    expect(() => resolveUnityMaxTextureSize(128, 16385)).toThrow(RangeError)
    expect(() => resolveUnityMaxTextureSize(20000, 20000)).toThrow(/16384/)
  })

  it('rejects non-positive and non-integer dimensions', () => {
    expect(() => resolveUnityMaxTextureSize(0, 128)).toThrow(RangeError)
    expect(() => resolveUnityMaxTextureSize(128, -1)).toThrow(RangeError)
    expect(() => resolveUnityMaxTextureSize(12.5, 128)).toThrow(RangeError)
    expect(() => resolveUnityMaxTextureSize(NaN, 128)).toThrow(RangeError)
    expect(() => resolveUnityMaxTextureSize(Infinity, 128)).toThrow(RangeError)
  })

  it('exposes the fixed 16384 px Unity 6 limit', () => {
    expect(UNITY_MAX_ATLAS_SIZE).toBe(16384)
  })
})
