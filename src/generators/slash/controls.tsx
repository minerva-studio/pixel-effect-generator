import { useEffect, useId, useState } from 'react'
import { InfoHint, NumberControl, SelectControl } from '../../components/controls'
import { hexToRgb, rgbToHex } from '../../shared/pixel/color'
import { frameLimits } from './model'
import { insertPaletteColor, removePaletteColor } from './palette'
import { MAX_SWEEP_DEGREES } from './model'
import type { SlashCategory } from './module'
import type { SlashDirection, SlashParameters } from './model'
import type { FrameSize } from '../../shared/pixel/frame'

interface SlashControlsProps {
  readonly category: SlashCategory
  readonly parameters: SlashParameters
  readonly onChange: (parameters: SlashParameters) => void
  readonly onResize?: (nextSize: FrameSize, scaleEffect: boolean) => void
}

/** Renders the active Slash parameter category without owning generator state. */
export function SlashControls({ category, parameters, onChange }: SlashControlsProps) {
  const limits = frameLimits({
    width: parameters.canvasWidth,
    height: parameters.canvasHeight,
  })
  const update = <Key extends keyof SlashParameters>(key: Key, value: SlashParameters[Key]) => {
    const next = { ...parameters, [key]: value }
    if (key === 'radius' && next.thickness > Number(value)) {
      next.thickness = Number(value)
    }
    onChange(next)
  }

  switch (category) {
    case 'shape':
      return (
        <div className="control-list">
          <NumberControl label="Radius" description="Distance from the origin to the slash's outer edge." value={parameters.radius} minimum={2} maximum={limits.maxRadius} unit="px" onChange={(value) => update('radius', value)} />
          <NumberControl label="Thickness" description="Width of the colored arc between its inner and outer edges." value={parameters.thickness} minimum={1} maximum={parameters.radius} unit="px" onChange={(value) => update('thickness', value)} />
          <NumberControl label="Start angle" description="Starting direction in screen space: 0° points right and 90° points down." value={parameters.startAngleDegrees} minimum={-180} maximum={180} unit="°" onChange={(value) => update('startAngleDegrees', value)} />
          <NumberControl label="Sweep angle" description="Degrees travelled from the start angle; values above 360° create a second pass." value={parameters.sweepDegrees} minimum={30} maximum={MAX_SWEEP_DEGREES} unit="°" onChange={(value) => update('sweepDegrees', value)} />
          <NumberControl label="Rotation" description="Rotates the complete local slash path to aim the overall swing in screen space." value={parameters.rotationDegrees} minimum={-180} maximum={180} unit="°" onChange={(value) => update('rotationDegrees', value)} />
          <NumberControl label="Perspective tilt" description="Compresses the slash plane; 90° produces the thinnest stable pixel projection." value={parameters.tiltDegrees} minimum={0} maximum={90} unit="°" onChange={(value) => update('tiltDegrees', value)} />
        </div>
      )
    case 'palette':
      return <PaletteEditor parameters={parameters} onChange={onChange} />
    case 'motion':
      return (
        <div className="control-list">
          <DirectionControl value={parameters.direction} onChange={(value) => update('direction', value)} />
          <NumberControl label="Sweep speed" description="Higher values make the leading edge complete its path sooner." value={parameters.sweepSpeed} minimum={0} maximum={1} step={0.01} scale={100} unit="%" onChange={(value) => update('sweepSpeed', value)} />
          <NumberControl label="Trail length" description="Delays the trailing edge so more of the arc remains visible." value={parameters.trailLength} minimum={0} maximum={1} step={0.01} scale={100} unit="%" onChange={(value) => update('trailLength', value)} />
        </div>
      )
    case 'breakup':
      return (
        <div className="control-list">
          <SelectControl
            label="Dissolve mode"
            description="How the trailing edge erodes pixels: ordered dither, clustered noise blocks, or streak-like tears."
            value={parameters.dissolveMode}
            options={[
              { value: 'ordered', label: 'Ordered' },
              { value: 'clusteredNoise', label: 'Clustered noise' },
              { value: 'directionalStreaks', label: 'Directional streaks' },
            ]}
            onChange={(value) => update('dissolveMode', value)}
          />
          <SelectControl
            label="Edge mode"
            description="How the outer edge breaks up: 2×2 chips, a jagged contour, or wedge-shaped slash cuts."
            value={parameters.edgeBreakupMode}
            options={[
              { value: 'blockChips', label: 'Block chips' },
              { value: 'jaggedContour', label: 'Jagged contour' },
              { value: 'slashCuts', label: 'Slash cuts' },
            ]}
            onChange={(value) => update('edgeBreakupMode', value)}
          />
          <NumberControl label="Dissolve" description="Length of the dissolution transition immediately ahead of the trailing edge." value={parameters.dissolveLength} minimum={0} maximum={1} step={0.01} scale={100} unit="%" onChange={(value) => update('dissolveLength', value)} />
          <NumberControl label="Edge breakup" description="Intensity of outer-edge removal for the active edge mode." value={parameters.edgeBreakup} minimum={0} maximum={1} step={0.01} scale={100} unit="%" onChange={(value) => update('edgeBreakup', value)} />
          <NumberControl label="Breakup depth" description="Maximum depth of edge breakup while preserving the core arc." value={parameters.edgeDepth} minimum={0.05} maximum={0.5} step={0.01} scale={100} unit="%" onChange={(value) => update('edgeDepth', value)} />
        </div>
      )
    case 'fragments':
      return (
        <div className="control-list">
          <SelectControl
            label="Fragment mode"
            description="How debris is drawn: square chunks, tangent-aligned shards, or fast short-lived sparks."
            value={parameters.fragmentMode}
            options={[
              { value: 'pixelChunks', label: 'Pixel chunks' },
              { value: 'directionalShards', label: 'Directional shards' },
              { value: 'energySparks', label: 'Energy sparks' },
            ]}
            onChange={(value) => update('fragmentMode', value)}
          />
          <NumberControl label="Amount" description="Amount of colored debris released as the trailing edge passes." value={parameters.fragmentAmount} minimum={0} maximum={1} step={0.01} scale={100} unit="%" onChange={(value) => update('fragmentAmount', value)} />
          <NumberControl label="Size" description="Maximum chunk width, shard line length, or spark trail length for the selected fragment mode." value={parameters.fragmentSize} minimum={1} maximum={limits.maxFragmentSize} unit="px" onChange={(value) => update('fragmentSize', value)} />
          <NumberControl label="Tangent speed" description="Motion along the direction of the sweep per animation cycle." value={parameters.fragmentTangentSpeed} minimum={0} maximum={limits.maxFragmentTangentSpeed} unit="px" onChange={(value) => update('fragmentTangentSpeed', value)} />
          <NumberControl label="Outward speed" description="Motion away from the slash center per animation cycle." value={parameters.fragmentOutwardSpeed} minimum={0} maximum={limits.maxFragmentOutwardSpeed} unit="px" onChange={(value) => update('fragmentOutwardSpeed', value)} />
          <NumberControl label="Lifetime" description="Fraction of the animation for which detached fragments remain alive." value={parameters.fragmentLifetime} minimum={0.1} maximum={1} step={0.01} scale={100} unit="%" onChange={(value) => update('fragmentLifetime', value)} />
        </div>
      )
  }
}

