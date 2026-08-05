import { describe, expect, it } from 'vitest'
import { PREVIEW_ZOOM_OPTIONS, resolvePreviewSize, type PreviewZoom } from '../zoom'
import type { PixelFrame } from '../../pixel/frame'

describe('resolvePreviewSize', () => {
  it('computes exact integer zoom sizes without touching frames', () => {
    const frame: PixelFrame = { width: 64, height: 48, pixels: new Uint8ClampedArray(64 * 48 * 4) }
    expect(resolvePreviewSize(1, frame.width, frame.height, 640, 420)).toEqual({ width: 64, height: 48 })
    expect(resolvePreviewSize(2, frame.width, frame.height, 640, 420)).toEqual({ width: 128, height: 96 })
    expect(resolvePreviewSize(4, frame.width, frame.height, 640, 420)).toEqual({ width: 256, height: 192 })
    expect(resolvePreviewSize(8, frame.width, frame.height, 640, 420)).toEqual({ width: 512, height: 384 })
    expect(frame.width).toBe(64)
    expect(frame.height).toBe(48)
  })

  it('fits the longest side inside the given bounds while keeping aspect ratio', () => {
    expect(resolvePreviewSize('fit', 128, 128, 640, 420)).toEqual({ width: 420, height: 420 })
    expect(resolvePreviewSize('fit', 3072, 128, 640, 420)).toEqual({ width: 640, height: 27 })
    expect(resolvePreviewSize('fit', 128, 256, 640, 420)).toEqual({ width: 210, height: 420 })
  })

  it('fit upscales small frames to the bounds while preserving aspect ratio', () => {
    expect(resolvePreviewSize('fit', 1, 1, 640, 420)).toEqual({ width: 420, height: 420 })
    expect(resolvePreviewSize('fit', 16, 16, 640, 420)).toEqual({ width: 420, height: 420 })
  })

  it('rejects invalid frame dimensions', () => {
    expect(() => resolvePreviewSize(1, 0, 10, 640, 420)).toThrow(RangeError)
    expect(() => resolvePreviewSize('fit', 10, 12.5, 640, 420)).toThrow(RangeError)
  })

  it('exposes the shared zoom option list', () => {
    expect(PREVIEW_ZOOM_OPTIONS).toEqual(['fit', 1, 2, 4, 8])
    const option: PreviewZoom = 'fit'
    expect(option).toBe('fit')
  })
})
