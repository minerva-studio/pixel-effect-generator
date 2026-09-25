import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../i18n/I18nProvider'
import { FlameControls } from '../controls'
import { DEFAULT_FLAME_PARAMETERS as base } from '../model'
import { GENERATOR_REGISTRY, createDefaultSessionRecord, updateSessionRecord } from '../../registry'
import { flameModule } from '../module'
import { createRenderedParametersAction } from '../../contract'

afterEach(() => vi.unstubAllGlobals())

describe('flame workspace integration', () => {
  it.each(['en-US', 'zh-CN'])('renders translated controls and three animated shape cards (%s)', language => {
    vi.stubGlobal('navigator', { language })
    const render = (category: 'shape' | 'palette' | 'motion' | 'details') => renderToStaticMarkup(<I18nProvider><FlameControls category={category} parameters={base} onChange={() => undefined} /></I18nProvider>)
    const shape = render('shape')
    expect(shape.match(/aria-pressed="(?:true|false)"/g)).toHaveLength(3)
    expect(shape.match(/aria-pressed="true"/g)).toHaveLength(1)
    expect(shape).toContain(language === 'zh-CN' ? '篝火' : 'Campfire')
    const palette = render('palette')
    expect(palette.match(/type="color"/g)).toHaveLength(5)
    expect(palette).not.toContain('type="range"')
    expect(render('motion')).toContain(language === 'zh-CN' ? '上升流速' : 'Rising flow')
    expect(render('details')).toContain(language === 'zh-CN' ? '火星数量' : 'Spark count')
  })
  it('registers complete capabilities and updates only its own session', () => {
    expect(flameModule.projectCodec?.generatorId).toBe('flame')
    expect(flameModule.presetCapability?.builtIns).toHaveLength(3)
    const sessions = createDefaultSessionRecord(GENERATOR_REGISTRY, 12)
    const next = updateSessionRecord(GENERATOR_REGISTRY.record, sessions, { generatorId: 'flame', action: createRenderedParametersAction(flameModule, { ...base, height: 70 }) })
    expect(next.flame.parameters).toMatchObject({ height: 70 })
    expect(next.fireball).toBe(sessions.fireball)
    expect(next.slash).toBe(sessions.slash)
    expect(next.flame.frames.read()).toHaveLength(12)
  })
})
