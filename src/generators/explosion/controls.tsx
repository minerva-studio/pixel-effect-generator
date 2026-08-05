import { useId } from 'react'
import { InfoHint, NumberControl, SelectControl } from '../../components/controls'
import { useI18n } from '../../i18n/I18nProvider'
import { hexToRgb, rgbToHex, type RgbColor } from '../../shared/pixel/color'
import type { FrameSize } from '../../shared/pixel/frame'
import type { ExplosionCategory } from './module'
import {
  MAX_CANVAS_SIZE,
  MAX_FRAGMENT_SIZE,
  MIN_CANVAS_SIZE,
  explosionFrameLimits,
  updateFragmentMaxSize,
  updateFragmentMinSize,
  type ExplosionParameters,
} from './model'

interface ExplosionControlsProps {
  readonly category: ExplosionCategory
  readonly parameters: ExplosionParameters
  readonly onChange: (parameters: ExplosionParameters) => void
}

/** Renders the active experimental explosion parameter category. */
export function ExplosionControls({ category, parameters, onChange }: ExplosionControlsProps) {
  const { t } = useI18n()
  const limits = explosionFrameLimits({ width: parameters.canvasWidth, height: parameters.canvasHeight })
  const update = <Key extends keyof ExplosionParameters>(key: Key, value: ExplosionParameters[Key]) => {
    onChange({ ...parameters, [key]: value })
  }

  switch (category) {
    case 'shape':
      return (
        <div className="control-list">
          <SelectControl label={t('explosion.controls.mode.label')} description={t('explosion.controls.mode.description')} value={parameters.mode} options={[
            { value: 'explosion', label: t('explosion.options.explosion') },
            { value: 'implosion', label: t('explosion.options.implosion') },
          ]} onChange={(value) => update('mode', value)} />
          <NumberControl label={t('explosion.controls.radius.label')} description={t('explosion.controls.radius.description')} value={parameters.radius} minimum={2} maximum={limits.maxRadius} unit="px" onChange={(value) => update('radius', value)} />
          <NumberControl label={t('explosion.controls.bodyStrength.label')} description={t('explosion.controls.bodyStrength.description')} value={parameters.bodyStrength} minimum={0} maximum={1} step={0.01} scale={100} unit="%" onChange={(value) => update('bodyStrength', value)} />
          <NumberControl label={t('explosion.controls.irregularity.label')} description={t('explosion.controls.irregularity.description')} value={parameters.irregularity} minimum={0} maximum={1} step={0.01} scale={100} unit="%" onChange={(value) => update('irregularity', value)} />
          <NumberControl label={t('explosion.controls.coreRadius.label')} description={t('explosion.controls.coreRadius.description')} value={parameters.coreRadius} minimum={0} maximum={limits.maxRadius} unit="px" onChange={(value) => update('coreRadius', value)} />
          <NumberControl label={t('explosion.controls.shockwaveWidth.label')} description={t('explosion.controls.shockwaveWidth.description')} value={parameters.shockwaveWidth} minimum={0} maximum={limits.maxRadius} unit="px" onChange={(value) => update('shockwaveWidth', value)} />
        </div>
      )
    case 'palette':
      return <ExplosionPaletteEditor parameters={parameters} onChange={onChange} />
    case 'motion':
      return (
        <div className="control-list">
          <NumberControl label={t('explosion.controls.expansionSpeed.label')} description={t('explosion.controls.expansionSpeed.description')} value={parameters.expansionSpeed} minimum={0} maximum={1} step={0.01} scale={100} unit="%" onChange={(value) => update('expansionSpeed', value)} />
          <NumberControl label={t('explosion.controls.coreDuration.label')} description={t('explosion.controls.coreDuration.description')} value={parameters.coreDuration} minimum={0.1} maximum={0.9} step={0.01} scale={100} unit="%" onChange={(value) => update('coreDuration', value)} />
          <NumberControl label={t('explosion.controls.shockwaveSpeed.label')} description={t('explosion.controls.shockwaveSpeed.description')} value={parameters.shockwaveSpeed} minimum={0} maximum={1} step={0.01} scale={100} unit="%" onChange={(value) => update('shockwaveSpeed', value)} />
          <NumberControl label={t('explosion.controls.dissolveStart.label')} description={t('explosion.controls.dissolveStart.description')} value={parameters.dissolveStart} minimum={0.1} maximum={0.9} step={0.01} scale={100} unit="%" onChange={(value) => update('dissolveStart', value)} />
        </div>
      )
    case 'fragments':
      return (
        <div className="control-list">
          <NumberControl label={t('explosion.controls.fragmentAmount.label')} description={t('explosion.controls.fragmentAmount.description')} value={parameters.fragmentAmount} minimum={0} maximum={1} step={0.01} scale={100} unit="%" onChange={(value) => update('fragmentAmount', value)} />
          <NumberControl label={t('explosion.controls.fragmentMinSize.label')} description={t('explosion.controls.fragmentMinSize.description')} value={parameters.fragmentMinSize} minimum={1} maximum={MAX_FRAGMENT_SIZE} unit="px" onChange={(value) => onChange(updateFragmentMinSize(parameters, value))} />
          <NumberControl label={t('explosion.controls.fragmentMaxSize.label')} description={t('explosion.controls.fragmentMaxSize.description')} value={parameters.fragmentMaxSize} minimum={1} maximum={MAX_FRAGMENT_SIZE} unit="px" onChange={(value) => onChange(updateFragmentMaxSize(parameters, value))} />
          <NumberControl label={t('explosion.controls.fragmentRadialSpeed.label')} description={t('explosion.controls.fragmentRadialSpeed.description')} value={parameters.fragmentRadialSpeed} minimum={0} maximum={limits.maxFragmentSpeed} unit="px" onChange={(value) => update('fragmentRadialSpeed', value)} />
          <NumberControl label={t('explosion.controls.fragmentTangentialJitter.label')} description={t('explosion.controls.fragmentTangentialJitter.description')} value={parameters.fragmentTangentialJitter} minimum={0} maximum={limits.maxTangentialJitter} unit="px" onChange={(value) => update('fragmentTangentialJitter', value)} />
          <NumberControl label={t('explosion.controls.fragmentLifetime.label')} description={t('explosion.controls.fragmentLifetime.description')} value={parameters.fragmentLifetime} minimum={0.1} maximum={1} step={0.01} scale={100} unit="%" onChange={(value) => update('fragmentLifetime', value)} />
        </div>
      )
  }
}

