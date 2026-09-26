import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { I18nProvider } from '../i18n/I18nProvider'
import { InfoHint, NumberControl, PercentControl, SelectControl, SegmentedControl, ToggleControl } from './controls'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('shared form controls', () => {
  it('generates unique, correctly associated ids without a slash prefix', () => {
    const markup = renderToStaticMarkup(
      <I18nProvider>
        <>
          <NumberControl label="Radius" description="Outer edge radius." value={10} minimum={2} maximum={63} onChange={() => undefined} />
          <SelectControl
            label="Mode"
            description="Choose a mode."
            value="a"
            options={[{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }]}
            onChange={() => undefined}
          />
          <InfoHint label="Help" description="Guidance text." hintId="help-hint" />
        </>
      </I18nProvider>,
    )

    const ids = [...markup.matchAll(/id="([^"]+)"/g)].map((match) => match[1])
    expect(ids.length).toBeGreaterThanOrEqual(4)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.some((id) => id.startsWith('slash-'))).toBe(false)
    expect(markup).toContain('aria-describedby="help-hint"')
  })

  it('localizes generated aria labels in English and Chinese', () => {
    vi.stubGlobal('navigator', undefined)
    const en = renderToStaticMarkup(
      <I18nProvider>
        <NumberControl label="Radius" description="Outer edge radius." value={10} minimum={2} maximum={63} onChange={() => undefined} />
      </I18nProvider>,
    )
    expect(en).toContain('aria-label="Radius value"')
    expect(en).toContain('aria-label="About Radius"')

    vi.stubGlobal('navigator', { language: 'zh-CN' })
    const zh = renderToStaticMarkup(
      <I18nProvider>
        <NumberControl label="半径" description="外缘半径。" value={10} minimum={2} maximum={63} onChange={() => undefined} />
      </I18nProvider>,
    )
    expect(zh).toContain('aria-label="半径 数值"')
    expect(zh).toContain('aria-label="关于 半径"')
  })

  it('renders shared percentage, toggle, and segmented controls with their values', () => {
    const markup = renderToStaticMarkup(<I18nProvider><>
      <PercentControl label="Coverage" description="Covered area." value={0.35} onChange={() => undefined} />
      <ToggleControl label="Sparks" description="Enable sparks." checked onChange={() => undefined} ariaDescribedBy="extra-help" />
      <SegmentedControl label="Direction" description="Travel direction." value="cw" options={[{ value: 'cw', label: 'Clockwise' }, { value: 'ccw', label: 'Counterclockwise' }]} onChange={() => undefined} />
    </></I18nProvider>)

    expect(markup).toContain('value="35"')
    expect(markup).toContain('<small>%</small>')
    expect(markup).toContain('aria-describedby="extra-help"')
    expect(markup).toContain('aria-pressed="true"')
  })
})
