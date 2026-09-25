import type { RgbColor } from '../../shared/pixel/color'

/** Fits an existing ordered color ramp to the fireball renderer's fixed band count. */
export function fitFireballPalette(source: readonly RgbColor[], count: number): RgbColor[] {
  if (source.length < 2 || count < 2) throw new RangeError('A palette needs at least two colors.')
  return Array.from({ length: count }, (_, index) => {
    const position = index * (source.length - 1) / (count - 1)
    const left = source[Math.floor(position)]
    const right = source[Math.ceil(position)]
    const mix = position - Math.floor(position)
    return {
      r: Math.round(left.r + (right.r - left.r) * mix),
      g: Math.round(left.g + (right.g - left.g) * mix),
      b: Math.round(left.b + (right.b - left.b) * mix),
      a: Math.round(left.a + (right.a - left.a) * mix),
    }
  })
}