/** Renders Slash-specific deterministic controls beneath preview timing. */
export function SlashPreviewTools({ parameters, onChange, onResize }: Omit<SlashControlsProps, 'category'>) {
  return (
    <div className="preview-tools">
      <CanvasResizeControl parameters={parameters} onResize={onResize} />
      <SeedControl value={parameters.seed} onChange={(seed) => onChange({ ...parameters, seed })} />
    </div>
  )
}

/** Renders the ordered inner-to-outer palette editor. */
function PaletteEditor({ parameters, onChange }: Omit<SlashControlsProps, 'category'>) {
  const hintId = useId()
  const updateColor = (index: number, color: string) => {
    const palette = parameters.palette.map((current, colorIndex) => colorIndex === index ? hexToRgb(color) : current)
    onChange({ ...parameters, palette })
  }

  return (
    <div className="palette-editor">
      <div className="palette-guide">
        <span>Inner edge</span>
        <InfoHint label="Palette order" description="Bands are sampled directly on the pixel grid. No blended colors are introduced." hintId={hintId} />
        <span>Outer edge</span>
      </div>
      <div className="palette-list">
        {parameters.palette.map((color, index) => (
          <div className="palette-row" key={`${index}-${rgbToHex(color)}`}>
            <span className="palette-order">{String(index + 1).padStart(2, '0')}</span>
            <input aria-label={`Palette band ${index + 1}`} type="color" value={rgbToHex(color)} onChange={(event) => updateColor(index, event.target.value)} />
            <code>{rgbToHex(color).toUpperCase()}</code>
            <button
              className="remove-button"
              type="button"
              disabled={parameters.palette.length <= 2}
              aria-label={`Remove palette band ${index + 1}`}
              onClick={() => onChange({ ...parameters, palette: removePaletteColor(parameters.palette, index) })}
            >
              Remove
            </button>
          </div>
        ))}
      </div>
      <button
        className="secondary-button"
        type="button"
        disabled={parameters.palette.length >= 6}
        onClick={() => onChange({ ...parameters, palette: insertPaletteColor(parameters.palette) })}
      >
        Add color band
      </button>
    </div>
  )
}

