import type { Locale } from './locales'
import enResource from './resources/en.json'
import zhCNResource from './resources/zh-CN.json'

/** Message tree shape with plain string values, shared by every locale. */
export type MessageTree = DeepStringify<typeof enResource>

/** Recursively widens literal string values while preserving the object shape. */
type DeepStringify<T> = {
  readonly [Key in keyof T]: T[Key] extends string ? string : DeepStringify<T[Key]>
}

/** Flattens nested objects into dotted keys, e.g. `app.title`. */
type KeysOf<T, Prefix extends string = ''> = {
  readonly [Key in keyof T & string]: T[Key] extends string
    ? Join<Prefix, Key>
    : KeysOf<T[Key], Join<Prefix, Key>>
}[keyof T & string]

type Join<Prefix extends string, Key extends string> = Prefix extends '' ? Key : `${Prefix}.${Key}`

/** Every valid translation key, derived from the English dictionary. */
export type MessageKey = KeysOf<typeof enResource>

/** English messages used for rendering and as the runtime fallback. */
export const en: MessageTree = enResource

/** Simplified Chinese messages mirroring the English key structure exactly. */
export const zhCN: MessageTree = zhCNResource

/** Explicit named-parameter contracts for the few dynamic templates. */
export interface MessageParams {
  'app.status': { width: number; height: number }
  'workspace.generatorSectionLabel': { index: string; name: string }
  'workspace.parametersTitle': { name: string }
  'workspace.categoryTabsLabel': { name: string }
  'workspace.categoryControls': { label: string }
  'workspace.exportDimensions': { width: number; height: number }
  'export.summary': { width: number; height: number; frameCount: number; fps: number }
  'export.spriteSheet.expectedSize': { width: number; height: number }
  'export.spriteSheet.stableGuidValue': { guid: string }
  'export.errors.unityAtlasTooLarge': { width: number; height: number }
  'export.animation.summary': { width: number; height: number; frameCount: number; fps: number }
  'export.frameZip.summary': { frameCount: number; width: number; height: number; fps: number }
  'preview.fpsPreview': { fps: number }
  'preview.zoomOption': { zoom: number }
  'controls.about': { label: string }
  'controls.value': { label: string }
  'slash.palette.band': { index: number }
  'slash.palette.removeBand': { index: number }
  'explosion.palette.band': { index: number }
  'explosion.palette.removeBand': { index: number }
  'energyBloom.palette.band': { index: number }
  'energyBloom.palette.removeBand': { index: number }
  'projectile.palette.bodyBand': { index: number }
  'projectile.palette.energyBand': { index: number }
  'projectile.palette.removeBand': { index: number }
  'previewTools.canvas.presetSquare': { width: number; height: number }
  'previewTools.canvas.presetHorizontal': { width: number; height: number }
  'export.fileName': { name: string; width: number; height: number; frameCount: number }
  'project.fileName': { name: string; width: number; height: number; frameCount: number }
  'export.fileNames.compactPng': { name: string; width: number; height: number; frameCount: number }
  'export.fileNames.frameZip': { name: string; width: number; height: number; frameCount: number }
  'export.fileNames.folderSequence': { name: string; width: number; height: number; frameCount: number }
  'export.fileNames.unityZip': { name: string; width: number; height: number; frameCount: number; layout: string }
  'export.fileNames.unityImage': { name: string; width: number; height: number; frameCount: number; layout: string }
  'export.fileNames.folder': { name: string; width: number; height: number; frameCount: number; layout: string }
  'export.atlasPreview.meta': { width: number; height: number; layout: string }
  'export.atlasPreview.zoomOption': { zoom: number }
  'export.gifFileName': { name: string; width: number; height: number; frameCount: number; fps: number }
  'export.apngFileName': { name: string; width: number; height: number; frameCount: number; fps: number }
}

/** Parameter type for one key; keys without named parameters accept none. */
export type ParamsFor<Key extends MessageKey> = Key extends keyof MessageParams ? MessageParams[Key] : undefined

/** Translation signature used by the React context and components. */
export type TranslateFunction = <Key extends MessageKey>(key: Key, params?: ParamsFor<Key>) => string

/** Selects the message tree for a locale, falling back to English. */
export function messagesForLocale(locale: Locale): MessageTree {
  return locale === 'zh-CN' ? zhCN : en
}

