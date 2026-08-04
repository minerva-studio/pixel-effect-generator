/** One equal-sized RGBA raster frame shared by every generator module. */
export interface PixelFrame {
  readonly width: number
  readonly height: number
  readonly pixels: Uint8ClampedArray
}
