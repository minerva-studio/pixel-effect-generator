import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../i18n/I18nProvider'
import { ProjectileControls, ProjectilePreviewTools } from '../controls'
import { DEFAULT_PROJECTILE_PARAMETERS, type ProjectileParameters } from '../model'
import type { ProjectileCategory } from '../module'

afterEach(() => vi.unstubAllGlobals())

/** Renders one localized category for static markup assertions. */
function renderControls(category: ProjectileCategory, locale: 'en' | 'zh-CN' = 'en', parameters: ProjectileParameters = DEFAULT_PROJECTILE_PARAMETERS) {
  vi.stubGlobal('navigator', locale === 'zh-CN' ? { language: 'zh-CN' } : { language: 'en-US' })
  return renderToStaticMarkup(<I18nProvider><ProjectileControls category={category} parameters={parameters} onChange={() => undefined} /></I18nProvider>)
}

describe('projectile controls', () => {
  it('renders the body category with conditional arrow material', () => {
    const body = renderControls('body')
    expect(body).toContain('Fireball')
    expect(body).toContain('Magic arrow')
    expect(body).not.toContain('Arrow material')
    const arrow = renderControls('body', 'en', { ...DEFAULT_PROJECTILE_PARAMETERS, kind: 'arrow' })
    expect(arrow).toContain('Arrow material')
    expect(arrow).toContain('Solid')
    expect(arrow).toContain('Energy')
  })

  it('renders the trail category with conditional fields', () => {
    const trail = renderControls('trail')
    expect(trail).toContain('Trail length')
    expect(trail).toContain('Trail width')
    expect(trail).toContain('Trail wave')
    const off = renderControls('trail', 'en', { ...DEFAULT_PROJECTILE_PARAMETERS, trailMode: 'off' })
    expect(off).not.toContain('Trail length')
  })

  it('renders effect toggles with conditional sliders', () => {
    const effects = renderControls('effects')
    expect(effects).toContain('class="toggle-field"')
    expect(effects).toContain('type="checkbox"')
    expect(effects).not.toContain('scale-toggle')
    expect(effects).toContain('Spark count')
    expect(effects).toContain('Afterimage count')
    const disabled = renderControls('effects', 'en', {
      ...DEFAULT_PROJECTILE_PARAMETERS,
      sparksEnabled: false,
      afterimagesEnabled: false,
    })
    expect(disabled).not.toContain('Spark count')
    expect(disabled).not.toContain('Afterimage count')
  })

  it('renders both palette editors with alpha sliders and 8-digit hex', () => {
    const palette = renderControls('palette')
    expect(palette).toContain('Arrow body')
    expect(palette).toContain('Energy palette')
    expect(palette.match(/type="range"/g)).toHaveLength(7)
    expect(palette).toContain('min="0"')
    expect(palette).toContain('max="255"')
    expect(palette).toContain('#FFFFFFFF')
    expect(palette).toContain('Alpha')
  })

  it('renders localized labels and shared preview tools', () => {
    const body = renderControls('body', 'zh-CN')
    expect(body).toContain('弹体类型')
    expect(body).toContain('火球')
    expect(body).toContain('魔法箭')
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
