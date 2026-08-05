import { createContext, useCallback, useContext, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react'
import {
  isSupportedLocale,
  readBrowserLanguage,
  readStoredLocale,
  resolveInitialLocale,
  writeStoredLocale,
  type Locale,
} from './locales'
import {
  messagesForLocale,
  translate,
  type MessageKey,
  type ParamsFor,
  type TranslateFunction,
} from './messages'

/** Context value exposed to every React interface component. */
export interface I18nContextValue {
  readonly locale: Locale
  readonly setLocale: (locale: Locale) => void
  readonly t: TranslateFunction
}

/**
 * Framework-agnostic locale state: switching immediately updates the value,
 * notifies subscribers, and persists the choice. Invalid locales are ignored.
 */
export interface LocaleStore {
  getLocale(): Locale
  setLocale(next: Locale): void
  subscribe(listener: () => void): () => void
}

/** Creates a locale store with synchronous notifications and persistence. */
export function createLocaleStore(
  initialLocale: Locale,
  persist: (locale: Locale) => void = writeStoredLocale,
): LocaleStore {
  let locale = initialLocale
  const listeners = new Set<() => void>()
  return {
    getLocale: () => locale,
    setLocale: (next) => {
      if (!isSupportedLocale(next) || next === locale) {
        return
      }
      locale = next
      persist(next)
      for (const listener of listeners) {
        listener()
      }
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

const I18nContext = createContext<I18nContextValue | null>(null)

/** Provides the interface language and translation function to the whole app. */
export function I18nProvider({ children }: { readonly children: ReactNode }) {
  const [store] = useState(() => createLocaleStore(resolveInitialLocale(readStoredLocale(), readBrowserLanguage())))
  const locale = useSyncExternalStore(store.subscribe, store.getLocale, store.getLocale)
  const setLocale = useCallback((next: Locale) => {
    store.setLocale(next)
  }, [store])
  const t = useCallback<TranslateFunction>((key: MessageKey, params?: ParamsFor<MessageKey>) => (
    translate(messagesForLocale(locale), key, params)
  ), [locale])
  const value = useMemo<I18nContextValue>(() => ({ locale, setLocale, t }), [locale, setLocale, t])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

/** Returns the active language context; must be used below I18nProvider. */
export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext)
  if (context === null) {
    throw new Error('useI18n must be used within I18nProvider.')
  }
  return context
}