/**
 * Resolves and interpolates one message. Missing keys fall back to English;
 * keys absent from both trees or missing parameters throw so gaps surface early.
 */
export function translate(
  messages: MessageTree,
  key: MessageKey,
  params?: Record<string, string | number>,
): string {
  const localTemplate = readKey(messages, key)
  const template = localTemplate ?? readKey(en, key)
  if (template === undefined) {
    throw new RangeError(`Missing translation key: ${key}`)
  }
  if (localTemplate === undefined && typeof console !== 'undefined') {
    console.warn(`Missing translation key in current locale, falling back to English: ${key}`)
  }
  return interpolate(template, params)
}

/** Walks a dotted key through a message tree. */
function readKey(tree: MessageTree, key: string): string | undefined {
  let current: unknown = tree
  for (const segment of key.split('.')) {
    if (typeof current !== 'object' || current === null || !(segment in current)) {
      return undefined
    }
    current = (current as Record<string, unknown>)[segment]
  }
  return typeof current === 'string' ? current : undefined
}

/** Replaces every `{name}` placeholder with its provided value. */
function interpolate(template: string, params: Record<string, string | number> | undefined): string {
  const values = params ?? {}
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    if (!(name in values)) {
      throw new RangeError(`Missing interpolation parameter: ${name}`)
    }
    return String(values[name])
  })
}

/** Stable translation keys for one generator's name, description, and preview title. */
export interface GeneratorDisplayKeys {
  readonly name: MessageKey
  readonly description: MessageKey
  readonly previewTitle: MessageKey
}

/** Stable translation keys for one generator category's label and description. */
export interface CategoryDisplayKeys {
  readonly label: MessageKey
  readonly description: MessageKey
}

/** Stable translation keys for one generator preset name and description. */
export interface PresetDisplayKeys {
  readonly name: MessageKey
  readonly description: MessageKey
}

const GENERATOR_DISPLAY_KEYS: Readonly<Record<string, GeneratorDisplayKeys>> = {
  slash: {
    name: 'slash.name',
    description: 'slash.description',
    previewTitle: 'slash.previewTitle',
  },
  explosion: {
    name: 'explosion.name',
    description: 'explosion.description',
    previewTitle: 'explosion.previewTitle',
  },
  energyBloom: {
    name: 'energyBloom.name',
    description: 'energyBloom.description',
    previewTitle: 'energyBloom.previewTitle',
  },
  projectile: {
    name: 'projectile.name',
    description: 'projectile.description',
    previewTitle: 'projectile.previewTitle',
  },
}

const CATEGORY_DISPLAY_KEYS: Readonly<Record<string, Readonly<Record<string, CategoryDisplayKeys>>>> = {
  slash: {
    shape: { label: 'slash.categories.shape.label', description: 'slash.categories.shape.description' },
    palette: { label: 'slash.categories.palette.label', description: 'slash.categories.palette.description' },
    motion: { label: 'slash.categories.motion.label', description: 'slash.categories.motion.description' },
    fragments: { label: 'slash.categories.fragments.label', description: 'slash.categories.fragments.description' },
    breakup: { label: 'slash.categories.breakup.label', description: 'slash.categories.breakup.description' },
  },
  explosion: {
    body: { label: 'explosion.categories.body.label', description: 'explosion.categories.body.description' },
    motion: { label: 'explosion.categories.motion.label', description: 'explosion.categories.motion.description' },
    material: { label: 'explosion.categories.material.label', description: 'explosion.categories.material.description' },
    effects: { label: 'explosion.categories.effects.label', description: 'explosion.categories.effects.description' },
    palette: { label: 'explosion.categories.palette.label', description: 'explosion.categories.palette.description' },
  },
  energyBloom: {
    body: { label: 'energyBloom.categories.body.label', description: 'energyBloom.categories.body.description' },
    motion: { label: 'energyBloom.categories.motion.label', description: 'energyBloom.categories.motion.description' },
    material: { label: 'energyBloom.categories.material.label', description: 'energyBloom.categories.material.description' },
    effects: { label: 'energyBloom.categories.effects.label', description: 'energyBloom.categories.effects.description' },
    palette: { label: 'energyBloom.categories.palette.label', description: 'energyBloom.categories.palette.description' },
  },
  projectile: {
    body: { label: 'projectile.categories.body.label', description: 'projectile.categories.body.description' },
    motion: { label: 'projectile.categories.motion.label', description: 'projectile.categories.motion.description' },
    trail: { label: 'projectile.categories.trail.label', description: 'projectile.categories.trail.description' },
    effects: { label: 'projectile.categories.effects.label', description: 'projectile.categories.effects.description' },
    palette: { label: 'projectile.categories.palette.label', description: 'projectile.categories.palette.description' },
  },
}