/** Renders canvas size and deterministic seed controls under the timeline. */
export function ExplosionPreviewTools({
  parameters,
  onChange,
  onResize,
}: {
  readonly parameters: ExplosionParameters
  readonly onChange: (parameters: ExplosionParameters) => void
  readonly onResize?: (nextSize: FrameSize, scaleEffect: boolean) => void
}) {
  const { t } = useI18n()
  const seedId = useId()
  const randomize = () => onChange({
    ...parameters,
    seed: crypto.getRandomValues(new Uint32Array(1))[0],
  })
  return (
    <div className="preview-tools">
      <div className="control-list">
        <NumberControl label={t('explosion.canvas.width')} description={t('explosion.canvas.widthDescription')} value={parameters.canvasWidth} minimum={MIN_CANVAS_SIZE} maximum={MAX_CANVAS_SIZE} unit="px" onChange={(width) => onResize?.({ width, height: parameters.canvasHeight }, true)} />
        <NumberControl label={t('explosion.canvas.height')} description={t('explosion.canvas.heightDescription')} value={parameters.canvasHeight} minimum={MIN_CANVAS_SIZE} maximum={MAX_CANVAS_SIZE} unit="px" onChange={(height) => onResize?.({ width: parameters.canvasWidth, height }, true)} />
      </div>
      <div className="preview-seed-control">
        <label htmlFor={seedId}>{t('explosion.controls.seed.label')}</label>
        <div className="seed-inputs">
          <input id={seedId} type="number" min="0" max="4294967295" step="1" value={parameters.seed} onChange={(event) => onChange({ ...parameters, seed: clampSeed(Number(event.target.value)) })} />
          <button className="secondary-button" type="button" onClick={randomize}>{t('explosion.seed.randomize')}</button>
        </div>
      </div>
    </div>
  )
}

/** Renders the ordered hot-core-to-edge palette editor. */
function ExplosionPaletteEditor({ parameters, onChange }: Omit<ExplosionControlsProps, 'category'>) {
  const { t } = useI18n()
  const updateColor = (index: number, value: string) => onChange({
    ...parameters,
    palette: parameters.palette.map((color, colorIndex) => colorIndex === index ? hexToRgb(value) : color),
  })
  return (
    <div className="palette-editor">
      <div className="palette-guide"><span>{t('explosion.palette.hotCore')}</span><span>{t('explosion.palette.outerEdge')}</span></div>
      <div className="palette-list">
        {parameters.palette.map((color, index) => (
          <div className="palette-row" key={`${index}-${rgbToHex(color)}`}>
            <span className="palette-order">{String(index + 1).padStart(2, '0')}</span>
            <input aria-label={t('explosion.palette.band', { index: index + 1 })} type="color" value={rgbToHex(color)} onChange={(event) => updateColor(index, event.target.value)} />
            <code>{rgbToHex(color).toUpperCase()}</code>
            <button className="remove-button" type="button" disabled={parameters.palette.length <= 2} aria-label={t('explosion.palette.removeBand', { index: index + 1 })} onClick={() => onChange({ ...parameters, palette: parameters.palette.filter((_, colorIndex) => colorIndex !== index) })}>{t('explosion.palette.remove')}</button>
          </div>
        ))}
      </div>
      <button className="secondary-button" type="button" disabled={parameters.palette.length >= 6} onClick={() => onChange({ ...parameters, palette: insertPaletteColor(parameters.palette) })}>{t('explosion.palette.addColorBand')}</button>
    </div>
  )
}

/** Appends a derived color without introducing generator state outside the palette. */
function insertPaletteColor(palette: readonly RgbColor[]): readonly RgbColor[] {
  const last = palette[palette.length - 1]
  const previous = palette[Math.max(0, palette.length - 2)]
  return [...palette, {
    r: Math.round((last.r + previous.r) / 2),
    g: Math.round((last.g + previous.g) / 2),
    b: Math.round((last.b + previous.b) / 2),
  }]
}

/** Normalizes a typed seed into the supported unsigned 32-bit range. */
function clampSeed(value: number): number {
  if (!Number.isFinite(value)) {
    return 0
  }
  return Math.min(0xffffffff, Math.max(0, Math.round(value)))
}
