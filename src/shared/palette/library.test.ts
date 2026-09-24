import { describe, expect, it } from 'vitest'
import { DEFAULT_BLOOM_PARAMETERS } from '../../generators/energy-bloom/model'
import { BLOOM_BUILTIN_PRESETS, applyBloomPreset } from '../../generators/energy-bloom/presets'
import { LEGACY_EXPLOSION_PARAMETERS, MODERN_EXPLOSION_PARAMETERS } from '../../generators/explosion/model'
import { EXPLOSION_BUILTIN_PRESETS, applyExplosionPreset } from '../../generators/explosion/presets'
import { DEFAULT_FLAME_PARAMETERS } from '../../generators/flame/model'
import { DEFAULT_PROJECTILE_PARAMETERS } from '../../generators/projectile/model'
import { PROJECTILE_BUILTIN_PRESETS, applyProjectilePreset } from '../../generators/projectile/presets'
import { rgbaToHex } from '../pixel/color'
import { PALETTE_COLORS, builtinPalette, isPaletteCompatible, type BuiltinPaletteId } from './library'

const hex = (colors: readonly { r: number; g: number; b: number; a: number }[]) => colors.map((color) => rgbaToHex(color).slice(0, 7).toUpperCase())

describe('shared color library', () => {
  it('contains the approved opaque colors in bright-to-dark order', () => {
    expect(hex(PALETTE_COLORS.flameGlow)).toEqual(['#FFFBC3', '#FFD744', '#FF8922', '#E73D1B', '#8D1F23'])
    expect(hex(PALETTE_COLORS.irisBloom)).toEqual(['#F9F4F8', '#BFD3E6', '#9B83C8', '#473D68'])
    expect(hex(PALETTE_COLORS.smokeEmber)).toEqual(['#FFE8A4', '#EE843E', '#A6776F', '#746070', '#483E52', '#2A2934'])
    expect(hex(PALETTE_COLORS.aetherCyan)).toEqual(['#F4FAF9', '#B3D8E1', '#6BAFC3', '#365A78'])
    expect(hex(PALETTE_COLORS.orchidCrystal)).toEqual(['#FBF4FA', '#D5B8E3', '#A47BC8', '#514069'])
    expect(hex(PALETTE_COLORS.duskSteel)).toEqual(['#ECE9E4', '#A9A4AC', '#55505C'])
    expect(hex(PALETTE_COLORS.runedSteel)).toEqual(['#F0E8E8', '#B5A3BA', '#5F536C'])
    expect(hex(PALETTE_COLORS.retroBurst)).toEqual(['#FFFAE0', '#FFC948', '#F25F2C', '#692A34'])
    expect(Object.values(PALETTE_COLORS).flat().every((color) => color.a === 255)).toBe(true)
  })

  it('maps defaults and every related built-in preset without replacing retained flame colors', () => {
    expect(DEFAULT_FLAME_PARAMETERS.palette).toEqual(builtinPalette('flameGlow'))
    expect(LEGACY_EXPLOSION_PARAMETERS.palette).toEqual(builtinPalette('flameGlow'))
    expect(MODERN_EXPLOSION_PARAMETERS.palette).toEqual(builtinPalette('flameGlow'))
    const explosionColors: Record<string, BuiltinPaletteId> = {
      billowBurst: 'flameGlow',
      fireMasses: 'flameGlow',
      smokyFireMasses: 'smokeEmber',
      rollingFireball: 'flameGlow',
      moltenCoreFireball: 'flameGlow',
      smokeBurst: 'smokeEmber',
      particleSmokeBurst: 'smokeEmber',
      pressureBurst: 'flameGlow',
      retroBurst: 'retroBurst',
    }
    for (const preset of EXPLOSION_BUILTIN_PRESETS) {
      const applied = applyExplosionPreset(LEGACY_EXPLOSION_PARAMETERS, preset.payload)
      expect(applied.palette).toEqual(builtinPalette(explosionColors[preset.id]))
    }
    expect(DEFAULT_BLOOM_PARAMETERS.palette).toEqual(builtinPalette('irisBloom'))
    for (const preset of BLOOM_BUILTIN_PRESETS) expect(applyBloomPreset(DEFAULT_BLOOM_PARAMETERS, preset.payload).palette).toEqual(builtinPalette('irisBloom'))
    expect(DEFAULT_PROJECTILE_PARAMETERS.bodyPalette).toEqual(builtinPalette('duskSteel'))
    expect(DEFAULT_PROJECTILE_PARAMETERS.energyPalette).toEqual(builtinPalette('flameGlow'))
    const expected = [
      ['duskSteel', 'flameGlow'], ['duskSteel', 'flameGlow'], ['runedSteel', 'orchidCrystal'],
      ['duskSteel', 'aetherCyan'], ['duskSteel', 'aetherCyan'], ['duskSteel', 'orchidCrystal'],
    ] as const
    PROJECTILE_BUILTIN_PRESETS.forEach((preset, index) => {
      const applied = applyProjectilePreset(DEFAULT_PROJECTILE_PARAMETERS, preset.payload)
      expect(applied.bodyPalette).toEqual(builtinPalette(expected[index][0]))
      expect(applied.energyPalette).toEqual(builtinPalette(expected[index][1]))
    })
  })

  it('filters every palette slot by count and opacity without altering colors', () => {
    const translucent = builtinPalette('duskSteel').map((color) => ({ ...color, a: 128 }))
    expect(isPaletteCompatible(translucent, 2, 6, false)).toBe(true) // Slash, explosion, bloom, projectile energy
    expect(isPaletteCompatible(translucent, 3, 6, true)).toBe(false) // Flame
    expect(isPaletteCompatible(translucent, 2, 4, false)).toBe(true) // Projectile body
    expect(isPaletteCompatible(PALETTE_COLORS.smokeEmber, 2, 4, false)).toBe(false)
    expect(isPaletteCompatible(PALETTE_COLORS.retroBurst, 3, 6, true)).toBe(true)
    const copy = builtinPalette('flameGlow')
    copy[0] = { ...copy[0], r: 0 }
    expect(PALETTE_COLORS.flameGlow[0].r).toBe(255)
  })
})
