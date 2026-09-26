import { NumberControl, PercentControl, SelectControl } from '../../components/controls'
import { PaletteEditor } from '../../components/PaletteEditor'
import { createPreviewTools } from '../../components/PreviewTools'
import { useI18n } from '../../i18n/I18nProvider'
import type { RgbColor } from '../../shared/pixel/color'
import type { FrameSize } from '../../shared/pixel/frame'
import { ProjectileControls, SparkControls } from '../projectile/controls'
import { MAX_CANVAS_SIZE, MAX_LOOP_CYCLES, MIN_CANVAS_SIZE, type ProjectileParameters } from '../projectile/model'
import type { ProjectileCategory } from '../projectile/module'
import { FeatureSection, ShapeCardGrid, type ShapeCardOption } from '../shared-effects/controls'
import type { FireballTuning } from './canonical'
import { DEFAULT_FIREBALL_PARAMETERS, classicFireballTuning, classicProjectileParameters, maxFireballSize, selectFireballShape, type FireballParameters } from './model'
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

const SHAPE_THUMBNAIL_BASE: FireballParameters = {
  ...DEFAULT_FIREBALL_PARAMETERS,
  seed: 1337,
  sparks: { ...DEFAULT_FIREBALL_PARAMETERS.sparks, sparksEnabled: false },
  puff: { ...DEFAULT_FIREBALL_PARAMETERS.puff, smoke: false },
  classic: { ...DEFAULT_FIREBALL_PARAMETERS.classic, trailMode: 'off', sparksEnabled: false, afterimagesEnabled: false },
}

const FORM_CARDS: readonly ShapeCardOption<FireballParameters>[] = (
  ['stream', 'wrapped', 'puff', 'classic'] as const
).map((form) => ({
  value: form,
  labelKey: `fireball.forms.${form}.label`,
  descriptionKey: `fireball.forms.${form}.description`,
  buildParameters: () => selectFireballShape(SHAPE_THUMBNAIL_BASE, form),
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
  const number = (id: Exclude<FireballControlKey, 'form' | 'ball' | 'trail' | 'smoke' | 'seed'>, value: number, change: (value: number) => void, min = 0, max = 1, step = 0.01, unit = '') => {
    const label = t(`fireball.controls.${id}.label`)
    const description = t(`fireball.controls.${id}.description`)
    return unit === '%'
      ? <PercentControl label={label} description={description} value={value} minimum={min} maximum={max} step={step} onChange={change} />
      : <NumberControl label={label} description={description} value={value} minimum={min} maximum={max} step={step} unit={unit} onChange={change} />
  }

  if (category === 'shape') return <div className="control-list">
    <ShapeCardGrid familyId="fireball" label={t('fireball.controls.form.label')} options={FORM_CARDS} selected={parameters.form}
      render={renderFireballFrames} onSelect={(form) => onChange(selectFireballShape(parameters, form as FireballParameters['form']))} />
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
    {parameters.form === 'puff' && <FeatureSection label={t('fireball.controls.smoke.label')} description={t('fireball.controls.smoke.description')} enabled={parameters.puff.smoke} status={t(parameters.puff.smoke ? 'controls.feature.enabled' : 'controls.feature.disabled')} onChangeEnabled={(smoke) => update('puff', { ...parameters.puff, smoke })}>
      <p className="material-mode-note">{t('fireball.controls.smoke.description')}</p>
    </FeatureSection>}
    <SparkControls sparks={parameters.sparks} onChange={sparks => update('sparks', sparks)} />
  </div>
  return <div className="control-list">
    <PaletteRows label={t('fireball.palette.warm')} colors={parameters.warmPalette} onChange={colors => update('warmPalette', colors)} />
    <PaletteRows label={t('fireball.palette.rock')} colors={parameters.smokePalette} onChange={colors => update('smokePalette', colors)} />
  </div>
}

function PaletteRows({ label, colors, onChange }: { label: string; colors: readonly RgbColor[]; onChange: (colors: readonly RgbColor[]) => void }) {
  const { t } = useI18n()
  return <PaletteEditor title={label} palette={colors} onChange={onChange} minimum={2} maximum={6}
    bandLabel={(index) => t('fireball.palette.band', { index: index + 1 })}
    fit={(palette, length) => fitFireballPalette(palette, length)} />
}

export const FireballPreviewTools = createPreviewTools<FireballParameters>({ keyPrefix: 'fireball', minimumSize: MIN_CANVAS_SIZE, maximumSize: MAX_CANVAS_SIZE })
