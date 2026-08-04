import { useId } from 'react'
import { InfoHint, NumberControl, SelectControl } from '../../components/controls'
import { hexToRgb, rgbToHex } from '../../shared/pixel/color'
import { insertPaletteColor, removePaletteColor } from './palette'
import { MAX_SWEEP_DEGREES } from './model'
import type { SlashCategory } from './module'
import type { SlashDirection, SlashParameters } from './model'

interface SlashControlsProps {
  readonly category: SlashCategory
  readonly parameters: SlashParameters
  readonly onChange: (parameters: SlashParameters) => void
}

/** Renders the active Slash parameter category without owning generator state. */
export function SlashControls({ category, parameters, onChange }: SlashControlsProps) {
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
          <NumberControl label="Radius" description="Distance from the origin to the slash's outer edge." value={parameters.radius} minimum={2} maximum={63} unit="px" onChange={(value) => update('radius', value)} />
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
          <NumberControl label="Size" description="Maximum chunk width, shard line length, or spark trail length for the selected fragment mode." value={parameters.fragmentSize} minimum={1} maximum={3} unit="px" onChange={(value) => update('fragmentSize', value)} />
          <NumberControl label="Tangent speed" description="Motion along the direction of the sweep per animation cycle." value={parameters.fragmentTangentSpeed} minimum={0} maximum={32} unit="px" onChange={(value) => update('fragmentTangentSpeed', value)} />
          <NumberControl label="Outward speed" description="Motion away from the slash center per animation cycle." value={parameters.fragmentOutwardSpeed} minimum={0} maximum={24} unit="px" onChange={(value) => update('fragmentOutwardSpeed', value)} />
          <NumberControl label="Lifetime" description="Fraction of the animation for which detached fragments remain alive." value={parameters.fragmentLifetime} minimum={0.1} maximum={1} step={0.01} scale={100} unit="%" onChange={(value) => update('fragmentLifetime', value)} />
        </div>
      )
  }
}

/** Renders Slash-specific deterministic controls beneath preview timing. */
export function SlashPreviewTools({ parameters, onChange }: Omit<SlashControlsProps, 'category'>) {
  return <SeedControl value={parameters.seed} onChange={(seed) => onChange({ ...parameters, seed })} />
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

function clampSeed(value: number): number {
  if (!Number.isFinite(value)) {
    return 0
  }
  return Math.min(0xffffffff, Math.max(0, Math.round(value)))
}
