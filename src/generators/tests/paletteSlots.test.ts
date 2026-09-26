import { describe, expect, it } from 'vitest'
import type { PaletteSlot } from '../contract'
import '../registry'
import { explosionModule } from '../explosion/module'
import { bloomModule } from '../energy-bloom/module'
import { fireballModule } from '../fireball/module'
import { flameModule } from '../flame/module'
import { projectileModule } from '../projectile/module'
import { slashModule } from '../slash/module'

describe('generator palette slots', () => {
  it('round-trips every registered color slot without changing its values', () => {
    verifySlots('slash', slashModule.defaultParameters, slashModule.paletteSlots)
    verifySlots('explosion', explosionModule.defaultParameters, explosionModule.paletteSlots)
    verifySlots('energyBloom', bloomModule.defaultParameters, bloomModule.paletteSlots)
    verifySlots('fireball', fireballModule.defaultParameters, fireballModule.paletteSlots)
    verifySlots('flame', flameModule.defaultParameters, flameModule.paletteSlots)
    verifySlots('projectile', projectileModule.defaultParameters, projectileModule.paletteSlots)
  })
})

function verifySlots<Parameters>(id: string, parameters: Parameters, slots: readonly PaletteSlot<Parameters>[]) {
  for (const slot of slots) {
    const colors = slot.read(parameters).map((color) => ({ ...color, r: (color.r + 17) % 256 }))
    const updated = slot.write(parameters, colors)
    expect(slot.read(updated), `${id}.${slot.id}`).toEqual(colors)
  }
}
