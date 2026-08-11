import { describe, expect, it } from 'vitest'
import { createRenderedParametersAction } from '../contract'
import {
  GENERATOR_REGISTRY,
  createDefaultSessionRecord,
  createGeneratorRegistry,
  updateSessionRecord,
  type GeneratorId,
} from '../registry'
import { blipGenerator, blipModule } from './blipFixture'
import { slashModule } from '../slash/module'
import { explosionModule } from '../explosion/module'
import { bloomModule } from '../energy-bloom/module'
import { projectileModule } from '../projectile/module'
import { slashProjectCodec } from '../slash/project'
import type { SlashParameters } from '../slash/model'
import { packHorizontalSheet } from '../../shared/pixel/spritesheet'

const dualRegistry = createGeneratorRegistry([blipGenerator, GENERATOR_REGISTRY.get('slash')] as const)

describe('generator registry', () => {
  it('registers the slash project codec on its module', () => {
    expect(slashModule.projectCodec).toBe(slashProjectCodec)
  })

  it('registers unique ids and indexes while preserving order', () => {
    expect(GENERATOR_REGISTRY.registrations.map((registration) => registration.id)).toEqual(['slash', 'explosion', 'energyBloom', 'projectile'])
    expect(dualRegistry.registrations.map((registration) => registration.id)).toEqual(['blip', 'slash'])
    expect(dualRegistry.definitions.map((definition) => definition.id)).toEqual(['blip', 'slash'])
    expect(() => createGeneratorRegistry([GENERATOR_REGISTRY.get('slash'), blipGenerator] as const)).not.toThrow()
    expect(() => createGeneratorRegistry([GENERATOR_REGISTRY.get('slash'), GENERATOR_REGISTRY.get('slash')] as const)).toThrow(/unique/i)
  })

  it('infers GeneratorId as the literal registered ids, not string', () => {
    const id: GeneratorId = 'slash'
    const secondId: GeneratorId = 'explosion'
    const thirdId: GeneratorId = 'energyBloom'
    const fourthId: GeneratorId = 'projectile'
    expect(id).toBe('slash')
    expect(secondId).toBe('explosion')
    expect(thirdId).toBe('energyBloom')
    expect(fourthId).toBe('projectile')
    // @ts-expect-error - only registered literal ids are valid
    const invalid: GeneratorId = 'blip'
    expect(typeof invalid).toBe('string')
  })

  it('keeps Slash parameters incompatible with the test generator at the module boundary', () => {
    // @ts-expect-error - blip parameters are not slash parameters
    const _slashFromBlip: Parameters<typeof slashModule.render>[0] = blipModule.defaultParameters
    // @ts-expect-error - slash parameters are not blip parameters
    const _blipFromSlash: Parameters<typeof blipModule.render>[0] = slashModule.defaultParameters
    expect(slashModule.render(slashModule.defaultParameters)).toHaveLength(8)
  })

  it('registers the combustion explosion with five tabs, presets, and project support', () => {
    expect(explosionModule.definition.index).toBe(2)
    expect(explosionModule.categories.map((category) => category.id)).toEqual(['body', 'motion', 'material', 'effects', 'palette'])
    expect(explosionModule.projectCodec?.generatorId).toBe('explosion')
    expect(explosionModule.projectCodec?.parse(explosionModule.projectCodec.serialize(explosionModule.defaultParameters))).toEqual(explosionModule.defaultParameters)
    expect(explosionModule.presetCapability?.builtIns.map((preset) => preset.id)).toEqual(['rollingFireball', 'moltenCoreFireball', 'smokeBurst', 'particleSmokeBurst', 'pressureBurst', 'retroBurst'])
    expect(explosionModule.render(explosionModule.defaultParameters)).toHaveLength(10)
  })

  it('registers the energy bloom family with independent defaults and seven presets', () => {
    expect(bloomModule.definition.index).toBe(3)
    expect(bloomModule.categories.map((category) => category.id)).toEqual(['body', 'motion', 'material', 'effects', 'palette'])
    expect(bloomModule.defaultParameters.body.shape).toBe('softPetals')
    expect(bloomModule.defaultParameters.tongues.enabled).toBe(false)
    expect(bloomModule.projectCodec).toBeUndefined()
    expect(bloomModule.presetCapability?.builtIns.map((preset) => preset.id)).toEqual([
      'softPetals',
      'sharpStarburst',
      'layeredCorolla',
      'softPetalsImplosion',
      'arcaneBurst',
      'starburstImplosion',
      'corollaImplosion',
    ])
    expect(bloomModule.render(bloomModule.defaultParameters)).toHaveLength(10)
  })

  it('registers the projectile generator with five tabs, presets, and a project codec', () => {
    expect(projectileModule.definition.index).toBe(4)
    expect(projectileModule.categories.map((category) => category.id)).toEqual(['body', 'motion', 'trail', 'effects', 'palette'])
    expect(projectileModule.projectCodec?.generatorId).toBe('projectile')
    expect(projectileModule.presetCapability?.builtIns.map((preset) => preset.id)).toEqual([
      'fireball',
      'blastBolt',
      'enchantedArrow',
      'energyArrow',
      'crystalSpear',
      'crystalCore',
    ])
    expect(projectileModule.defaultParameters.canvasWidth).toBe(128)
    expect(projectileModule.render(projectileModule.defaultParameters)).toHaveLength(10)
  })
})

