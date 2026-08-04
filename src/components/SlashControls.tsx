import type { SlashCategory } from '../core/generatorCatalog'
import {
  hexToRgb,
  insertPaletteColor,
  removePaletteColor,
  rgbToHex,
  type SlashDirection,
  type SlashParameters,
} from '../core/slashRenderer'

interface SlashControlsProps {
  readonly category: SlashCategory
  readonly parameters: SlashParameters
  readonly onChange: (parameters: SlashParameters) => void
}

interface NumberControlProps {
  readonly label: string
  readonly description: string
  readonly value: number
  readonly minimum: number
  readonly maximum: number
  readonly step?: number
  readonly scale?: number
  readonly unit?: string
  readonly onChange: (value: number) => void
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
          <NumberControl label="Sweep angle" description="Degrees travelled from the start angle in the selected sweep direction." value={parameters.sweepDegrees} minimum={30} maximum={360} unit="°" onChange={(value) => update('sweepDegrees', value)} />
          <NumberControl label="Rotation" description="Rotates the complete local slash path to aim the overall swing in screen space." value={parameters.rotationDegrees} minimum={-180} maximum={180} unit="°" onChange={(value) => update('rotationDegrees', value)} />
          <NumberControl label="Perspective tilt" description="Compresses the slash plane to create an angled view." value={parameters.tiltDegrees} minimum={0} maximum={75} unit="°" onChange={(value) => update('tiltDegrees', value)} />
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
        <div className="control-groups">
          <ControlGroup title="Arc breakup">
            <NumberControl label="Dissolve" description="Length of the Bayer-dithered transition immediately ahead of the tail." value={parameters.dissolveLength} minimum={0} maximum={1} step={0.01} scale={100} unit="%" onChange={(value) => update('dissolveLength', value)} />
            <NumberControl label="Edge breakup" description="Chance for stable 2×2 chips to be removed from the outer edge." value={parameters.edgeBreakup} minimum={0} maximum={1} step={0.01} scale={100} unit="%" onChange={(value) => update('edgeBreakup', value)} />
            <NumberControl label="Breakup depth" description="How far edge chips may reach inward while preserving the core arc." value={parameters.edgeDepth} minimum={0.05} maximum={0.5} step={0.01} scale={100} unit="%" onChange={(value) => update('edgeDepth', value)} />
          </ControlGroup>
          <ControlGroup title="Fragments">
            <NumberControl label="Amount" description="Amount of colored debris released as the trailing edge passes." value={parameters.fragmentAmount} minimum={0} maximum={1} step={0.01} scale={100} unit="%" onChange={(value) => update('fragmentAmount', value)} />
            <NumberControl label="Size" description="Maximum square size of an individual fragment." value={parameters.fragmentSize} minimum={1} maximum={3} unit="px" onChange={(value) => update('fragmentSize', value)} />
            <NumberControl label="Tangent speed" description="Motion along the direction of the sweep per animation cycle." value={parameters.fragmentTangentSpeed} minimum={0} maximum={32} unit="px" onChange={(value) => update('fragmentTangentSpeed', value)} />
            <NumberControl label="Outward speed" description="Motion away from the slash center per animation cycle." value={parameters.fragmentOutwardSpeed} minimum={0} maximum={24} unit="px" onChange={(value) => update('fragmentOutwardSpeed', value)} />
            <NumberControl label="Lifetime" description="Fraction of the animation for which detached fragments remain alive." value={parameters.fragmentLifetime} minimum={0.1} maximum={1} step={0.01} scale={100} unit="%" onChange={(value) => update('fragmentLifetime', value)} />
          </ControlGroup>
          <ControlGroup title="Pattern">
            <SeedControl value={parameters.seed} onChange={(value) => update('seed', value)} />
          </ControlGroup>
        </div>
      )
  }
}

/** Groups parameters by the visual system they directly control. */
function ControlGroup({ title, children }: { readonly title: string; readonly children: React.ReactNode }) {
  return (
    <section className="control-group">
      <h4>{title}</h4>
      <div className="control-list">{children}</div>
    </section>
  )
}

