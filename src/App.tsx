import { useEffect, useMemo, useRef, useState } from 'react'
import {
  DEFAULT_SLASH_PARAMETERS,
  hexToRgb,
  packHorizontalSheet,
  renderSlashFrames,
  rgbToHex,
  type SlashFrame,
  type SlashParameters,
} from './core/slashRenderer'

const PREVIEW_FPS = 12

interface NumberControlProps {
  readonly label: string
  readonly value: number
  readonly minimum: number
  readonly maximum: number
  readonly step?: number
  readonly unit?: string
  readonly onChange: (value: number) => void
}

export default function App() {
  const [parameters, setParameters] = useState<SlashParameters>(DEFAULT_SLASH_PARAMETERS)
  const [frameIndex, setFrameIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(true)
  const previewCanvas = useRef<HTMLCanvasElement>(null)
  const frames = useMemo(() => renderSlashFrames(parameters), [parameters])

  useEffect(() => {
    setFrameIndex((current) => current % frames.length)
  }, [frames.length])

  useEffect(() => {
    if (!isPlaying) {
      return undefined
    }

    const interval = window.setInterval(() => {
      setFrameIndex((current) => (current + 1) % frames.length)
    }, 1000 / PREVIEW_FPS)
    return () => window.clearInterval(interval)
  }, [frames.length, isPlaying])

  useEffect(() => {
    const canvas = previewCanvas.current
    if (canvas) {
      drawFrame(canvas, frames[frameIndex % frames.length])
    }
  }, [frameIndex, frames])

  const updateNumber = (key: keyof SlashParameters, value: number) => {
    setParameters((current) => {
      const next = { ...current, [key]: value }
      if (key === 'radius' && next.thickness > value) {
        next.thickness = value
      }
      return next
    })
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
          <p className="subtitle">A growing collection of deterministic, pixel-perfect VFX tools.</p>
        </div>
        <div className="status-chip"><span />128 × 128 RGBA</div>
      </header>

      <section className="workspace">
        <aside className="panel controls-panel">
          <div className="panel-heading">
            <div>
              <p className="section-label">GENERATOR 01 · SLASH</p>
              <h2>Slash parameters</h2>
            </div>
            <button
              className="text-button"
              onClick={() => {
                setParameters(DEFAULT_SLASH_PARAMETERS)
                setFrameIndex(0)
              }}
            >
              Reset
            </button>
          </div>

          <div className="control-section">
            <h3>Color bands</h3>
            <div className="color-grid">
              <ColorControl
                label="Inner"
                value={rgbToHex(parameters.innerColor)}
                onChange={(value) => setParameters((current) => ({ ...current, innerColor: hexToRgb(value) }))}
              />
              <ColorControl
                label="Outer"
                value={rgbToHex(parameters.outerColor)}
                onChange={(value) => setParameters((current) => ({ ...current, outerColor: hexToRgb(value) }))}
              />
            </div>
          </div>

          <div className="control-section">
            <h3>Geometry</h3>
            <NumberControl label="Radius" value={parameters.radius} minimum={2} maximum={63} unit="px" onChange={(value) => updateNumber('radius', value)} />
            <NumberControl label="Thickness" value={parameters.thickness} minimum={1} maximum={parameters.radius} unit="px" onChange={(value) => updateNumber('thickness', value)} />
            <NumberControl label="Total arc" value={parameters.arcDegrees} minimum={30} maximum={360} unit="°" onChange={(value) => updateNumber('arcDegrees', value)} />
            <NumberControl label="Rotation" value={parameters.rotationDegrees} minimum={-180} maximum={180} unit="°" onChange={(value) => updateNumber('rotationDegrees', value)} />
            <NumberControl label="Perspective tilt" value={parameters.tiltDegrees} minimum={0} maximum={75} unit="°" onChange={(value) => updateNumber('tiltDegrees', value)} />
          </div>

          <div className="control-section">
            <h3>Animation</h3>
            <NumberControl label="Frames" value={parameters.frameCount} minimum={5} maximum={24} onChange={(value) => updateNumber('frameCount', value)} />
          </div>
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
            <button className="icon-button" onClick={() => setIsPlaying((current) => !current)} aria-label={isPlaying ? 'Pause animation' : 'Play animation'}>
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
            <span>{PREVIEW_FPS} FPS</span>
          </div>

          <div className="export-row">
            <div>
              <strong>Horizontal sprite sheet</strong>
              <span>{parameters.frameCount * 128} × 128 px · transparent PNG</span>
            </div>
            <button className="primary-button" onClick={exportSpriteSheet}>Export PNG</button>
          </div>
        </section>
      </section>
    </main>
  )
}

function NumberControl({ label, value, minimum, maximum, step = 1, unit = '', onChange }: NumberControlProps) {
  return (
    <label className="number-control">
      <span>{label}</span>
      <input aria-label={label} type="range" min={minimum} max={maximum} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
      <span className="number-field">
        <input aria-label={`${label} value`} type="number" min={minimum} max={maximum} step={step} value={value} onChange={(event) => onChange(clamp(Number(event.target.value), minimum, maximum))} />
        <small>{unit}</small>
      </span>
    </label>
  )
}

function ColorControl({ label, value, onChange }: { readonly label: string; readonly value: string; readonly onChange: (value: string) => void }) {
  return (
    <label className="color-control">
      <span>{label}</span>
      <span className="color-input-wrap">
        <input type="color" value={value} onChange={(event) => onChange(event.target.value)} />
        <code>{value.toUpperCase()}</code>
      </span>
    </label>
  )
}

function drawFrame(canvas: HTMLCanvasElement, frame: SlashFrame): void {
  canvas.width = frame.width
  canvas.height = frame.height
  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('Canvas 2D is unavailable.')
  }
  context.putImageData(new ImageData(new Uint8ClampedArray(frame.pixels), frame.width, frame.height), 0, 0)
}

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

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}
