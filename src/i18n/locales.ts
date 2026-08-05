/** Supported interface languages. English is the complete fallback. */
export type Locale = 'en' | 'zh-CN'

/** Stable list of supported languages in display order. */
export const SUPPORTED_LOCALES: readonly Locale[] = ['en', 'zh-CN']

/** Default language used whenever the browser and storage provide no signal. */
export const DEFAULT_LOCALE: Locale = 'en'

/** localStorage key that persists the user's manual language choice. */
export const LOCALE_STORAGE_KEY = 'pixel-effect-generator:locale'

/** Native display names shown in the language selector. */
export const LOCALE_DISPLAY_NAMES: Readonly<Record<Locale, string>> = {
  en: 'English',
  'zh-CN': '简体中文',
}

/** Narrowing guard for arbitrary runtime values. */
export function isSupportedLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(value)
}

/**
 * Resolves the initial interface language:
 * a valid saved value wins, otherwise any `zh*` browser language selects
 * Simplified Chinese, and everything else falls back to English.
 */
export function resolveInitialLocale(
  storedLocale: string | null | undefined,
  browserLanguage: string | null | undefined,
): Locale {
  if (isSupportedLocale(storedLocale)) {
    return storedLocale
  }
  if (typeof browserLanguage === 'string' && browserLanguage.toLowerCase().startsWith('zh')) {
    return 'zh-CN'
  }
  return DEFAULT_LOCALE
}

/** Safely reads a previously saved locale without touching browser globals in static renders. */
export function readStoredLocale(): string | null {
  if (typeof window === 'undefined') {
    return null
  }
  try {
    return window.localStorage.getItem(LOCALE_STORAGE_KEY)
  } catch {
    return null
  }
}

/** Persists the user's language choice, ignoring unavailable or restricted storage. */
export function writeStoredLocale(locale: Locale): void {
  if (!isSupportedLocale(locale) || typeof window === 'undefined') {
    return
  }
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale)
  } catch {
    // Storage can be blocked (private mode, sandboxed frame); the UI still works for this visit.
  }
}

/** Safely reads the browser language tag without touching browser globals in static renders. */
export function readBrowserLanguage(): string | null {
  if (typeof navigator === 'undefined') {
    return null
  }
  return navigator.language ?? null
}