/** Renders one scaled numeric parameter with synchronized slider and number input. */
function NumberControl({ label, description, value, minimum, maximum, step = 1, scale = 1, unit = '', onChange }: NumberControlProps) {
  const displayedValue = normalizeDisplayValue(value * scale, step * scale)
  const displayedMinimum = minimum * scale
  const displayedMaximum = maximum * scale
  const displayedStep = step * scale
  const updateDisplayedValue = (nextValue: number) => {
    const clamped = Math.min(displayedMaximum, Math.max(displayedMinimum, nextValue))
    onChange(clamped / scale)
  }

  return (
    <div className="parameter-field">
      <div className="field-copy">
        <span className="field-title">
          <label htmlFor={`${toControlId(label)}-range`}>{label}</label>
          <InfoHint label={label} description={description} />
        </span>
      </div>
      <div className="field-inputs">
        <input
          id={`${toControlId(label)}-range`}
          aria-label={label}
          type="range"
          min={displayedMinimum}
          max={displayedMaximum}
          step={displayedStep}
          value={displayedValue}
          onChange={(event) => updateDisplayedValue(Number(event.target.value))}
        />
        <span className="number-field">
          <input
            aria-label={`${label} value`}
            type="number"
            min={displayedMinimum}
            max={displayedMaximum}
            step={displayedStep}
            value={displayedValue}
            onChange={(event) => updateDisplayedValue(Number(event.target.value))}
          />
          <small>{unit}</small>
        </span>
      </div>
    </div>
  )
}

/** Renders the ordered inner-to-outer palette editor. */
function PaletteEditor({ parameters, onChange }: Omit<SlashControlsProps, 'category'>) {
  const updateColor = (index: number, color: string) => {
    const palette = parameters.palette.map((current, colorIndex) => colorIndex === index ? hexToRgb(color) : current)
    onChange({ ...parameters, palette })
  }

  return (
    <div className="palette-editor">
      <div className="palette-guide">
        <span>Inner edge</span>
        <InfoHint label="Palette order" description="Bands are sampled directly on the pixel grid. No blended colors are introduced." />
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
  return (
    <div className="parameter-field">
      <div className="field-copy">
        <span className="field-title">
          <span className="field-label">Sweep direction</span>
          <InfoHint label="Sweep direction" description="Changes temporal travel along the same arc without flipping the rendered image." />
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
  const randomize = () => {
    const nextSeed = crypto.getRandomValues(new Uint32Array(1))[0]
    onChange(nextSeed)
  }

  return (
    <div className="parameter-field">
      <div className="field-copy">
        <span className="field-title">
          <label htmlFor="slash-seed">Random seed</label>
          <InfoHint label="Random seed" description="Re-enter the same unsigned 32-bit value to reproduce breakup exactly." />
        </span>
      </div>
      <div className="seed-inputs">
        <input id="slash-seed" type="number" min="0" max="4294967295" step="1" value={value} onChange={(event) => onChange(clampSeed(Number(event.target.value)))} />
        <button className="secondary-button" type="button" onClick={randomize}>Randomize</button>
      </div>
    </div>
  )
}

/** Reveals compact field guidance on hover, focus, or touch focus. */
function InfoHint({ label, description }: { readonly label: string; readonly description: string }) {
  return (
    <span className="info-hint">
      <button type="button" aria-label={`About ${label}`} aria-describedby={`${toControlId(label)}-hint`}>i</button>
      <span className="info-tooltip" id={`${toControlId(label)}-hint`} role="tooltip">{description}</span>
    </span>
  )
}

function normalizeDisplayValue(value: number, step: number): number {
  const decimals = Math.max(0, Math.ceil(-Math.log10(step)))
  return Number(value.toFixed(decimals))
}

function clampSeed(value: number): number {
  if (!Number.isFinite(value)) {
    return 0
  }
  return Math.min(0xffffffff, Math.max(0, Math.round(value)))
}

function toControlId(label: string): string {
  return `slash-${label.toLowerCase().replaceAll(' ', '-')}`
}
