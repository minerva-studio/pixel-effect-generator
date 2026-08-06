import { useId } from 'react'
import { InfoHint, NumberControl, SelectControl } from '../../components/controls'
import { GeneratorPreviewTools } from '../../components/PreviewTools'
import { useI18n } from '../../i18n/I18nProvider'
import { hexToRgb, rgbaToHex } from '../../shared/pixel/color'
import {
  MAX_CANVAS_SIZE,
  MAX_FRAGMENT_SIZE,
  MIN_CANVAS_SIZE,
  frameLimits,
  updateFragmentMaxSize,
  updateFragmentMinSize,
} from './model'
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
  const { t } = useI18n()
  return (
    <GeneratorPreviewTools
      canvasSize={{ width: parameters.canvasWidth, height: parameters.canvasHeight }}
      onResize={onResize}
      seedValue={parameters.seed}
      onSeedChange={(seed) => onChange({ ...parameters, seed })}
      minimumSize={MIN_CANVAS_SIZE}
      maximumSize={MAX_CANVAS_SIZE}
      seedLabel={t('slash.controls.randomSeed.label')}
      seedDescription={t('slash.controls.randomSeed.description')}
      seedRandomizeLabel={t('slash.seed.randomize')}
    />
  )
}

/** Renders the ordered inner-to-outer palette editor. */
function PaletteEditor({ parameters, onChange }: Omit<SlashControlsProps, 'category'>) {
  const { t } = useI18n()
  const hintId = useId()
  const updateColor = (index: number, color: string) => {
    const palette = parameters.palette.map((current, colorIndex) => (
      colorIndex === index ? { ...hexToRgb(color), a: current.a } : current
    ))
    onChange({ ...parameters, palette })
  }
  const updateAlpha = (index: number, alpha: number) => {
    const palette = parameters.palette.map((current, colorIndex) => (
      colorIndex === index ? { ...current, a: alpha } : current
    ))
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
          <div className="palette-row" key={`${index}-${rgbaToHex(color)}`}>
            <span className="palette-order">{String(index + 1).padStart(2, '0')}</span>
            <input aria-label={t('slash.palette.band', { index: index + 1 })} type="color" value={rgbaToHex(color).slice(0, 7)} onChange={(event) => updateColor(index, event.target.value)} />
            <label className="palette-alpha">
              <span>{t('slash.palette.alpha')}</span>
              <input aria-label={t('slash.palette.alpha')} type="range" min={0} max={255} value={color.a} onChange={(event) => updateAlpha(index, Number(event.target.value))} />
              <code>{color.a}</code>
            </label>
            <code>{rgbaToHex(color).toUpperCase()}</code>
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
