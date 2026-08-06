import type { RgbColor } from '../../shared/pixel/color'

/** Writes one palette pixel with its own alpha inside the frame. */
export function writePixel(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
  color: RgbColor,
): void {
  if (x < 0 || y < 0 || x >= width || y >= height) return
  const offset = (y * width + x) * 4
  pixels[offset] = color.r
  pixels[offset + 1] = color.g
  pixels[offset + 2] = color.b
  pixels[offset + 3] = color.a
}

/** Fills a centered opaque disc. */
export function fillDisc(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  radius: number,
  color: RgbColor,
): void {
  const centerX = width / 2
  const centerY = height / 2
  for (let y = Math.floor(centerY - radius); y <= Math.ceil(centerY + radius); y += 1) {
    for (let x = Math.floor(centerX - radius); x <= Math.ceil(centerX + radius); x += 1) {
      if ((x + 0.5 - centerX) ** 2 + (y + 0.5 - centerY) ** 2 <= radius ** 2) {
        writePixel(pixels, width, height, x, y, color)
      }
    }
  }
}

/** Fills one square centered at a resolved pixel coordinate. */
export function fillSquare(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  centerX: number,
  centerY: number,
  size: number,
  color: RgbColor,
): void {
  const offset = Math.floor(size / 2)
  for (let y = centerY - offset; y < centerY - offset + size; y += 1) {
    for (let x = centerX - offset; x < centerX - offset + size; x += 1) {
      writePixel(pixels, width, height, x, y, color)
    }
  }
}

/** Fills one diamond-shaped shard centered at a resolved pixel coordinate. */
export function fillDiamond(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  centerX: number,
  centerY: number,
  size: number,
  color: RgbColor,
): void {
  const offset = Math.floor(size / 2)
  for (let y = centerY - offset; y <= centerY + offset; y += 1) {
    for (let x = centerX - offset; x <= centerX + offset; x += 1) {
      if (Math.abs(x - centerX) + Math.abs(y - centerY) <= offset) {
        writePixel(pixels, width, height, x, y, color)
      }
    }
  }
}
