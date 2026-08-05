import { useEffect, useId, useRef, useState } from 'react'
import { useI18n } from '../../i18n/I18nProvider'
import {
  LOCALE_DISPLAY_NAMES,
  SUPPORTED_LOCALES,
  isSupportedLocale,
} from '../../i18n/locales'
import { useDesktopApp } from './DesktopProvider'
import type { ProjectWorkflow } from './useProjectWorkflow'

/** Desktop-only window chrome with a draggable region and File menu. */
export function DesktopTitleBar({ workflow }: { readonly workflow: ProjectWorkflow }) {
  const { t, locale, setLocale } = useI18n()
  const api = useDesktopApp()
  const [maximized, setMaximized] = useState(false)
  const [fileOpen, setFileOpen] = useState(false)
  const fileButtonRef = useRef<HTMLButtonElement | null>(null)
  const fileMenuRef = useRef<HTMLDivElement | null>(null)
  const fileMenuId = useId()

  useEffect(() => {
    if (api === null) {
      return undefined
    }
    let mounted = true
    void api.window.isMaximized().then((value) => {
      if (mounted) {
        setMaximized(value)
      }
    })
    const unsubscribe = api.window.onMaximizedChanged(setMaximized)
    return () => {
      mounted = false
      unsubscribe()
    }
  }, [api])

  useEffect(() => {
    if (!fileOpen) {
      return undefined
    }
    const handlePointerDown = (event: PointerEvent) => {
      if (fileMenuRef.current && !fileMenuRef.current.contains(event.target as Node)) {
        setFileOpen(false)
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setFileOpen(false)
        fileButtonRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [fileOpen])

  if (api === null) {
    return null
  }

  return (
    <header className="desktop-titlebar">
      <div className="titlebar-brand">
        <SlashMark />
        <span className="titlebar-app-name">{t('app.title')}</span>
        <span className="titlebar-project-name">{workflow.currentFileName ?? t('desktop.titleBar.untitled')}</span>
        {workflow.dirty ? (
          <span className="titlebar-dirty" role="status" aria-label={t('desktop.titleBar.unsaved')}>●</span>
        ) : null}
      </div>
      <div className="titlebar-file" ref={fileMenuRef}>
        <button
          className="titlebar-button"
          type="button"
          ref={fileButtonRef}
          aria-haspopup="menu"
          aria-expanded={fileOpen}
          aria-controls={fileMenuId}
          onClick={() => setFileOpen((open) => !open)}
        >
          {t('desktop.titleBar.file')}
        </button>
        {fileOpen ? (
          <div className="titlebar-file-menu" id={fileMenuId} role="menu" aria-label={t('desktop.titleBar.file')}>
            <button type="button" role="menuitem" onClick={() => { setFileOpen(false); workflow.newProject() }}>
              <span>{t('desktop.titleBar.newProject')}</span>
              <kbd>Ctrl+N</kbd>
            </button>
            <button type="button" role="menuitem" onClick={() => { setFileOpen(false); workflow.openProject() }}>
              <span>{t('desktop.titleBar.openProject')}</span>
              <kbd>Ctrl+O</kbd>
            </button>
            <div className="titlebar-recent" role="group" aria-label={t('desktop.titleBar.openRecent')}>
              <span className="titlebar-recent-label">{t('desktop.titleBar.openRecent')}</span>
              {workflow.recents.length === 0 ? (
                <span className="titlebar-recent-empty">{t('desktop.titleBar.noRecent')}</span>
              ) : (
                workflow.recents.map((recent) => (
                  <button
                    type="button"
                    role="menuitem"
                    key={recent.id}
                    onClick={() => { setFileOpen(false); workflow.openRecent(recent.id) }}
                  >
                    <span className="titlebar-recent-name">{recent.name}</span>
                  </button>
                ))
              )}
              {workflow.recents.length > 0 ? (
                <button type="button" className="titlebar-recent-clear" onClick={workflow.clearRecent}>
                  {t('desktop.titleBar.clearRecent')}
                </button>
              ) : null}
            </div>
            <button type="button" role="menuitem" onClick={() => { setFileOpen(false); workflow.saveProject() }}>
              <span>{t('desktop.titleBar.save')}</span>
              <kbd>Ctrl+S</kbd>
            </button>
            <button type="button" role="menuitem" onClick={() => { setFileOpen(false); workflow.saveProjectAs() }}>
              <span>{t('desktop.titleBar.saveAs')}</span>
              <kbd>Ctrl+Shift+S</kbd>
            </button>
            <span className="titlebar-menu-separator" />
            <button type="button" role="menuitem" onClick={() => { setFileOpen(false); workflow.exitProject() }}>
              <span>{t('desktop.titleBar.exit')}</span>
              <kbd>Alt+F4</kbd>
            </button>
          </div>
        ) : null}
      </div>
      <div className="titlebar-drag" onDoubleClick={() => void api.window.toggleMaximize()} />
      <div className="titlebar-tools">
        <select
          className="titlebar-language"
          aria-label={t('app.languageLabel')}
          value={locale}
          onChange={(event) => {
            const nextLocale = event.target.value
            if (isSupportedLocale(nextLocale)) {
              setLocale(nextLocale)
            }
          }}
        >
          {SUPPORTED_LOCALES.map((option) => (
            <option value={option} key={option}>{LOCALE_DISPLAY_NAMES[option]}</option>
          ))}
        </select>
        <button
          className="titlebar-button"
          type="button"
          aria-label={t('desktop.titleBar.minimize')}
          onClick={() => void api.window.minimize()}
        >
          <span aria-hidden="true">─</span>
        </button>
        <button
          className="titlebar-button"
          type="button"
          aria-label={maximized ? t('desktop.titleBar.restore') : t('desktop.titleBar.maximize')}
          onClick={() => void api.window.toggleMaximize()}
        >
          <span aria-hidden="true">{maximized ? '❐' : '□'}</span>
        </button>
        <button
          className="titlebar-button titlebar-close"
          type="button"
          aria-label={t('desktop.titleBar.close')}
          onClick={() => void api.window.requestClose()}
        >
          <span aria-hidden="true">×</span>
        </button>
      </div>
    </header>
  )
}

/** Small inline pixel-slash mark used while no branded asset is needed. */
function SlashMark() {
  return (
    <svg className="titlebar-mark" width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        d="M 3 14 A 8 8 0 0 1 14 3"
        fill="none"
        stroke="#9db8ff"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M 3 14 A 8 8 0 0 1 14 3"
        fill="none"
        stroke="#ffffff"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  )
}
