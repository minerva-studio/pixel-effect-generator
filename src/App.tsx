import { useCallback, useEffect, useState } from 'react'
import type { DesktopAppApi } from './electron/desktopApi'
import type { RegisteredGeneratorAction, RegisteredGeneratorSession } from './generators/contract'
import { useI18n } from './i18n/I18nProvider'
import {
  LOCALE_DISPLAY_NAMES,
  SUPPORTED_LOCALES,
  isSupportedLocale,
} from './i18n/locales'
import {
  GENERATOR_REGISTRY,
  createDefaultSessionRecord,
  updateSessionRecord,
  type GeneratorId,
} from './generators/registry'
import { DesktopTitleBar } from './components/desktop/DesktopTitleBar'
import { useDesktopApp } from './components/desktop/DesktopProvider'
import { useProjectWorkflow } from './components/desktop/useProjectWorkflow'
import { useFileOperationController } from './components/fileOperations'
import { useToast } from './components/toast/ToastProvider'
import { DEFAULT_UNITY_EXPORT_SETTINGS, type UnityExportSettingsState } from './components/unitySettings'

const DEFAULT_PREVIEW_FPS = 12

export default function App() {
  const api = useDesktopApp()
  return api === null ? <WebApp /> : <DesktopApp api={api} />
}

function WebApp() {
  const { t } = useI18n()
  const sessions = useGeneratorSessions()
  const ActiveWorkspace = sessions.activeGenerator.Workspace
  return (
    <main className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">{t('app.eyebrow')}</p>
          <h1>{t('app.title')}</h1>
          <p className="subtitle">{t('app.subtitle')}</p>
        </div>
        <LanguageAndStatus activeSize={sessions.activeSize} />
      </header>
      <ActiveWorkspace
        session={sessions.activeSession}
        selectedGeneratorId={sessions.selectedGeneratorId}
        onSelectGenerator={sessions.selectGenerator}
        onSessionAction={sessions.dispatch}
        onReset={sessions.reset}
        unitySettings={sessions.unitySettings}
        onUnitySettingsChange={sessions.setUnitySettings}
        fileOperations={sessions.fileOperations}
      />
    </main>
  )
}

function DesktopApp({ api }: { readonly api: DesktopAppApi }) {
  const { t } = useI18n()
  const toast = useToast()
  const sessions = useGeneratorSessions()
  const [exportOpen, setExportOpen] = useState(false)
  const ActiveWorkspace = sessions.activeGenerator.Workspace
  const workflow = useProjectWorkflow({
    api,
    generator: sessions.activeGenerator,
    session: sessions.activeSession,
    unitySettings: sessions.unitySettings,
    onUnitySettingsChange: sessions.setUnitySettings,
    onSessionAction: sessions.dispatch,
    onReset: sessions.reset,
    fileOperations: sessions.fileOperations,
    toast,
    t,
  })
  /** Closes the export modal and restores keyboard focus to its menu trigger. */
  const closeExport = useCallback(() => {
    setExportOpen(false)
    requestAnimationFrame(() => document.getElementById('desktop-export-button')?.focus())
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space') {
        return
      }
      const target = event.target as HTMLElement | null
      if (target && ['INPUT', 'BUTTON', 'SELECT', 'TEXTAREA'].includes(target.tagName)) {
        return
      }
      event.preventDefault()
      sessions.dispatch({
        generatorId: sessions.activeGenerator.id,
        action: { type: 'play', isPlaying: !sessions.activeSession.isPlaying },
      })
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [sessions.dispatch, sessions.activeGenerator.id, sessions.activeSession.isPlaying])

  return (
    <div className="desktop-shell">
      <DesktopTitleBar
        workflow={workflow}
        busy={sessions.fileOperations.activeTask !== null}
        exportOpen={exportOpen}
        onExport={() => setExportOpen(true)}
      />
      <main className="app-shell desktop-app-shell">
        <ActiveWorkspace
          session={sessions.activeSession}
          selectedGeneratorId={sessions.selectedGeneratorId}
          onSelectGenerator={sessions.selectGenerator}
          onSessionAction={sessions.dispatch}
          onReset={sessions.reset}
          unitySettings={sessions.unitySettings}
          onUnitySettingsChange={sessions.setUnitySettings}
          fileOperations={sessions.fileOperations}
          desktopExportOpen={exportOpen}
          onCloseDesktopExport={closeExport}
        />
      </main>
    </div>
  )
}

function LanguageAndStatus({ activeSize }: { readonly activeSize: { readonly width: number; readonly height: number } }) {
  const { t, locale, setLocale } = useI18n()
  return (
    <div className="hero-actions">
      <select
        className="language-select"
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
      <div className="status-chip">
        <span />
        {t('app.status', {
          width: activeSize.width,
          height: activeSize.height,
        })}
      </div>
    </div>
  )
}

/** Shared per-app generator session state used by both shells. */
function useGeneratorSessions() {
  const [selectedGeneratorId, setSelectedGeneratorId] = useState<GeneratorId>(
    GENERATOR_REGISTRY.registrations[0].id,
  )
  const [sessions, setSessions] = useState(() => createDefaultSessionRecord(GENERATOR_REGISTRY, DEFAULT_PREVIEW_FPS))
  const [unitySettings, setUnitySettings] = useState<UnityExportSettingsState>(DEFAULT_UNITY_EXPORT_SETTINGS)
  const fileOperations = useFileOperationController()

  const activeGenerator = GENERATOR_REGISTRY.getRegistered(selectedGeneratorId)
  const activeSession = sessions[selectedGeneratorId]
  const activeSize = activeSessionSize(activeSession)

  const dispatch = useCallback((action: RegisteredGeneratorAction<string>) => {
    const generatorId = action.generatorId
    if (!isGeneratorId(generatorId)) {
      throw new Error(`Unknown generator action source: ${generatorId}`)
    }
    setSessions((current) => updateSessionRecord(
      GENERATOR_REGISTRY.record,
      current,
      { ...action, generatorId },
    ))
  }, [])

  const reset = useCallback(() => {
    setSessions((current) => {
      const defaultSession = activeGenerator.createSession(DEFAULT_PREVIEW_FPS)
      return {
        ...current,
        [selectedGeneratorId]: activeGenerator.reduceSession(defaultSession, {
          generatorId: selectedGeneratorId,
          action: { type: 'play', isPlaying: current[selectedGeneratorId].isPlaying },
        }),
      }
    })
  }, [activeGenerator, selectedGeneratorId])

  const selectGenerator = useCallback((id: string) => {
    if (isGeneratorId(id)) {
      setSelectedGeneratorId(id)
    }
  }, [])

  return {
    selectedGeneratorId,
    selectGenerator,
    sessions,
    activeGenerator,
    activeSession,
    activeSize,
    unitySettings,
    setUnitySettings,
    fileOperations,
    dispatch,
    reset,
  }
}

function activeSessionSize(session: RegisteredGeneratorSession<string>): { width: number; height: number } {
  const frames = session.frames.read()
  return frames[0]
    ? { width: frames[0].width, height: frames[0].height }
    : { width: 0, height: 0 }
}

/** Narrows dynamic workspace ids to generators present in the production registry. */
function isGeneratorId(id: string): id is GeneratorId {
  return id in GENERATOR_REGISTRY.record
}
