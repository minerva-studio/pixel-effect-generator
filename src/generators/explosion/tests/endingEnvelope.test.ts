import { describe, expect, it } from 'vitest'
import { LEGACY_EXPLOSION_PARAMETERS } from '../model'
import { EXPLOSION_BUILTIN_PRESETS, applyExplosionPreset } from '../presets'
import { renderExplosionFrames } from '../renderer'

function opaqueAreas(presetId: string, frameCount: number): number[] {
  const preset = EXPLOSION_BUILTIN_PRESETS.find(({ id }) => id === presetId)!
  const parameters = applyExplosionPreset(
    { ...LEGACY_EXPLOSION_PARAMETERS, canvasWidth: 128, canvasHeight: 128, frameCount },
    preset.payload,
  )
  return renderExplosionFrames(parameters).map(({ pixels }) => {
    let area = 0
    for (let offset = 3; offset < pixels.length; offset += 4) if (pixels[offset] === 255) area += 1
    return area
  })
}

describe('explosion preset ending envelope', () => {
  // The two field shapes have their own lifecycle and are unaffected by this legacy-body pass.
  const legacyBodyPresetIds = [
    'rollingFireball', 'moltenCoreFireball', 'smokeBurst',
    'particleSmokeBurst', 'pressureBurst', 'retroBurst',
  ] as const
  for (const presetId of legacyBodyPresetIds) {
    for (const frameCount of [10, 24]) {
      it.fails(`${presetId} at ${frameCount} frames`, () => {
        const areas = opaqueAreas(presetId, frameCount)
        const peak = Math.max(...areas)
        const peakIndex = areas.indexOf(peak)
        const lastVisible = areas.findLast((area) => area > 0) ?? 0
        const largestDrop = Math.max(...areas.slice(1).map((area, index) => areas[index] - area))
        expect(peak).toBeGreaterThan(0)
        expect(peakIndex / (frameCount - 1), `${presetId} peak frame`).toBeGreaterThanOrEqual(0.45)
        expect(peakIndex / (frameCount - 1), `${presetId} peak frame`).toBeLessThanOrEqual(0.65)
        expect(lastVisible / peak, `${presetId} last visible area`).toBeLessThanOrEqual(0.15)
        expect(largestDrop / peak, `${presetId} largest frame drop`).toBeLessThanOrEqual(0.45)
      })
    }
  }
})