/** Renders the two explicit temporal sweep directions. */
function DirectionControl({ value, onChange }: { readonly value: SlashDirection; readonly onChange: (value: SlashDirection) => void }) {
  const hintId = useId()
  return (
    <div className="parameter-field">
      <div className="field-copy">
        <span className="field-title">
          <span className="field-label">Sweep direction</span>
          <InfoHint label="Sweep direction" description="Changes temporal travel along the same arc without flipping the rendered image." hintId={hintId} />
        </span>
      </div>
      <div className="segmented-control" role="group" aria-label="Sweep direction">
        <button
          aria-pressed={value === 'clockwise'}
          className={value === 'clockwise' ? 'active' : ''}
          type="button"
          onClick={() => onChange('clockwise')}
        >
          Clockwise
        </button>
        <button
          aria-pressed={value === 'counterClockwise'}
          className={value === 'counterClockwise' ? 'active' : ''}
          type="button"
          onClick={() => onChange('counterClockwise')}
        >
          Counter
        </button>
      </div>
    </div>
  )
}

/** Renders the reproducible seed field and a cryptographically sourced randomize action. */
function SeedControl({ value, onChange }: { readonly value: number; readonly onChange: (value: number) => void }) {
  const seedId = useId()
  const hintId = useId()
  const randomize = () => {
    const nextSeed = crypto.getRandomValues(new Uint32Array(1))[0]
    onChange(nextSeed)
  }

  return (
    <div className="preview-seed-control">
      <span className="field-title">
        <label htmlFor={seedId}>Random seed</label>
        <InfoHint label="Random seed" description="Re-enter the same unsigned 32-bit value to reproduce breakup exactly." hintId={hintId} />
      </span>
      <div className="seed-inputs">
        <input id={seedId} type="number" min="0" max="4294967295" step="1" value={value} onChange={(event) => onChange(clampSeed(Number(event.target.value)))} />
        <button className="secondary-button" type="button" onClick={randomize}>Randomize</button>
      </div>
    </div>
  )
}

interface CanvasResizeControlProps {
  readonly parameters: SlashParameters
  readonly onResize?: (nextSize: FrameSize, scaleEffect: boolean) => void
}

const CANVAS_PRESETS: readonly { readonly label: string; readonly size: FrameSize }[] = [
  { label: 'Square 32×32', size: { width: 32, height: 32 } },
  { label: 'Square 48×48', size: { width: 48, height: 48 } },
  { label: 'Square 64×64', size: { width: 64, height: 64 } },
  { label: 'Square 96×96', size: { width: 96, height: 96 } },
  { label: 'Square 128×128', size: { width: 128, height: 128 } },
  { label: 'Square 192×192', size: { width: 192, height: 192 } },
  { label: 'Square 256×256', size: { width: 256, height: 256 } },
  { label: 'Horizontal 64×32', size: { width: 64, height: 32 } },
  { label: 'Horizontal 128×64', size: { width: 128, height: 64 } },
  { label: 'Horizontal 256×128', size: { width: 256, height: 128 } },
  { label: 'Custom', size: { width: 0, height: 0 } },
]

