import { NumberControl, SelectControl } from '../../components/controls'
import { PaletteLibraryPicker } from '../../components/PaletteLibraryPicker'
import { GeneratorPreviewTools } from '../../components/PreviewTools'
import { useI18n } from '../../i18n/I18nProvider'
import { hexToRgb, rgbaToHex, type RgbColor } from '../../shared/pixel/color'
import type { FrameSize } from '../../shared/pixel/frame'
import { ProjectileControls, SparkControls } from '../projectile/controls'
import { MAX_CANVAS_SIZE, MAX_LOOP_CYCLES, MIN_CANVAS_SIZE, type ProjectileParameters } from '../projectile/model'
import type { ProjectileCategory } from '../projectile/module'
import { ShapeCardGrid, type ShapeCardOption } from '../shared-effects/controls'
import type { FireballTuning } from './canonical'
import { DEFAULT_FIREBALL_PARAMETERS, classicFireballTuning, classicProjectileParameters, maxFireballSize, type FireballParameters } from './model'
import { fitFireballPalette } from './palette'
import { renderFireballFrames } from './renderer'

export type FireballCategory = 'shape' | 'motion' | 'trail' | 'effects' | 'palette'
type FireballControlKey = 'form' | 'size' | 'rotation' | 'cycles' | 'angular' | 'contour' | 'band' | 'breakup' | 'ribbons' | 'ball' | 'trail' | 'count' | 'length' | 'billow' | 'smoke' | 'seed'

interface Props {
  readonly category: FireballCategory
  readonly parameters: FireballParameters
  readonly onChange: (parameters: FireballParameters) => void
  readonly onResize?: (nextSize: FrameSize, scaleEffect: boolean) => void
}

const FORM_CARDS: readonly ShapeCardOption<FireballParameters>[] = (
  ['stream', 'wrapped', 'puff', 'classic'] as const
).map((form) => ({
  value: form,
  labelKey: `fireball.forms.${form}.label`,
  descriptionKey: `fireball.forms.${form}.description`,
  buildParameters: () => ({ ...DEFAULT_FIREBALL_PARAMETERS, form }),
}))