describe('dual module sessions', () => {
  it('renders a default session for every registered generator', () => {
    const sessions = createDefaultSessionRecord(dualRegistry, 12)
    expect(sessions.slash.generatorId).toBe('slash')
    expect(sessions.blip.generatorId).toBe('blip')
    expect(sessions.slash.frames.read()).toHaveLength(8)
    expect(sessions.blip.frames.read()).toHaveLength(5)
  })

  it('rejects actions from ids outside the registry at compile time', () => {
    if (false) {
      const sessions = createDefaultSessionRecord(dualRegistry, 12)
      // @ts-expect-error - actions must identify a generator in this registry
      updateSessionRecord(dualRegistry.record, sessions, { generatorId: 'missing', action: { type: 'frame', frameIndex: 0 } })
    }
    expect(true).toBe(true)
  })

  it('keeps parameters, category, frame, playback, and fps isolated per generator', () => {
    let sessions = createDefaultSessionRecord(dualRegistry, 12)
    const slashParameters = sessions.slash.parameters as SlashParameters
    const nextSlashParameters = { ...slashParameters, radius: 50 }
    sessions = updateSessionRecord(dualRegistry.record, sessions, {
      generatorId: 'slash',
      action: createRenderedParametersAction(slashModule, nextSlashParameters),
    })
    sessions = updateSessionRecord(dualRegistry.record, sessions, { generatorId: 'slash', action: { type: 'category', category: 'breakup' } })
    sessions = updateSessionRecord(dualRegistry.record, sessions, { generatorId: 'slash', action: { type: 'frame', frameIndex: 4 } })
    sessions = updateSessionRecord(dualRegistry.record, sessions, { generatorId: 'slash', action: { type: 'play', isPlaying: false } })
    sessions = updateSessionRecord(dualRegistry.record, sessions, { generatorId: 'slash', action: { type: 'fps', previewFps: 18 } })
    const blipParameters = sessions.blip.parameters as { intensity: number; frameCount: number }
    sessions = updateSessionRecord(dualRegistry.record, sessions, {
      generatorId: 'blip',
      action: createRenderedParametersAction(blipModule, { ...blipParameters, intensity: 9, frameCount: 7 }),
    })

    expect((sessions.slash.parameters as { radius: number }).radius).toBe(50)
    expect(sessions.slash.activeCategory).toBe('breakup')
    expect(sessions.slash.frameIndex).toBe(4)
    expect(sessions.slash.isPlaying).toBe(false)
    expect(sessions.slash.previewFps).toBe(18)
    expect(sessions.slash.frames.read()).toHaveLength(8)
    expect(sessions.blip.parameters as { intensity: number; frameCount: number }).toEqual({ intensity: 9, frameCount: 7 })
    expect(sessions.blip.frames.read()).toHaveLength(7)
    expect(sessions.blip.activeCategory).toBe('core')
    expect(sessions.blip.frameIndex).toBe(0)
    expect(sessions.blip.isPlaying).toBe(true)
  })

  it('keeps frame-count parameters, rendered frames, and sheet dimensions aligned', () => {
    const sessions = createDefaultSessionRecord(dualRegistry, 12)
    const resizedParameters = slashModule.resize?.(sessions.slash.parameters as SlashParameters, { width: 64, height: 128 }, true)
    const updatedParameters = resizedParameters
      ? slashModule.writeFrameCount(resizedParameters, 12)
      : slashModule.writeFrameCount(sessions.slash.parameters as SlashParameters, 12)
    const updated = updateSessionRecord(dualRegistry.record, sessions, {
      generatorId: 'slash',
      action: createRenderedParametersAction(slashModule, updatedParameters),
    })
    const frames = updated.slash.frames.read()
    const sheet = packHorizontalSheet(frames)

    expect((updated.slash.parameters as SlashParameters).frameCount).toBe(12)
    expect(updatedParameters.canvasWidth).toBe(64)
    expect(updatedParameters.canvasHeight).toBe(128)
    expect(frames).toHaveLength(12)
    expect(sheet.width).toBe(12 * updatedParameters.canvasWidth)
    expect(sheet.height).toBe(updatedParameters.canvasHeight)
  })
  it('exposes per-generator preview metadata', () => {
    expect(slashModule.categories.map((category) => category.id)).toEqual(['shape', 'palette', 'motion', 'fragments', 'breakup'])
    expect(GENERATOR_REGISTRY.get('slash').previewTitle).toBe('Sweep study')
    expect(GENERATOR_REGISTRY.get('slash').readFrameSize(GENERATOR_REGISTRY.get('slash').createSession(12))).toEqual({ width: 128, height: 128 })
    expect(dualRegistry.get('blip').previewTitle).toBe('Blip loop')
    expect(dualRegistry.get('blip').readFrameSize(dualRegistry.get('blip').createSession(12))).toEqual({ width: 8, height: 6 })
  })

  it('provides a type-safe workspace component for each registration', () => {
    const slashWorkspace = GENERATOR_REGISTRY.get('slash').Workspace
    const blipWorkspace = dualRegistry.get('blip').Workspace
    expect(typeof slashWorkspace).toBe('function')
    expect(typeof blipWorkspace).toBe('function')
    expect(slashWorkspace).not.toBe(blipWorkspace)
  })
})
