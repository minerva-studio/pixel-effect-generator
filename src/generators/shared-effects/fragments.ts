import { clamp01, createXorshift32, easeOutCubic, hashUnit, smoothStep } from '../../shared/pixel/rng'
import { fillDiamond, fillSquare } from './output'
import type { FragmentMaterial, Palette, SharedFragmentParameters } from './types'

/** Stable descriptor for one deterministic debris particle. */
export interface FragmentDescriptor {
  readonly angle: number
  readonly distanceScale: number
  readonly tangent: number
  readonly size: number
  readonly colorIndex: number
  readonly phase: number
}

/** Creates stable fragment descriptors once per animation. */
export function generateFragments(
  palette: Palette,
  seed: number,
  fragments: SharedFragmentParameters,
): FragmentDescriptor[] {
  if (!fragments.enabled) return []
  const random = createXorshift32(seed ^ 0xa341316c)
  const unit = () => random() / 0x100000000
  return Array.from({ length: fragments.count }, () => ({
    angle: unit() * Math.PI * 2,
    distanceScale: 0.55 + unit() * 0.65,
    tangent: unit() * 2 - 1,
    size: fragments.minSize + Math.floor(unit() * (fragments.maxSize - fragments.minSize + 1)),
    colorIndex: Math.min(palette.length - 1, 1 + Math.floor(unit() * (palette.length - 1))),
    phase: unit() * 0.18,
  }))
}

/**
 * Draws fragments along outward or inward radial paths. Char material draws
 * square debris; shard material draws the same flight model as diamonds.
 */
export function renderFragments(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  palette: Palette,
  mode: 'explosion' | 'implosion',
  fragments: SharedFragmentParameters,
  descriptors: readonly FragmentDescriptor[],
  bodyRadius: number,
  material: FragmentMaterial,
  seed: number,
  time: number,
): void {
  const centerX = width / 2
  const centerY = height / 2
  descriptors.forEach((fragment, index) => {
    const localTime = clamp01((time - fragment.phase) / fragments.lifetime)
    const motion = mode === 'explosion' ? easeOutCubic(localTime) : 1 - smoothStep(localTime)
    const distance = (bodyRadius * 0.22 + fragments.travelDistance * fragment.distanceScale) * motion
    const tangentOffset = fragments.tangentialDrift * fragment.tangent * Math.sin(localTime * Math.PI)
    const x = Math.round(centerX + Math.cos(fragment.angle) * distance - Math.sin(fragment.angle) * tangentOffset)
    const y = Math.round(centerY + Math.sin(fragment.angle) * distance + Math.cos(fragment.angle) * tangentOffset)
    const visible = mode === 'explosion'
      ? localTime < 1 && hashUnit(seed, index, Math.floor(localTime * 8)) > localTime * 0.38
      : localTime > 0 && hashUnit(seed, index, Math.floor(localTime * 8)) > (1 - localTime) * 0.2
    if (visible) {
      if (material === 'shard') {
        fillDiamond(pixels, width, height, x, y, fragment.size, palette[fragment.colorIndex])
      } else {
        fillSquare(pixels, width, height, x, y, fragment.size, palette[fragment.colorIndex])
      }
    }
  })
}
