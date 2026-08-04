export { slashGenerator, slashModule, SLASH_CATEGORIES } from './module'
export type { SlashCategory } from './module'
export {
  DEFAULT_SLASH_PARAMETERS,
  FRAME_SIZE,
  MAX_FRAME_COUNT,
  MAX_SWEEP_DEGREES,
  MIN_FRAME_COUNT,
  assertValidParameters,
} from './model'
export type {
  DissolveMode,
  EdgeBreakupMode,
  FragmentMode,
  SlashDirection,
  SlashParameters,
} from './model'
export { renderSlashFrames, visibleDirectedProgress } from './renderer'
export { bayerThreshold, dissolveThreshold, edgeBreakupCut, jaggedContourInset, slashCutDepth, valueNoise } from './breakup'
export { generateFragments, integerLinePoints, renderFragments, writePixel } from './fragments'
export type { FragmentDescriptor } from './fragments'
export { colorBandIndex, insertPaletteColor, removePaletteColor } from './palette'