function CanvasResizeControl({ parameters, onResize }: CanvasResizeControlProps) {
  const [selectedPreset, setSelectedPreset] = useState(CANVAS_PRESETS[4].label)
  const [draftWidth, setDraftWidth] = useState(String(parameters.canvasWidth))
  const [draftHeight, setDraftHeight] = useState(String(parameters.canvasHeight))
  const [scaleEffect, setScaleEffect] = useState(true)

  const selectedSize = CANVAS_PRESETS.find((option) => option.label === selectedPreset)?.size
  const isCustom = selectedSize?.width === 0 || selectedSize?.height === 0

  useEffect(() => {
    const preset = CANVAS_PRESETS.find((option) => option.size.width === parameters.canvasWidth && option.size.height === parameters.canvasHeight)
    const nextPreset = preset ? preset.label : 'Custom'
    setSelectedPreset(nextPreset)
    setDraftWidth(String(parameters.canvasWidth))
    setDraftHeight(String(parameters.canvasHeight))
  }, [parameters.canvasWidth, parameters.canvasHeight])

  const parseCanvasValue = (raw: string): number | undefined => {
    const value = Number(raw)
    if (!Number.isInteger(value) || Number.isNaN(value)) {
      return undefined
    }
    return value
  }

  const isValidCanvasValue = (value: number | undefined, minimum = 16, maximum = 512) => value !== undefined && value >= minimum && value <= maximum

  const handlePreset = (label: string) => {
    setSelectedPreset(label)
    const preset = CANVAS_PRESETS.find((option) => option.label === label)
    if (!preset || preset.size.width === 0 || preset.size.height === 0) {
      return
    }
    setDraftWidth(String(preset.size.width))
    setDraftHeight(String(preset.size.height))
    onResize?.(preset.size, scaleEffect)
  }

  const applyCustom = () => {
    const width = parseCanvasValue(draftWidth)
    const height = parseCanvasValue(draftHeight)
    if (!isValidCanvasValue(width) || !isValidCanvasValue(height)) {
      return
    }
    onResize?.({ width: width!, height: height! }, scaleEffect)
  }

  const widthValid = isValidCanvasValue(parseCanvasValue(draftWidth))
  const heightValid = isValidCanvasValue(parseCanvasValue(draftHeight))

  return (
    <div className="canvas-size-control">
      <div className="canvas-size-heading">
        <div className="canvas-size-title">
          <span>Canvas size</span>
          <strong>{parameters.canvasWidth} × {parameters.canvasHeight}</strong>
        </div>
        <label className="scale-toggle">
          <input
            aria-label="Resize proportionally"
            type="checkbox"
            checked={scaleEffect}
            onChange={(event) => setScaleEffect(event.target.checked)}
          />
          <span className="toggle-track" aria-hidden="true"><span /></span>
          <span>Scale effect</span>
        </label>
      </div>

      <div className="canvas-preset-row">
        <label htmlFor="canvas-preset">Preset</label>
        <select id="canvas-preset" aria-label="Canvas preset" value={selectedPreset} onChange={(event) => handlePreset(event.target.value)}>
          {CANVAS_PRESETS.map((preset) => <option key={preset.label} value={preset.label}>{preset.label}</option>)}
        </select>
      </div>

      {isCustom ? (
        <div className="canvas-custom-row">
          <div className="canvas-dimension-inputs">
            <label>
              <span>W</span>
              <input
                aria-label="Custom canvas width"
                type="number"
                min={16}
                max={512}
                step={1}
                value={draftWidth}
                onChange={(event) => {
                  setDraftWidth(event.target.value)
                }}
              />
            </label>
            <span className="dimension-separator">×</span>
            <label>
              <span>H</span>
              <input
                aria-label="Custom canvas height"
                type="number"
                min={16}
                max={512}
                step={1}
                value={draftHeight}
                onChange={(event) => {
                  setDraftHeight(event.target.value)
                }}
              />
            </label>
          </div>
          <button type="button" className="secondary-button" disabled={!widthValid || !heightValid} onClick={applyCustom}>Apply</button>
          {!widthValid || !heightValid ? <small className="canvas-size-error">Use whole pixels from 16 to 512.</small> : null}
        </div>
      ) : null}
    </div>
  )
}

function clampSeed(value: number): number {
  if (!Number.isFinite(value)) {
    return 0
  }
  return Math.min(0xffffffff, Math.max(0, Math.round(value)))
}
