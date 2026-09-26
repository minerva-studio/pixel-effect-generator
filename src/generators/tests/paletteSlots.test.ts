import { describe, expect, it } from 'vitest'
import type { PaletteSlot } from '../contract'
import type { RgbColor } from '../../shared/pixel/color'
import '../registry'
import { explosionModule } from '../explosion/module'
import { bloomModule } from '../energy-bloom/module'
import { fireballModule } from '../fireball/module'
import { flameModule } from '../flame/module'
import { projectileModule } from '../projectile/module'
import { slashModule } from '../slash/module'
import { applyPreservingColors } from '../paletteSlots'

describe('generator palette slots', () => {
  it('round-trips every registered color slot without changing its values', () => {
    verifySlots('slash', slashModule.defaultParameters, slashModule.paletteSlots)
    verifySlots('explosion', explosionModule.defaultParameters, explosionModule.paletteSlots)
    verifySlots('energyBloom', bloomModule.defaultParameters, bloomModule.paletteSlots)
    verifySlots('fireball', fireballModule.defaultParameters, fireballModule.paletteSlots)
    verifySlots('flame', flameModule.defaultParameters, flameModule.paletteSlots)
    verifySlots('projectile', projectileModule.defaultParameters, projectileModule.paletteSlots)
  })

  it('preserves only declared color fields when applying new parameters', () => {
    type Parameters = { readonly color: readonly RgbColor[]; readonly strength: number }
    const current: Parameters = { color: [{ r: 10, g: 20, b: 30, a: 40 }], strength: 2 }
    const next: Parameters = { color: [{ r: 90, g: 80, b: 70, a: 60 }], strength: 9 }
    const slots: readonly PaletteSlot<Parameters>[] = [{
      id: 'color', labelKey: 'controls.editColors', minimum: 1, maximum: 1,
      read: (parameters) => parameters.color,
      write: (parameters, color) => ({ ...parameters, color }),
    }]
    expect(applyPreservingColors(slots, current, next)).toEqual({ color: current.color, strength: 9 })
  })
})

function verifySlots<Parameters>(id: string, parameters: Parameters, slots: readonly PaletteSlot<Parameters>[]) {
  for (const slot of slots) {
    const colors = slot.read(parameters).map((color) => ({ ...color, r: (color.r + 17) % 256 }))
    const updated = slot.write(parameters, colors)
    expect(slot.read(updated), `${id}.${slot.id}`).toEqual(colors)
  }
}
