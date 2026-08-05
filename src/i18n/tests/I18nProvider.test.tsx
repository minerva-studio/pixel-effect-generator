import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { I18nProvider, createLocaleStore } from '../I18nProvider'
import { useI18n } from '../I18nProvider'

afterEach(() => {
  vi.unstubAllGlobals()
})

function LanguageProbe() {
  const { locale, t } = useI18n()
  return <div data-locale={locale}>{t('app.title')}</div>
}

describe('locale store', () => {
  it('starts from the resolved initial locale', () => {
    const store = createLocaleStore('zh-CN')
    expect(store.getLocale()).toBe('zh-CN')
  })

  it('switches immediately, persists, and notifies subscribers', () => {
    const persisted: string[] = []
    const store = createLocaleStore('en', (locale) => persisted.push(locale))
    const notified: string[] = []
    const unsubscribe = store.subscribe(() => notified.push(store.getLocale()))

    store.setLocale('zh-CN')
    expect(store.getLocale()).toBe('zh-CN')
    expect(persisted).toEqual(['zh-CN'])
    expect(notified).toEqual(['zh-CN'])

    unsubscribe()
    store.setLocale('en')
    expect(notified).toEqual(['zh-CN'])
  })

  it('ignores invalid or unchanged locales without persisting', () => {
    const persisted: string[] = []
    const store = createLocaleStore('en', (locale) => persisted.push(locale))
    store.setLocale('fr' as never)
    store.setLocale('en')
    expect(store.getLocale()).toBe('en')
    expect(persisted).toEqual([])
  })
})

describe('I18nProvider', () => {
  it('defaults to English without browser globals', () => {
    vi.stubGlobal('navigator', undefined)
    const markup = renderToStaticMarkup(
      <I18nProvider>
        <LanguageProbe />
      </I18nProvider>,
    )
    expect(markup).toContain('data-locale="en"')
    expect(markup).toContain('Pixel Effect Generator')
  })

  it('uses the browser language for the first visit', () => {
    vi.stubGlobal('navigator', { language: 'zh-CN' })
    const markup = renderToStaticMarkup(
      <I18nProvider>
        <LanguageProbe />
      </I18nProvider>,
    )
    expect(markup).toContain('data-locale="zh-CN"')
    expect(markup).toContain('像素特效生成器')
  })

  it('restores a previously saved locale over the browser language', () => {
    vi.stubGlobal('navigator', { language: 'en-US' })
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => 'zh-CN',
        setItem: () => undefined,
      },
    })
    const markup = renderToStaticMarkup(
      <I18nProvider>
        <LanguageProbe />
      </I18nProvider>,
    )
    expect(markup).toContain('data-locale="zh-CN"')
  })

  it('ignores invalid saved values and applies the browser strategy', () => {
    vi.stubGlobal('navigator', { language: 'zh-CN' })
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => 'fr',
        setItem: () => undefined,
      },
    })
    const markup = renderToStaticMarkup(
      <I18nProvider>
        <LanguageProbe />
      </I18nProvider>,
    )
    expect(markup).toContain('data-locale="zh-CN"')
  })
})
