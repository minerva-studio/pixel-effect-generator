import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../i18n/I18nProvider'
import { ProjectileControls, ProjectilePreviewTools } from '../controls'
import { DEFAULT_PROJECTILE_PARAMETERS, selectProjectileShape, selectedProjectileShape, type ProjectileParameters } from '../model'
import type { ProjectileCategory } from '../module'

afterEach(() => vi.unstubAllGlobals())

/** Renders one localized category for static markup assertions. */
function renderControls(category: ProjectileCategory, locale: 'en' | 'zh-CN' = 'en', parameters: ProjectileParameters = DEFAULT_PROJECTILE_PARAMETERS) {
  vi.stubGlobal('navigator', locale === 'zh-CN' ? { language: 'zh-CN' } : { language: 'en-US' })
  return renderToStaticMarkup(<I18nProvider><ProjectileControls category={category} parameters={parameters} onChange={() => undefined} /></I18nProvider>)
}

describe('projectile controls', () => {
  it('renders five body thumbnail cards with one selected identity', () => {
    const body = renderControls('body')
    expect(body).toContain('Fireball')
    expect(body).toContain('Solid arrow')
    expect(body).toContain('Energy arrow')
    expect(body).toContain('Crystal spear')
    expect(body).toContain('Crystal core')
    expect(body.match(/aria-pressed="(?:true|false)"/g)).toHaveLength(5)
    expect(body.match(/aria-pressed="true"/g)).toHaveLength(1)

    const energyArrow = renderControls('body', 'en', {
      ...DEFAULT_PROJECTILE_PARAMETERS,
      kind: 'arrow',
      arrowMaterial: 'energy',
    })
    expect(energyArrow.match(/aria-pressed="true"/g)).toHaveLength(1)
    expect(energyArrow).toMatch(/shape-card active[^>]+aria-pressed="true"[^>]*>[\s\S]*?Energy arrow/)
  })

  it('maps every body card without changing unrelated parameters', () => {
    const base = { ...DEFAULT_PROJECTILE_PARAMETERS, radius: 23, arrowMaterial: 'energy' as const, trailMode: 'off' as const, sparksEnabled: true }
    const fireball = selectProjectileShape(base, 'fireball')
    expect(fireball).toMatchObject({ kind: 'fireball', arrowMaterial: 'energy', radius: 23 })
    expect(selectedProjectileShape(fireball)).toBe('fireball')

    const solidArrow = selectProjectileShape(base, 'solidArrow')
    expect(solidArrow).toMatchObject({ kind: 'arrow', arrowMaterial: 'solid', radius: 23 })
    expect(selectedProjectileShape(solidArrow)).toBe('solidArrow')

    const energyArrow = selectProjectileShape(base, 'energyArrow')
    expect(energyArrow).toMatchObject({ kind: 'arrow', arrowMaterial: 'energy', radius: 23 })
    expect(selectedProjectileShape(energyArrow)).toBe('energyArrow')

    const crystalSpear = selectProjectileShape(base, 'crystalSpear')
    expect(crystalSpear).toMatchObject({ kind: 'crystal', crystalForm: 'spear', trailMode: 'off', sparksEnabled: true, bodyPalette: base.bodyPalette, energyPalette: base.energyPalette })
    expect(selectedProjectileShape(crystalSpear)).toBe('crystalSpear')

    const crystalCore = selectProjectileShape(base, 'crystalCore')
    expect(crystalCore).toMatchObject({ kind: 'crystal', crystalForm: 'core', trailMode: 'off', sparksEnabled: true, bodyPalette: base.bodyPalette, energyPalette: base.energyPalette })
    expect(selectedProjectileShape(crystalCore)).toBe('crystalCore')
  })

  it('shows only the selected body family controls', () => {
    const fireball = renderControls('body')
    expect(fireball).toContain('Rear flame reach')
    expect(fireball).toContain('Surface mottling')
    expect(renderControls('body', 'en', { ...DEFAULT_PROJECTILE_PARAMETERS, kind: 'arrow', arrowMaterial: 'solid' })).toContain('Arrowhead length')
    expect(renderControls('body', 'en', { ...DEFAULT_PROJECTILE_PARAMETERS, kind: 'arrow', arrowMaterial: 'energy' })).toContain('Energy core length')
    expect(renderControls('body', 'en', { ...DEFAULT_PROJECTILE_PARAMETERS, kind: 'crystal', crystalForm: 'spear' })).toContain('Crystal taper')
    expect(renderControls('body', 'en', { ...DEFAULT_PROJECTILE_PARAMETERS, kind: 'crystal', crystalForm: 'spear' })).toContain('Glint strength')
    const core = renderControls('body', 'en', { ...DEFAULT_PROJECTILE_PARAMETERS, kind: 'crystal', crystalForm: 'core' })
    expect(core).toContain('Orbit radius')
    expect(core).toContain('Glint speed')
    expect(core).not.toContain('Crystal taper')
  })

  it('renders the trail as a foldable optional layer', () => {
    const trail = renderControls('trail')
    expect(trail).toContain('class="effect-section enabled')
    expect(trail).toContain('aria-label="Trail"')
    expect(trail).not.toContain('Trail length')
    const off = renderControls('trail', 'en', { ...DEFAULT_PROJECTILE_PARAMETERS, trailMode: 'off' })
    expect(off).toContain('class="effect-section  "')
    expect(off).toContain('Off')
  })

  it('renders sparks and afterimages as foldable optional layers', () => {
    const effects = renderControls('effects')
    expect(effects).toContain('class="toggle-field"')
    expect(effects).toContain('type="checkbox"')
    expect(effects).not.toContain('scale-toggle')
    expect(effects).toContain('aria-label="Sparks"')
    expect(effects).toContain('aria-label="Afterimages"')
    expect(effects).not.toContain('Spark count')
    const disabled = renderControls('effects', 'en', {
      ...DEFAULT_PROJECTILE_PARAMETERS,
      sparksEnabled: false,
      afterimagesEnabled: false,
    })
    expect(disabled.match(/class="effect-section  "/g)).toHaveLength(2)
  })

  it('renders both palette editors with alpha sliders and 8-digit hex', () => {
    const palette = renderControls('palette')
    expect(palette).toContain('Arrow body')
    expect(palette).toContain('Energy palette')
    expect(palette.match(/type="range"/g)).toHaveLength(8)
    expect(palette).toContain('min="0"')
    expect(palette).toContain('max="255"')
    expect(palette).toContain('#FFFBC3FF')
    expect(palette).toContain('Opacity')
  })

  it('renders localized labels and shared preview tools', () => {
    const body = renderControls('body', 'zh-CN')
    expect(body).toContain('实体箭')
    expect(body).toContain('火球')
    expect(body).toContain('能量箭')
    expect(renderControls('trail', 'zh-CN')).toContain('尾迹类型')
    expect(renderControls('effects', 'zh-CN')).toContain('火花')
    vi.stubGlobal('navigator', { language: 'en-US' })
    const tools = renderToStaticMarkup(
      <I18nProvider><ProjectilePreviewTools parameters={DEFAULT_PROJECTILE_PARAMETERS} onChange={() => undefined} /></I18nProvider>,
    )
    expect(tools).toContain('Canvas size')
    expect(tools).toContain('Random seed')
  })
})
