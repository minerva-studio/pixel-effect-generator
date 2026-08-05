import { clamp01 } from '../../shared/pixel/rng'
import { selectBalancedIndices } from './balanced'
import { writePixel } from './output'
import type { LobeView, Palette, SharedTongueParameters, TongueMaterial } from './types'

/**
 * Draws filled tapered ribbons from an angularly balanced set of body tips.
 * Every material shares the same geometry: balanced direction selection,
 * launch from the resolved tip, filled tapering, and root overlap over the
 * body. Fire jets use warm roots and dark tips; energy tongues follow the
 * active family palette along the petal or star direction.
 */
export function renderTongues(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  palette: Palette,
  mode: 'explosion' | 'implosion',
  tongues: SharedTongueParameters,
  lobes: readonly LobeView[],
  material: TongueMaterial,
  seed: number,
  dissolve: number,
  time: number,
): void {
  if (!tongues.enabled || tongues.length === 0 || lobes.length === 0) return
  const selected = selectBalancedIndices(lobes.length, Math.min(tongues.count, lobes.length), seed ^ 0x7a11)
  const centerX = width / 2
  const centerY = height / 2
  selected.forEach((index) => {
    const lobe = lobes[index]
    if (lobe.growth < 0.12 || lobe.tipDistance <= 0) return
    const lengthScale = 1 + lobe.tongueNoise * tongues.variation * 0.3
    const extent = tongues.length * lobe.growth * (1 - dissolve) * lengthScale
    if (extent < 1) return
    const overlap = Math.min(2, tongues.width)
    const tipX = centerX + Math.cos(lobe.angle) * lobe.tipDistance
    const tipY = centerY + Math.sin(lobe.angle) * lobe.tipDistance
    for (let distance = -overlap; distance <= extent; distance += 0.75) {
      const progress = clamp01(distance / extent)
      const curveOffset = Math.sin(progress * Math.PI) * tongues.curvature * extent * 0.16 * lobe.curveSign
      const halfWidth = Math.max(0, tongues.width * 0.5 * (1 - progress) ** 0.75)
      const centerLineX = tipX + Math.cos(lobe.angle) * distance - Math.sin(lobe.angle) * curveOffset
      const centerLineY = tipY + Math.sin(lobe.angle) * distance + Math.cos(lobe.angle) * curveOffset
      const colorProgress = material === 'fire'
        ? clamp01(progress * 0.9)
        : clamp01(progress * 0.72 + 0.12)
      const colorIndex = Math.min(palette.length - 1, 1 + Math.floor(colorProgress * (palette.length - 1)))
      for (let across = -Math.ceil(halfWidth); across <= Math.ceil(halfWidth); across += 1) {
        if (Math.abs(across) > halfWidth + 0.2) continue
        const x = Math.round(centerLineX - Math.sin(lobe.angle) * across)
        const y = Math.round(centerLineY + Math.cos(lobe.angle) * across)
        writePixel(pixels, width, height, x, y, palette[colorIndex])
      }
    }
  })
}
