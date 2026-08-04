import type { PixelFrame } from './frame'

/** Packs equal-sized frames from left to right into one RGBA sprite sheet. */
export function packHorizontalSheet(frames: readonly PixelFrame[]): PixelFrame {
  if (frames.length === 0) {
    throw new RangeError('At least one frame is required.')
  }

  const { width, height } = frames[0]
  const sheetWidth = width * frames.length
  const pixels = new Uint8ClampedArray(sheetWidth * height * 4)

  for (let frameIndex = 0; frameIndex < frames.length; frameIndex += 1) {
    const frame = frames[frameIndex]
    if (frame.width !== width || frame.height !== height) {
      throw new RangeError('All frames must have the same dimensions.')
    }

    for (let y = 0; y < height; y += 1) {
      const sourceStart = y * width * 4
      const sourceEnd = sourceStart + width * 4
      const destinationStart = (y * sheetWidth + frameIndex * width) * 4
      pixels.set(frame.pixels.subarray(sourceStart, sourceEnd), destinationStart)
    }
  }

  return { width: sheetWidth, height, pixels }
}
