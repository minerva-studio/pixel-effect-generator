import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_LOCALE,
  isSupportedLocale,
  readBrowserLanguage,
  readStoredLocale,
  resolveInitialLocale,
  writeStoredLocale,
} from '../locales'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('resolveInitialLocale', () => {
  it('prefers a valid saved value over the browser language', () => {
    expect(resolveInitialLocale('zh-CN', 'en-US')).toBe('zh-CN')
    expect(resolveInitialLocale('en', 'zh-TW')).toBe('en')
  })

  it('selects Simplified Chinese for any zh prefixed browser language without a saved value', () => {
    for (const language of ['zh', 'zh-CN', 'zh-TW', 'zh-Hans-CN']) {
      expect(resolveInitialLocale(null, language)).toBe('zh-CN')
    }
  })

  it('falls back to English for non-Chinese or missing browser languages', () => {
    expect(resolveInitialLocale(null, 'en-US')).toBe('en')
    expect(resolveInitialLocale(null, 'fr')).toBe('en')
    expect(resolveInitialLocale(null, undefined)).toBe('en')
    expect(resolveInitialLocale(null, '')).toBe('en')
    expect(resolveInitialLocale(undefined, undefined)).toBe(DEFAULT_LOCALE)
  })

  it('ignores invalid saved values and applies the browser strategy', () => {
    expect(resolveInitialLocale('fr', 'zh-CN')).toBe('zh-CN')
    expect(resolveInitialLocale('fr', 'en-US')).toBe('en')
    expect(resolveInitialLocale('ja', null)).toBe('en')
  })

  it('guards supported locale values', () => {
    expect(isSupportedLocale('en')).toBe(true)
    expect(isSupportedLocale('zh-CN')).toBe(true)
    expect(isSupportedLocale('fr')).toBe(false)
    expect(isSupportedLocale(null)).toBe(false)
    expect(isSupportedLocale(undefined)).toBe(false)
  })
})

describe('browser storage access', () => {
  it('reads storage and navigator safely without browser globals', () => {
    vi.stubGlobal('navigator', undefined)
    expect(readStoredLocale()).toBeNull()
    expect(readBrowserLanguage()).toBeNull()
  })

  it('round-trips a saved locale through storage', () => {
    const stored = new Map<string, string>()
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (key: string) => stored.get(key) ?? null,
        setItem: (key: string, value: string) => {
          stored.set(key, value)
        },
      },
    })
    writeStoredLocale('zh-CN')
    expect(readStoredLocale()).toBe('zh-CN')
  })

  it('restores a saved locale on the next initialization', () => {
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => 'zh-CN',
        setItem: () => undefined,
      },
    })
    expect(resolveInitialLocale(readStoredLocale(), 'en-US')).toBe('zh-CN')
  })

  it('reads the browser language when navigator is available', () => {
    vi.stubGlobal('navigator', { language: 'zh-TW' })
    expect(readBrowserLanguage()).toBe('zh-TW')
  })
})