/** Renders only the selected form's controls while retaining the other forms' values. */
export function FireballControls({ category, parameters, onChange }: Props) {
  const { t } = useI18n()
  const update = <Key extends keyof FireballParameters>(key: Key, value: FireballParameters[Key]) => onChange({ ...parameters, [key]: value })
  const classic = parameters.form === 'classic'
  const updateClassic = (next: ProjectileParameters) =>
    onChange({ ...parameters, classic: classicFireballTuning(next) })
  const classicControls = (classicCategory: ProjectileCategory) => <ProjectileControls category={classicCategory}
    parameters={classicProjectileParameters(parameters)} onChange={updateClassic} allowedKind="fireball" embeddedClassic />
  const tuningKey = parameters.form === 'wrapped' ? 'wrapped' : 'stream'
  const tuning = parameters[tuningKey]
  const updateTuning = <Key extends keyof FireballTuning>(key: Key, value: FireballTuning[Key]) =>
    onChange({ ...parameters, [tuningKey]: { ...tuning, [key]: value } })
  const number = (id: Exclude<FireballControlKey, 'form' | 'ball' | 'trail' | 'smoke' | 'seed'>, value: number, change: (value: number) => void, min = 0, max = 1, step = 0.01, unit = '') =>
    <NumberControl label={t(`fireball.controls.${id}.label`)} description={t(`fireball.controls.${id}.description`)} value={value} minimum={min} maximum={max} step={step} scale={unit === '%' ? 100 : 1} unit={unit} onChange={change} />
  const selectForm = (form: string) => {
    if (form === 'stream' || form === 'wrapped' || form === 'puff' || form === 'classic') update('form', form)
  }

  if (category === 'shape') return <div className="control-list">
    <ShapeCardGrid familyId="fireball" label={t('fireball.controls.form.label')} options={FORM_CARDS} selected={parameters.form}
      render={renderFireballFrames} onSelect={selectForm} />
    {parameters.form === 'wrapped' && <SelectControl label={t('fireball.controls.ball.label')} description={t('fireball.controls.ball.description')} value={parameters.wrapped.fireballBall}
        options={[{ value: 'hot', label: t('fireball.options.hot') }, { value: 'molten', label: t('fireball.options.molten') }]}
        onChange={value => updateTuning('fireballBall', value)} />}
    {number('size', parameters.size, value => update('size', value), 1, maxFireballSize(parameters.canvasWidth, parameters.canvasHeight), 1, 'px')}
    {number('rotation', parameters.rotationDegrees, value => update('rotationDegrees', value), 0, 359, 1, '°')}
    {classic && classicControls('body')}
  </div>
  if (category === 'motion') return <div className="control-list">
    {number('cycles', parameters.loopCycles, value => update('loopCycles', value), 1, MAX_LOOP_CYCLES, 1, '×')}
    {classic && classicControls('motion')}
    {!classic && parameters.form !== 'puff' && <>
      {number('angular', tuning.fireballAngular, value => updateTuning('fireballAngular', value), 0, 1, 0.01, '%')}
      {number('contour', tuning.fireballContour, value => updateTuning('fireballContour', value), 0, 1, 0.01, '%')}
      {number('band', tuning.fireballBandWarp, value => updateTuning('fireballBandWarp', value), 0, 1, 0.01, '%')}
    </>}
  </div>
  if (classic && (category === 'trail' || category === 'effects')) return classicControls(category)
  if (category === 'trail') return <div className="control-list">
    {parameters.form === 'puff' ? <>
      {number('count', parameters.puff.trailCount, value => update('puff', { ...parameters.puff, trailCount: value }), 4, 18, 1)}
      {number('length', parameters.puff.trailLength, value => update('puff', { ...parameters.puff, trailLength: value }), 0, 1, 0.01, '%')}
      {number('billow', parameters.puff.billow, value => update('puff', { ...parameters.puff, billow: value }), 0, 1, 0.01, '%')}
    </> : <>
      {parameters.form === 'wrapped' && number('ribbons', tuning.fireballRibbons, value => updateTuning('fireballRibbons', value), 1, 6, 1)}
      {number('breakup', tuning.fireballBreakup, value => updateTuning('fireballBreakup', value), 0, 1, 0.01, '%')}
      {(parameters.form === 'wrapped' || parameters.form === 'stream') && <SelectControl label={t('fireball.controls.trail.label')} description={t('fireball.controls.trail.description')} value={tuning.fireballTrail} options={[
        { value: 'cooling', label: t('fireball.options.cooling') }, { value: 'flame', label: t('fireball.options.flame') }, { value: 'smoke', label: t('fireball.options.smokeTrail') },
      ]} onChange={value => updateTuning('fireballTrail', value)} />}
    </>}
  </div>
  if (category === 'effects') return <div className="control-list">
    {parameters.form === 'puff' && <label className="parameter-field"><span>{t('fireball.controls.smoke.label')}</span>
      <input type="checkbox" aria-label={t('fireball.controls.smoke.label')} checked={parameters.puff.smoke} onChange={event => update('puff', { ...parameters.puff, smoke: event.target.checked })} />
    </label>}
    <SparkControls sparks={parameters.sparks} onChange={sparks => update('sparks', sparks)} />
  </div>
  return <div className="control-list">
    <PaletteRows label={t('fireball.palette.warm')} colors={parameters.warmPalette} onChange={colors => update('warmPalette', colors)} />
    <PaletteRows label={t('fireball.palette.rock')} colors={parameters.smokePalette} onChange={colors => update('smokePalette', colors)} />
  </div>
}

function PaletteRows({ label, colors, onChange }: { label: string; colors: readonly RgbColor[]; onChange: (colors: readonly RgbColor[]) => void }) {
  const { t } = useI18n()
  return <div className="palette-editor"><p className="panel-note">{label}</p>
    <PaletteLibraryPicker palette={colors} onChange={palette => onChange(fitFireballPalette(palette, colors.length))}
      minimum={2} maximum={6} />
    <div className="palette-list">
    {colors.map((color, index) => <div className="palette-row" key={index}>
      <span className="palette-order">{String(index + 1).padStart(2, '0')}</span>
      <input aria-label={t('fireball.palette.band', { index: index + 1 })} type="color" value={rgbaToHex(color).slice(0, 7)}
        onChange={event => onChange(colors.map((entry, i) => i === index ? { ...hexToRgb(event.target.value), a: entry.a } : entry))} />
      <label className="palette-alpha"><span>{t('fireball.palette.alpha')}</span><input aria-label={t('fireball.palette.alpha')} type="range" min={0} max={255} value={color.a}
        onChange={event => onChange(colors.map((entry, i) => i === index ? { ...entry, a: Number(event.target.value) } : entry))} />
        <code>{color.a}</code></label>
      <code>{rgbaToHex(color).toUpperCase()}</code>
    </div>)}
  </div></div>
}

export function FireballPreviewTools({ parameters, onChange, onResize }: Omit<Props, 'category'>) {
  const { t } = useI18n()
  return <GeneratorPreviewTools canvasSize={{ width: parameters.canvasWidth, height: parameters.canvasHeight }}
    onResize={onResize} seedValue={parameters.seed} onSeedChange={seed => onChange({ ...parameters, seed })}
    minimumSize={MIN_CANVAS_SIZE} maximumSize={MAX_CANVAS_SIZE} seedLabel={t('fireball.controls.seed.label')}
    seedDescription={t('fireball.controls.seed.description')} seedRandomizeLabel={t('fireball.seed.randomize')} />
}
