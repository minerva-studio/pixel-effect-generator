import { useEffect, useId, useState } from 'react'
import { InfoHint, NumberControl, SelectControl } from '../../components/controls'
import { useI18n } from '../../i18n/I18nProvider'
import { hexToRgb, rgbToHex } from '../../shared/pixel/color'
import { MAX_FRAGMENT_SIZE, frameLimits, updateFragmentMaxSize, updateFragmentMinSize } from './model'
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
  const { t } = useI18n()
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
          <NumberControl label={t('slash.controls.radius.label')} description={t('slash.controls.radius.description')} value={parameters.radius} minimum={2} maximum={limits.maxRadius} unit="px" onChange={(value) => update('radius', value)} />
          <NumberControl label={t('slash.controls.thickness.label')} description={t('slash.controls.thickness.description')} value={parameters.thickness} minimum={1} maximum={parameters.radius} unit="px" onChange={(value) => update('thickness', value)} />
          <NumberControl label={t('slash.controls.startAngle.label')} description={t('slash.controls.startAngle.description')} value={parameters.startAngleDegrees} minimum={-180} maximum={180} unit="°" onChange={(value) => update('startAngleDegrees', value)} />
          <NumberControl label={t('slash.controls.sweepAngle.label')} description={t('slash.controls.sweepAngle.description')} value={parameters.sweepDegrees} minimum={30} maximum={MAX_SWEEP_DEGREES} unit="°" onChange={(value) => update('sweepDegrees', value)} />
          <NumberControl label={t('slash.controls.rotation.label')} description={t('slash.controls.rotation.description')} value={parameters.rotationDegrees} minimum={-180} maximum={180} unit="°" onChange={(value) => update('rotationDegrees', value)} />
          <NumberControl label={t('slash.controls.tilt.label')} description={t('slash.controls.tilt.description')} value={parameters.tiltDegrees} minimum={0} maximum={90} unit="°" onChange={(value) => update('tiltDegrees', value)} />
        </div>
      )
    case 'palette':
      return <PaletteEditor parameters={parameters} onChange={onChange} />
    case 'motion':
      return (
        <div className="control-list">
          <DirectionControl value={parameters.direction} onChange={(value) => update('direction', value)} />
          <NumberControl label={t('slash.controls.sweepSpeed.label')} description={t('slash.controls.sweepSpeed.description')} value={parameters.sweepSpeed} minimum={0} maximum={1} step={0.01} scale={100} unit="%" onChange={(value) => update('sweepSpeed', value)} />
          <NumberControl label={t('slash.controls.trailLength.label')} description={t('slash.controls.trailLength.description')} value={parameters.trailLength} minimum={0} maximum={1} step={0.01} scale={100} unit="%" onChange={(value) => update('trailLength', value)} />
        </div>
      )
    case 'breakup':
      return (
        <div className="control-list">
          <SelectControl
            label={t('slash.controls.dissolveMode.label')}
            description={t('slash.controls.dissolveMode.description')}
            value={parameters.dissolveMode}
            options={[
              { value: 'ordered', label: t('slash.options.ordered') },
              { value: 'clusteredNoise', label: t('slash.options.clusteredNoise') },
              { value: 'directionalStreaks', label: t('slash.options.directionalStreaks') },
            ]}
            onChange={(value) => update('dissolveMode', value)}
          />
          <SelectControl
            label={t('slash.controls.edgeMode.label')}
            description={t('slash.controls.edgeMode.description')}
            value={parameters.edgeBreakupMode}
            options={[
              { value: 'blockChips', label: t('slash.options.blockChips') },
              { value: 'jaggedContour', label: t('slash.options.jaggedContour') },
              { value: 'slashCuts', label: t('slash.options.slashCuts') },
            ]}
            onChange={(value) => update('edgeBreakupMode', value)}
          />
          <NumberControl label={t('slash.controls.dissolve.label')} description={t('slash.controls.dissolve.description')} value={parameters.dissolveLength} minimum={0} maximum={1} step={0.01} scale={100} unit="%" onChange={(value) => update('dissolveLength', value)} />
          <NumberControl label={t('slash.controls.edgeBreakup.label')} description={t('slash.controls.edgeBreakup.description')} value={parameters.edgeBreakup} minimum={0} maximum={1} step={0.01} scale={100} unit="%" onChange={(value) => update('edgeBreakup', value)} />
          <NumberControl label={t('slash.controls.breakupDepth.label')} description={t('slash.controls.breakupDepth.description')} value={parameters.edgeDepth} minimum={0.05} maximum={0.5} step={0.01} scale={100} unit="%" onChange={(value) => update('edgeDepth', value)} />
        </div>
      )
    case 'fragments':
      return (
        <div className="control-list">
          <SelectControl
            label={t('slash.controls.fragmentMode.label')}
            description={t('slash.controls.fragmentMode.description')}
            value={parameters.fragmentMode}
            options={[
              { value: 'pixelChunks', label: t('slash.options.pixelChunks') },
              { value: 'directionalShards', label: t('slash.options.directionalShards') },
              { value: 'energySparks', label: t('slash.options.energySparks') },
            ]}
            onChange={(value) => update('fragmentMode', value)}
          />
          <NumberControl label={t('slash.controls.amount.label')} description={t('slash.controls.amount.description')} value={parameters.fragmentAmount} minimum={0} maximum={1} step={0.01} scale={100} unit="%" onChange={(value) => update('fragmentAmount', value)} />
          <NumberControl label={t('slash.controls.minSize.label')} description={t('slash.controls.minSize.description')} value={parameters.fragmentMinSize} minimum={1} maximum={MAX_FRAGMENT_SIZE} unit="px" onChange={(value) => onChange(updateFragmentMinSize(parameters, value))} />
          <NumberControl label={t('slash.controls.maxSize.label')} description={t('slash.controls.maxSize.description')} value={parameters.fragmentMaxSize} minimum={1} maximum={MAX_FRAGMENT_SIZE} unit="px" onChange={(value) => onChange(updateFragmentMaxSize(parameters, value))} />
          <NumberControl label={t('slash.controls.tangentSpeed.label')} description={t('slash.controls.tangentSpeed.description')} value={parameters.fragmentTangentSpeed} minimum={0} maximum={limits.maxFragmentTangentSpeed} unit="px" onChange={(value) => update('fragmentTangentSpeed', value)} />
          <NumberControl label={t('slash.controls.outwardSpeed.label')} description={t('slash.controls.outwardSpeed.description')} value={parameters.fragmentOutwardSpeed} minimum={0} maximum={limits.maxFragmentOutwardSpeed} unit="px" onChange={(value) => update('fragmentOutwardSpeed', value)} />
          <NumberControl label={t('slash.controls.lifetime.label')} description={t('slash.controls.lifetime.description')} value={parameters.fragmentLifetime} minimum={0.1} maximum={1} step={0.01} scale={100} unit="%" onChange={(value) => update('fragmentLifetime', value)} />
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
  const { t } = useI18n()
  const hintId = useId()
  const updateColor = (index: number, color: string) => {
    const palette = parameters.palette.map((current, colorIndex) => colorIndex === index ? hexToRgb(color) : current)
    onChange({ ...parameters, palette })
  }

  return (
    <div className="palette-editor">
      <div className="palette-guide">
        <span>{t('slash.palette.innerEdge')}</span>
        <InfoHint label={t('slash.controls.paletteOrder.label')} description={t('slash.controls.paletteOrder.description')} hintId={hintId} />
        <span>{t('slash.palette.outerEdge')}</span>
      </div>
      <div className="palette-list">
        {parameters.palette.map((color, index) => (
          <div className="palette-row" key={`${index}-${rgbToHex(color)}`}>
            <span className="palette-order">{String(index + 1).padStart(2, '0')}</span>
            <input aria-label={t('slash.palette.band', { index: index + 1 })} type="color" value={rgbToHex(color)} onChange={(event) => updateColor(index, event.target.value)} />
            <code>{rgbToHex(color).toUpperCase()}</code>
            <button
              className="remove-button"
              type="button"
              disabled={parameters.palette.length <= 2}
              aria-label={t('slash.palette.removeBand', { index: index + 1 })}
              onClick={() => onChange({ ...parameters, palette: removePaletteColor(parameters.palette, index) })}
            >
              {t('slash.palette.remove')}
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
        {t('slash.palette.addColorBand')}
      </button>
    </div>
  )
}

/** Renders the two explicit temporal sweep directions. */
function DirectionControl({ value, onChange }: { readonly value: SlashDirection; readonly onChange: (value: SlashDirection) => void }) {
  const { t } = useI18n()
  const hintId = useId()
  return (
    <div className="parameter-field">
      <div className="field-copy">
        <span className="field-title">
          <span className="field-label">{t('slash.controls.direction.label')}</span>
          <InfoHint label={t('slash.controls.direction.label')} description={t('slash.controls.direction.description')} hintId={hintId} />
        </span>
      </div>
      <div className="segmented-control" role="group" aria-label={t('slash.controls.direction.label')}>
        <button
          aria-pressed={value === 'clockwise'}
          className={value === 'clockwise' ? 'active' : ''}
          type="button"
          onClick={() => onChange('clockwise')}
        >
          {t('slash.options.clockwise')}
        </button>
        <button
          aria-pressed={value === 'counterClockwise'}
          className={value === 'counterClockwise' ? 'active' : ''}
          type="button"
          onClick={() => onChange('counterClockwise')}
        >
          {t('slash.options.counterClockwise')}
        </button>
      </div>
    </div>
  )
}

/** Renders the reproducible seed field and a cryptographically sourced randomize action. */
function SeedControl({ value, onChange }: { readonly value: number; readonly onChange: (value: number) => void }) {
  const { t } = useI18n()
  const seedId = useId()
  const hintId = useId()
  const randomize = () => {
    const nextSeed = crypto.getRandomValues(new Uint32Array(1))[0]
    onChange(nextSeed)
  }

  return (
    <div className="preview-seed-control">
      <span className="field-title">
        <label htmlFor={seedId}>{t('slash.controls.randomSeed.label')}</label>
        <InfoHint label={t('slash.controls.randomSeed.label')} description={t('slash.controls.randomSeed.description')} hintId={hintId} />
      </span>
      <div className="seed-inputs">
        <input id={seedId} type="number" min="0" max="4294967295" step="1" value={value} onChange={(event) => onChange(clampSeed(Number(event.target.value)))} />
        <button className="secondary-button" type="button" onClick={randomize}>{t('slash.seed.randomize')}</button>
      </div>
    </div>
  )
}

interface CanvasResizeControlProps {
  readonly parameters: SlashParameters
  readonly onResize?: (nextSize: FrameSize, scaleEffect: boolean) => void
}

/** Stable canvas preset identifiers used as select values; labels come from i18n. */
const CANVAS_PRESETS: readonly { readonly id: string; readonly size: FrameSize }[] = [
  { id: 'square32', size: { width: 32, height: 32 } },
  { id: 'square48', size: { width: 48, height: 48 } },
  { id: 'square64', size: { width: 64, height: 64 } },
  { id: 'square96', size: { width: 96, height: 96 } },
  { id: 'square128', size: { width: 128, height: 128 } },
  { id: 'square192', size: { width: 192, height: 192 } },
  { id: 'square256', size: { width: 256, height: 256 } },
  { id: 'horizontal64x32', size: { width: 64, height: 32 } },
  { id: 'horizontal128x64', size: { width: 128, height: 64 } },
  { id: 'horizontal256x128', size: { width: 256, height: 128 } },
  { id: 'custom', size: { width: 0, height: 0 } },
]

function CanvasResizeControl({ parameters, onResize }: CanvasResizeControlProps) {
  const { t } = useI18n()
  const [selectedPreset, setSelectedPreset] = useState(CANVAS_PRESETS[4].id)
  const [draftWidth, setDraftWidth] = useState(String(parameters.canvasWidth))
  const [draftHeight, setDraftHeight] = useState(String(parameters.canvasHeight))
  const [scaleEffect, setScaleEffect] = useState(true)

  const selectedSize = CANVAS_PRESETS.find((option) => option.id === selectedPreset)?.size
  const isCustom = selectedSize?.width === 0 || selectedSize?.height === 0

  useEffect(() => {
    const preset = CANVAS_PRESETS.find((option) => option.size.width === parameters.canvasWidth && option.size.height === parameters.canvasHeight)
    const nextPreset = preset ? preset.id : 'custom'
    setSelectedPreset(nextPreset)
    setDraftWidth(String(parameters.canvasWidth))
    setDraftHeight(String(parameters.canvasHeight))
  }, [parameters.canvasWidth, parameters.canvasHeight])

  const presetLabel = (preset: { readonly id: string; readonly size: FrameSize }): string => {
    if (preset.id === 'custom') {
      return t('slash.canvas.presetCustom')
    }
    const { width, height } = preset.size
    return width === height
      ? t('slash.canvas.presetSquare', { width, height })
      : t('slash.canvas.presetHorizontal', { width, height })
  }

  const parseCanvasValue = (raw: string): number | undefined => {
    const value = Number(raw)
    if (!Number.isInteger(value) || Number.isNaN(value)) {
      return undefined
    }
    return value
  }

  const isValidCanvasValue = (value: number | undefined, minimum = 16, maximum = 512) => value !== undefined && value >= minimum && value <= maximum

  const handlePreset = (id: string) => {
    setSelectedPreset(id)
    const preset = CANVAS_PRESETS.find((option) => option.id === id)
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
          <span>{t('slash.canvas.size')}</span>
          <strong>{parameters.canvasWidth} × {parameters.canvasHeight}</strong>
        </div>
        <label className="scale-toggle">
          <input
            aria-label={t('slash.canvas.resizeProportionally')}
            type="checkbox"
            checked={scaleEffect}
            onChange={(event) => setScaleEffect(event.target.checked)}
          />
          <span className="toggle-track" aria-hidden="true"><span /></span>
          <span>{t('slash.canvas.scaleEffect')}</span>
        </label>
      </div>

      <div className="canvas-preset-row">
        <label htmlFor="canvas-preset">{t('slash.canvas.preset')}</label>
        <select id="canvas-preset" aria-label={t('slash.canvas.presetLabel')} value={selectedPreset} onChange={(event) => handlePreset(event.target.value)}>
          {CANVAS_PRESETS.map((preset) => <option key={preset.id} value={preset.id}>{presetLabel(preset)}</option>)}
        </select>
      </div>

      {isCustom ? (
        <div className="canvas-custom-row">
          <div className="canvas-dimension-inputs">
            <label>
              <span>W</span>
              <input
                aria-label={t('slash.canvas.customWidth')}
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
                aria-label={t('slash.canvas.customHeight')}
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
          <button type="button" className="secondary-button" disabled={!widthValid || !heightValid} onClick={applyCustom}>{t('slash.canvas.apply')}</button>
          {!widthValid || !heightValid ? <small className="canvas-size-error">{t('slash.canvas.sizeError')}</small> : null}
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
