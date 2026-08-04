import { useEffect, useMemo, useRef, useState } from 'react'
import { SlashControls } from './components/SlashControls'
import {
  GENERATOR_CATALOG,
  SLASH_CATEGORIES,
  type GeneratorDefinition,
  type SlashCategory,
} from './core/generatorCatalog'
import {
  DEFAULT_SLASH_PARAMETERS,
  packHorizontalSheet,
  renderSlashFrames,
  type SlashFrame,
  type SlashParameters,
} from './core/slashRenderer'

const DEFAULT_PREVIEW_FPS = 12
const PREVIEW_FPS_OPTIONS = [6, 8, 12, 18, 24] as const

/** Hosts generator navigation, Slash parameter state, preview playback, and export. */
export default function App() {
  const [selectedGeneratorId, setSelectedGeneratorId] = useState<GeneratorDefinition['id']>('slash')
  const [activeCategory, setActiveCategory] = useState<SlashCategory>('shape')
  const [parameters, setParameters] = useState<SlashParameters>(DEFAULT_SLASH_PARAMETERS)
  const [frameIndex, setFrameIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(true)
  const [previewFps, setPreviewFps] = useState(DEFAULT_PREVIEW_FPS)
  const previewCanvas = useRef<HTMLCanvasElement>(null)
  const frames = useMemo(() => renderSlashFrames(parameters), [parameters])
  const category = SLASH_CATEGORIES.find((entry) => entry.id === activeCategory)!

  useEffect(() => {
    setFrameIndex((current) => current % frames.length)
  }, [frames.length])

  useEffect(() => {
    if (!isPlaying) {
      return undefined
    }
    const interval = window.setInterval(() => {
      setFrameIndex((current) => (current + 1) % frames.length)
    }, 1000 / previewFps)
    return () => window.clearInterval(interval)
  }, [frames.length, isPlaying, previewFps])

  useEffect(() => {
    const canvas = previewCanvas.current
    if (canvas) {
      drawFrame(canvas, frames[frameIndex % frames.length])
    }
  }, [frameIndex, frames])

  const reset = () => {
    setParameters(DEFAULT_SLASH_PARAMETERS)
    setActiveCategory('shape')
    setFrameIndex(0)
    setIsPlaying(false)
    setPreviewFps(DEFAULT_PREVIEW_FPS)
  }

  const exportSpriteSheet = () => {
    const sheet = packHorizontalSheet(frames)
    const canvas = document.createElement('canvas')
    drawFrame(canvas, sheet)
    canvas.toBlob((blob) => {
      if (blob) {
        downloadBlob(blob, `pixel-slash-${parameters.frameCount}-frames.png`)
      }
    }, 'image/png')
  }

  return (
    <main className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">PIXEL EFFECT TOOLKIT</p>
          <h1>Pixel Effect Generator</h1>
          <p className="subtitle">Focused generators for deterministic, pixel-perfect game VFX.</p>
        </div>
        <div className="status-chip"><span />128 × 128 RGBA</div>
      </header>

      <section className="workspace">
        <nav className="panel generator-panel" aria-label="Effect generators">
          <div className="navigation-heading">
            <p className="section-label">GENERATORS</p>
            <span>{GENERATOR_CATALOG.length.toString().padStart(2, '0')}</span>
          </div>
          <div className="generator-list">
            {GENERATOR_CATALOG.map((generator) => (
              <button
                className={`generator-item ${selectedGeneratorId === generator.id ? 'active' : ''}`}
                type="button"
                key={generator.id}
                aria-current={selectedGeneratorId === generator.id ? 'page' : undefined}
                onClick={() => setSelectedGeneratorId(generator.id)}
              >
                <span className="generator-index">{String(generator.index).padStart(2, '0')}</span>
                <span>
                  <strong>{generator.name}</strong>
                  <small>{generator.description}</small>
                </span>
              </button>
            ))}
          </div>
          <p className="catalog-note">New effect families can join this catalog without changing the Slash renderer.</p>
        </nav>

        <aside className="panel controls-panel">
          <div className="panel-heading controls-heading">
            <div>
              <p className="section-label">GENERATOR 01 · SLASH</p>
              <h2>Slash parameters</h2>
            </div>
            <button className="text-button" type="button" onClick={reset}>Reset</button>
          </div>

          <div className="category-tabs" role="tablist" aria-label="Slash parameter categories">
            {SLASH_CATEGORIES.map((entry) => (
              <button
                className={activeCategory === entry.id ? 'active' : ''}
                type="button"
                role="tab"
                aria-selected={activeCategory === entry.id}
                key={entry.id}
                onClick={() => setActiveCategory(entry.id)}
              >
                {entry.label}
              </button>
            ))}
          </div>

          <section className="category-content" aria-labelledby="active-category-title">
            <div className="category-heading">
              <p className="section-label">{category.label.toUpperCase()}</p>
              <h3 id="active-category-title">{category.label} controls</h3>
              <p>{category.description}</p>
            </div>
            <SlashControls category={activeCategory} parameters={parameters} onChange={setParameters} />
          </section>
        </aside>

        <section className="panel preview-panel">
          <div className="panel-heading preview-heading">
            <div>
              <p className="section-label">LIVE PREVIEW</p>
              <h2>Sweep study</h2>
            </div>
            <span className="frame-counter">{String(frameIndex + 1).padStart(2, '0')} / {String(frames.length).padStart(2, '0')}</span>
          </div>

          <div className="preview-stage">
            <div className="canvas-wrap">
              <canvas ref={previewCanvas} className="pixel-canvas" aria-label="Animated pixel slash preview" />
              <div className="origin-mark" aria-hidden="true" />
            </div>
          </div>

          <div className="playback">
            <div className="playback-timeline">
              <button className="icon-button" type="button" onClick={() => setIsPlaying((current) => !current)} aria-label={isPlaying ? 'Pause animation' : 'Play animation'}>
                {isPlaying ? 'Ⅱ' : '▶'}
              </button>
              <input
                aria-label="Current frame"
                type="range"
                min="0"
                max={frames.length - 1}
                value={frameIndex}
                onChange={(event) => {
                  setIsPlaying(false)
                  setFrameIndex(Number(event.target.value))
                }}
              />
              <span>{String(frameIndex + 1).padStart(2, '0')} / {String(frames.length).padStart(2, '0')}</span>
            </div>
            <div className="preview-settings" aria-label="Preview timing settings">
              <label className="frame-setting">
                <span>Total frames</span>
                <span className="compact-range">
                  <input
                    aria-label="Total frames"
                    type="range"
                    min="5"
                    max="24"
                    step="1"
                    value={parameters.frameCount}
                    onChange={(event) => setParameters({ ...parameters, frameCount: clampFrameCount(Number(event.target.value)) })}
                  />
                  <input
                    aria-label="Total frames value"
                    type="number"
                    min="5"
                    max="24"
                    step="1"
                    value={parameters.frameCount}
                    onChange={(event) => setParameters({ ...parameters, frameCount: clampFrameCount(Number(event.target.value)) })}
                  />
                </span>
              </label>
              <label>
                <span>Playback FPS</span>
                <select aria-label="Playback FPS" value={previewFps} onChange={(event) => setPreviewFps(Number(event.target.value))}>
                  {PREVIEW_FPS_OPTIONS.map((fps) => <option value={fps} key={fps}>{fps} FPS</option>)}
                </select>
              </label>
              <strong>{previewFps} FPS preview</strong>
            </div>
          </div>

          <div className="export-row">
            <div>
              <strong>Horizontal sprite sheet</strong>
              <span>{parameters.frameCount * 128} × 128 px · transparent PNG</span>
            </div>
            <button className="primary-button" type="button" onClick={exportSpriteSheet}>Export PNG</button>
          </div>
        </section>
      </section>
    </main>
  )
}

/** Clamps the exported animation length to the supported whole-frame range. */
function clampFrameCount(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_SLASH_PARAMETERS.frameCount
  }
  return Math.min(24, Math.max(5, Math.round(value)))
}

/** Draws one already-rasterized RGBA frame without invoking Canvas geometry. */
function drawFrame(canvas: HTMLCanvasElement, frame: SlashFrame): void {
  canvas.width = frame.width
  canvas.height = frame.height
  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('Canvas 2D is unavailable.')
  }
  context.putImageData(new ImageData(new Uint8ClampedArray(frame.pixels), frame.width, frame.height), 0, 0)
}

/** Starts a local browser download and releases its object URL on the next task. */
function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}
