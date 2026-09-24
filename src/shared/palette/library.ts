import { hexToRgb, type RgbColor } from '../pixel/color'

const colors = (...hex: string[]): readonly RgbColor[] => hex.map(hexToRgb)

/** Built-in palettes are ordered from the brightest band to the darkest. */
export const PALETTE_COLORS = {
  flameGlow: colors('#FFFBC3', '#FFD744', '#FF8922', '#E73D1B', '#8D1F23'),
  irisBloom: colors('#F9F4F8', '#BFD3E6', '#9B83C8', '#473D68'),
  smokeEmber: colors('#FFE8A4', '#EE843E', '#A6776F', '#746070', '#483E52', '#2A2934'),
  aetherCyan: colors('#F4FAF9', '#B3D8E1', '#6BAFC3', '#365A78'),
  orchidCrystal: colors('#FBF4FA', '#D5B8E3', '#A47BC8', '#514069'),
  duskSteel: colors('#ECE9E4', '#A9A4AC', '#55505C'),
  runedSteel: colors('#F0E8E8', '#B5A3BA', '#5F536C'),
  retroBurst: colors('#FFFAE0', '#FFC948', '#F25F2C', '#692A34'),
} as const

export type BuiltinPaletteId = keyof typeof PALETTE_COLORS

/** Copies a built-in palette so editing one effect cannot mutate another. */
export function builtinPalette(id: BuiltinPaletteId): RgbColor[] {
  return PALETTE_COLORS[id].map((color) => ({ ...color }))
}

/** Applies only color counts and opacity constraints imposed by the target model. */
export function isPaletteCompatible(
  palette: readonly RgbColor[],
  minimum: number,
  maximum: number,
  opaque: boolean,
): boolean {
  return palette.length >= minimum && palette.length <= maximum
    && (!opaque || palette.every((color) => color.a === 255))
}
