/** One equal-sized RGBA raster frame shared by every generator module. */
export interface PixelFrame {
  readonly width: number
  readonly height: number
  readonly pixels: Uint8ClampedArray
}

/** Shared pixel dimension shape for generators that expose dynamic canvas sizing. */
export interface FrameSize {
  readonly width: number
  readonly height: number
}
