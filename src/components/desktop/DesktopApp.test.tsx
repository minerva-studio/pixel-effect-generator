import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import App from '../../App'
import { I18nProvider } from '../../i18n/I18nProvider'
import type { DesktopAppApi } from '../../electron/desktopApi'
import { DesktopProvider } from './DesktopProvider'
import { nextMenuIndex } from './DesktopTitleBar'

function fakeDesktopApi(): DesktopAppApi {
  return {
    isDesktop: true,
    saveFile: vi.fn(async () => ({ status: 'saved' as const })),
    window: {
      minimize: vi.fn(async () => undefined),
      toggleMaximize: vi.fn(async () => undefined),
      toggleFullScreen: vi.fn(async () => undefined),
      requestClose: vi.fn(async () => undefined),
      completeCloseSave: vi.fn(async () => undefined),
      isMaximized: vi.fn(async () => false),
      onMaximizedChanged: vi.fn(() => () => undefined),
    },
    project: {
      open: vi.fn(async () => ({ status: 'cancelled' as const })),
      openRecent: vi.fn(async () => ({ status: 'cancelled' as const })),
      confirmOpen: vi.fn(async () => undefined),
      save: vi.fn(async () => ({ status: 'cancelled' as const })),
      saveAs: vi.fn(async () => ({ status: 'cancelled' as const })),
      recent: vi.fn(async () => []),
      clearRecent: vi.fn(async () => undefined),
      setDirty: vi.fn(async () => undefined),
      confirmUnsaved: vi.fn(async () => 'cancel' as const),
      onMenuAction: vi.fn(() => () => undefined),
      onSaveRequested: vi.fn(() => () => undefined),
    },
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('desktop vs web shell', () => {
  it('renders the desktop title bar and File menu only when the bridge exists', () => {
    vi.stubGlobal('navigator', undefined)
    vi.stubGlobal('window', { pixelEffectDesktop: fakeDesktopApi() })
    const markup = renderToStaticMarkup(
      <I18nProvider>
        <DesktopProvider>
          <App />
        </DesktopProvider>
      </I18nProvider>,
    )
    expect(markup).toContain('class="desktop-titlebar"')
    expect(markup).toContain('>File<')
    expect(markup).toContain('id="desktop-export-button"')
    expect(markup).toContain('>Export<')
    expect(markup).toContain('Untitled')
    expect(markup).toContain('aria-label="Minimize"')
    expect(markup).toContain('class="titlebar-language"')
    expect(markup).toContain('aria-label="Interface language"')
    expect(markup).toContain('class="desktop-export-backdrop" hidden=""')
    expect(markup).not.toContain('class="hero"')
    expect(markup).not.toContain('class="status-chip"')
    expect(markup).not.toContain('class="desktop-header"')
    const appName = markup.indexOf('titlebar-app-name')
    const file = markup.indexOf('>File<')
    const exportButton = markup.indexOf('id="desktop-export-button"')
    const language = markup.indexOf('class="titlebar-language"')
    const project = markup.indexOf('class="titlebar-project"')
    const minimize = markup.indexOf('aria-label="Minimize"')
    expect(appName).toBeGreaterThan(-1)
    expect(file).toBeGreaterThan(appName)
    expect(exportButton).toBeGreaterThan(file)
    expect(language).toBeGreaterThan(exportButton)
    expect(project).toBeGreaterThan(language)
    expect(minimize).toBeGreaterThan(project)
  })

  it('keeps the web hero and hides desktop chrome without the bridge', () => {
    const markup = renderToStaticMarkup(
      <I18nProvider>
        <DesktopProvider>
          <App />
        </DesktopProvider>
      </I18nProvider>,
    )
    expect(markup).toContain('class="hero"')
    expect(markup).not.toContain('desktop-titlebar')
    expect(markup).not.toContain('>File<')
    expect(markup).toContain('128 × 128 RGBA')
  })
})

describe('nextMenuIndex', () => {
  it('cycles forward and backward', () => {
    expect(nextMenuIndex(0, 5, 1)).toBe(1)
    expect(nextMenuIndex(4, 5, 1)).toBe(0)
    expect(nextMenuIndex(0, 5, -1)).toBe(4)
  })

  it('starts at first or last when nothing is focused', () => {
    expect(nextMenuIndex(-1, 5, 1)).toBe(0)
    expect(nextMenuIndex(-1, 5, -1)).toBe(4)
  })

  it('returns -1 for empty menus', () => {
    expect(nextMenuIndex(0, 0, 1)).toBe(-1)
  })
})
