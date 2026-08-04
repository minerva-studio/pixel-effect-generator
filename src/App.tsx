import { useState } from 'react'
import type { RegisteredGeneratorAction } from './generators/contract'
import {
  GENERATOR_REGISTRY,
  createDefaultSessionRecord,
  updateSessionRecord,
  type GeneratorId,
} from './generators/registry'

const DEFAULT_PREVIEW_FPS = 12

/** Hosts per-generator sessions, navigation, preview playback, and export. */
export default function App() {
  const [selectedGeneratorId, setSelectedGeneratorId] = useState<GeneratorId>(
    GENERATOR_REGISTRY.registrations[0].id,
  )
  const [sessions, setSessions] = useState(() => createDefaultSessionRecord(GENERATOR_REGISTRY, DEFAULT_PREVIEW_FPS))
  const activeGenerator = GENERATOR_REGISTRY.get(selectedGeneratorId)
  const activeSession = sessions[selectedGeneratorId]
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
          <p className="eyebrow">PIXEL EFFECT TOOLKIT</p>
          <h1>Pixel Effect Generator</h1>
          <p className="subtitle">Focused generators for deterministic, pixel-perfect game VFX.</p>
        </div>
        <div className="status-chip"><span />{activeGenerator.frameWidth} × {activeGenerator.frameHeight} RGBA</div>
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

/** Narrows dynamic workspace ids to generators present in the production registry. */
function isGeneratorId(id: string): id is GeneratorId {
  return id in GENERATOR_REGISTRY.record
}
