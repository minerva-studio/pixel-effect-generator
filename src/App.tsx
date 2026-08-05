import { useState } from 'react'
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

const DEFAULT_PREVIEW_FPS = 12

/** Hosts per-generator sessions, navigation, preview playback, and export. */
export default function App() {
  const { t, locale, setLocale } = useI18n()
  const [selectedGeneratorId, setSelectedGeneratorId] = useState<GeneratorId>(
    GENERATOR_REGISTRY.registrations[0].id,
  )
  const [sessions, setSessions] = useState(() => createDefaultSessionRecord(GENERATOR_REGISTRY, DEFAULT_PREVIEW_FPS))
  const activeGenerator = GENERATOR_REGISTRY.get(selectedGeneratorId)
  const activeSession = sessions[selectedGeneratorId]
  const activeSize = activeSessionSize(activeSession)
  const ActiveWorkspace = activeGenerator.Workspace

  const dispatch = (action: RegisteredGeneratorAction<string>) => {
    const generatorId = action.generatorId
    if (!isGeneratorId(generatorId)) {
      throw new Error(`Unknown generator action source: ${generatorId}`)
    }
    setSessions((current) => updateSessionRecord(
      GENERATOR_REGISTRY.record,
      current,
      { ...action, generatorId },
    ))
  }

  const reset = () => {
    const defaultSession = activeGenerator.createSession(DEFAULT_PREVIEW_FPS)
    setSessions((current) => ({
      ...current,
      [selectedGeneratorId]: activeGenerator.reduceSession(defaultSession, {
        generatorId: selectedGeneratorId,
        action: { type: 'play', isPlaying: current[selectedGeneratorId].isPlaying },
      }),
    }))
  }

  return (
    <main className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">{t('app.eyebrow')}</p>
          <h1>{t('app.title')}</h1>
          <p className="subtitle">{t('app.subtitle')}</p>
        </div>
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
      </header>
      <ActiveWorkspace
        session={activeSession}
        selectedGeneratorId={selectedGeneratorId}
        onSelectGenerator={(id) => {
          if (isGeneratorId(id)) {
            setSelectedGeneratorId(id)
          }
        }}
        onSessionAction={dispatch}
        onReset={reset}
      />
    </main>
  )
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
