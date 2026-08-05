import * as UPNG from 'upng-js'
import type { PixelFrame } from './frame'

/** upng-js runtime accepts an extra `forbidPlte` flag missing from its types. */
type UpngEncodeWithFlags = (
  imgs: ArrayBuffer[],
  width: number,
  height: number,
  colors: number,
  delays?: number[],
  forbidPlte?: boolean,
) => ArrayBuffer

const encodeRgba = UPNG.encode as unknown as UpngEncodeWithFlags

/**
 * Encodes one RGBA frame as a lossless PNG without touching an HTML canvas.
 * The source pixel buffer is copied first so the encoder never mutates frames.
 * Identical frames produce identical bytes.
 */
export function encodePng(frame: PixelFrame): Uint8Array {
  if (!Number.isInteger(frame.width) || !Number.isInteger(frame.height) || frame.width <= 0 || frame.height <= 0) {
    throw new RangeError('Frame dimensions must be positive integers.')
  }
  if (frame.pixels.length !== frame.width * frame.height * 4) {
    throw new RangeError('Pixel buffer length does not match frame dimensions.')
  }
  const copy = new Uint8Array(frame.pixels)
  const encoded = encodeRgba([copy.buffer], frame.width, frame.height, 0, undefined, true)
  return new Uint8Array(encoded)
}