const PRESET_DISPLAY_KEYS: Readonly<Record<string, Readonly<Record<string, PresetDisplayKeys>>>> = {
  slash: {
    cleanArc: { name: 'slash.presets.cleanArc.name', description: 'slash.presets.cleanArc.description' },
    pointedStrike: { name: 'slash.presets.pointedStrike.name', description: 'slash.presets.pointedStrike.description' },
    heavyCleave: { name: 'slash.presets.heavyCleave.name', description: 'slash.presets.heavyCleave.description' },
    energySweep: { name: 'slash.presets.energySweep.name', description: 'slash.presets.energySweep.description' },
    shatteredEdge: { name: 'slash.presets.shatteredEdge.name', description: 'slash.presets.shatteredEdge.description' },
    fullCircle: { name: 'slash.presets.fullCircle.name', description: 'slash.presets.fullCircle.description' },
  },
  explosion: {
      rollingFireball: { name: 'explosion.presets.rollingFireball.name', description: 'explosion.presets.rollingFireball.description' },
      pressureBurst: { name: 'explosion.presets.pressureBurst.name', description: 'explosion.presets.pressureBurst.description' },
      moltenCoreFireball: { name: 'explosion.presets.moltenCoreFireball.name', description: 'explosion.presets.moltenCoreFireball.description' },
      smokeBurst: { name: 'explosion.presets.smokeBurst.name', description: 'explosion.presets.smokeBurst.description' },
      particleSmokeBurst: { name: 'explosion.presets.particleSmokeBurst.name', description: 'explosion.presets.particleSmokeBurst.description' },
    retroBurst: { name: 'explosion.presets.retroBurst.name', description: 'explosion.presets.retroBurst.description' },
  },
  energyBloom: {
    softPetals: { name: 'energyBloom.presets.softPetals.name', description: 'energyBloom.presets.softPetals.description' },
    sharpStarburst: { name: 'energyBloom.presets.sharpStarburst.name', description: 'energyBloom.presets.sharpStarburst.description' },
    layeredCorolla: { name: 'energyBloom.presets.layeredCorolla.name', description: 'energyBloom.presets.layeredCorolla.description' },
    softPetalsImplosion: { name: 'energyBloom.presets.softPetalsImplosion.name', description: 'energyBloom.presets.softPetalsImplosion.description' },
    arcaneBurst: { name: 'energyBloom.presets.arcaneBurst.name', description: 'energyBloom.presets.arcaneBurst.description' },
    starburstImplosion: { name: 'energyBloom.presets.starburstImplosion.name', description: 'energyBloom.presets.starburstImplosion.description' },
    corollaImplosion: { name: 'energyBloom.presets.corollaImplosion.name', description: 'energyBloom.presets.corollaImplosion.description' },
  },
  projectile: {
    fireball: { name: 'projectile.presets.fireball.name', description: 'projectile.presets.fireball.description' },
    blastBolt: { name: 'projectile.presets.blastBolt.name', description: 'projectile.presets.blastBolt.description' },
    enchantedArrow: { name: 'projectile.presets.enchantedArrow.name', description: 'projectile.presets.enchantedArrow.description' },
    energyArrow: { name: 'projectile.presets.energyArrow.name', description: 'projectile.presets.energyArrow.description' },
  },
}

/** Returns translated display keys for a generator id, or undefined to keep the definition fallback. */
export function generatorDisplayKeys(generatorId: string): GeneratorDisplayKeys | undefined {
  return GENERATOR_DISPLAY_KEYS[generatorId]
}

/** Returns translated display keys for one category of a generator id, or undefined for the fallback. */
export function categoryDisplayKeys(generatorId: string, categoryId: string): CategoryDisplayKeys | undefined {
  return CATEGORY_DISPLAY_KEYS[generatorId]?.[categoryId]
}

/** Returns translated display keys for one preset id, or undefined. */
export function presetDisplayKeys(generatorId: string, presetId: string): PresetDisplayKeys | undefined {
  return PRESET_DISPLAY_KEYS[generatorId]?.[presetId]
}
