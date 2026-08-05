declare module 'gifenc' {
  export interface GifEncoder {
    writeFrame(
      index: Uint8Array,
      width: number,
      height: number,
      options?: {
        readonly palette?: readonly (readonly number[])[]
        readonly delay?: number
        readonly repeat?: number
        readonly transparent?: boolean
        readonly transparentIndex?: number
        readonly dispose?: number
        readonly first?: boolean
      },
    ): void
    finish(): void
    bytes(): Uint8Array
  }

  export function GIFEncoder(options?: { readonly auto?: boolean; readonly initialCapacity?: number }): GifEncoder
  export function quantize(
    rgba: Uint8Array | Uint8ClampedArray,
    maxColors: number,
    options?: Record<string, unknown>,
  ): number[][]
  export function applyPalette(
    rgba: Uint8Array | Uint8ClampedArray,
    palette: readonly (readonly number[])[],
    format?: string,
  ): Uint8Array
}
