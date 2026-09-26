import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { I18nProvider } from '../i18n/I18nProvider'
import { NewDocumentDialog } from './Workbench'

afterEach(() => vi.unstubAllGlobals())

describe('NewDocumentDialog', () => {
  it('keeps stable generators above the experimental separator in registration order', () => {
    vi.stubGlobal('navigator', { language: 'en-US' })
    const html = renderToStaticMarkup(<I18nProvider><NewDocumentDialog open busy={false} onClose={() => undefined} onCreate={async () => true} /></I18nProvider>)
    const separator = html.indexOf('class="document-type-divider"')
    expect(separator).toBeGreaterThan(0)
    expect(html).toContain('role="separator" aria-label="Experimental"')
    expect(html.match(/class="document-type-grid"/g)).toHaveLength(2)
    const stable = ['Slash', 'Explosion', 'Fireball', 'Flame']
    const experimental = ['Arrow', 'Crystal', 'Energy Bloom']
    const position = (name: string) => html.indexOf(`<strong>${name}</strong>`)
    for (const name of stable) expect(position(name)).toBeGreaterThan(0)
    for (const name of experimental) expect(position(name)).toBeGreaterThan(separator)
    expect(stable.map(position)).toEqual([...stable.map(position)].sort((a, b) => a - b))
    expect(experimental.map(position)).toEqual([...experimental.map(position)].sort((a, b) => a - b))
    expect(Math.max(...stable.map(position))).toBeLessThan(separator)
    expect(html).toContain('Still being refined; parameters and results may change.')
  })
})
