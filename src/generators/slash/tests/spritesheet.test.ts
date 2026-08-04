import { describe, expect, it } from 'vitest'
import { DEFAULT_SLASH_PARAMETERS, FRAME_SIZE } from '../model'
import { renderSlashFrames } from '../renderer'
import { packHorizontalSheet } from '../../../shared/pixel/spritesheet'
import type { PixelFrame } from '../../../shared/pixel/frame'

describe('packHorizontalSheet', () => {
  it('packs frames from left to right without changing their pixels', () => {
    const frames = renderSlashFrames({ ...DEFAULT_SLASH_PARAMETERS, frameCount: 5 })
    const sheet = packHorizontalSheet(frames)

    expect(sheet.width).toBe(FRAME_SIZE * frames.length)
    expect(sheet.height).toBe(FRAME_SIZE)
    for (let frameIndex = 0; frameIndex < frames.length; frameIndex += 1) {
      expect(extractFrame(sheet, frameIndex)).toEqual(Array.from(frames[frameIndex].pixels))
    }
  })
})

function extractFrame(sheet: PixelFrame, frameIndex: number): number[] {
  const pixels: number[] = []
  for (let y = 0; y < sheet.height; y += 1) {
    const start = (y * sheet.width + frameIndex * FRAME_SIZE) * 4
    pixels.push(...sheet.pixels.subarray(start, start + FRAME_SIZE * 4))
  }
  return pixels
}
