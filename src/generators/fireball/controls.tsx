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

interface Props {
  readonly category: FireballCategory
  readonly parameters: FireballParameters
  readonly onChange: (parameters: FireballParameters) => void
  readonly onResize?: (nextSize: FrameSize, scaleEffect: boolean) => void
}

const copy = {
  en: {
    form: 'Form', size: 'Size', rotation: 'Rotation', cycles: 'Loop cycles',
    angular: 'Shape facets', contour: 'Contour motion', band: 'Band motion', breakup: 'Edge breakup',
    ribbons: 'Wrapping bands', ball: 'Core', trail: 'Tail texture',
    count: 'Shedding masses', length: 'Tail length', billow: 'Surface curl', smoke: 'Cooling smoke',
    hot: 'Hot', molten: 'Iron core', cooling: 'Cooling', flame: 'Pure fire', smokeTrail: 'Fire and smoke',
    warm: 'Fire palette', rock: 'Smoke and rock palette', seed: 'Random seed',
  },
  'zh-CN': {
    form: '造型', size: '大小', rotation: '旋转', cycles: '循环次数',
    angular: '形体棱角', contour: '轮廓波动', band: '色带波动', breakup: '边缘破碎',
    ribbons: '裹焰火带数量', ball: '弹体', trail: '尾部质感',
    count: '剥落数量', length: '尾迹长度', billow: '表面翻卷', smoke: '冷却成烟',
    hot: '炽热', molten: '铁球核心', cooling: '渐冷', flame: '纯火焰', smokeTrail: '火焰接烟雾',
    warm: '火焰色带', rock: '烟雾与岩核色带', seed: '随机种子',
  },
} as const

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
  const { locale } = useI18n()
  const c = copy[locale]
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
  const number = (label: string, value: number, change: (value: number) => void, min = 0, max = 1, step = 0.01) =>
    <NumberControl label={label} description={label} value={value} minimum={min} maximum={max} step={step} onChange={change} />
  const selectForm = (form: string) => {
    if (form === 'stream' || form === 'wrapped' || form === 'puff' || form === 'classic') update('form', form)
  }

  if (category === 'shape') return <div className="control-list">
    <ShapeCardGrid familyId="fireball" label={c.form} options={FORM_CARDS} selected={parameters.form}
      render={renderFireballFrames} onSelect={selectForm} />
    {parameters.form === 'wrapped' && <SelectControl label={c.ball} description={c.ball} value={parameters.wrapped.fireballBall}
        options={[{ value: 'hot', label: c.hot }, { value: 'molten', label: c.molten }]}
        onChange={value => updateTuning('fireballBall', value)} />}
    {number(c.size, parameters.size, value => update('size', value), 1, maxFireballSize(parameters.canvasWidth, parameters.canvasHeight), 1)}
    {number(c.rotation, parameters.rotationDegrees, value => update('rotationDegrees', value), 0, 359, 1)}
    {classic && classicControls('body')}
  </div>
  if (category === 'motion') return <div className="control-list">
    {number(c.cycles, parameters.loopCycles, value => update('loopCycles', value), 1, MAX_LOOP_CYCLES, 1)}
    {classic && classicControls('motion')}
    {!classic && parameters.form !== 'puff' && <>
      {number(c.angular, tuning.fireballAngular, value => updateTuning('fireballAngular', value))}
      {number(c.contour, tuning.fireballContour, value => updateTuning('fireballContour', value))}
      {number(c.band, tuning.fireballBandWarp, value => updateTuning('fireballBandWarp', value))}
    </>}
  </div>
  if (classic && (category === 'trail' || category === 'effects')) return classicControls(category)
  if (category === 'trail') return <div className="control-list">
    {parameters.form === 'puff' ? <>
      {number(c.count, parameters.puff.trailCount, value => update('puff', { ...parameters.puff, trailCount: value }), 4, 18, 1)}
      {number(c.length, parameters.puff.trailLength, value => update('puff', { ...parameters.puff, trailLength: value }))}
      {number(c.billow, parameters.puff.billow, value => update('puff', { ...parameters.puff, billow: value }))}
    </> : <>
      {parameters.form === 'wrapped' && number(c.ribbons, tuning.fireballRibbons, value => updateTuning('fireballRibbons', value), 1, 6, 1)}
      {number(c.breakup, tuning.fireballBreakup, value => updateTuning('fireballBreakup', value))}
      {parameters.form === 'wrapped' && <SelectControl label={c.trail} description={c.trail} value={tuning.fireballTrail} options={[
        { value: 'cooling', label: c.cooling }, { value: 'flame', label: c.flame }, { value: 'smoke', label: c.smokeTrail },
      ]} onChange={value => updateTuning('fireballTrail', value)} />}
    </>}
  </div>
  if (category === 'effects') return <div className="control-list">
    {parameters.form === 'stream' && <SelectControl label={c.trail} description={c.trail} value={tuning.fireballTrail}
      options={[{ value: 'cooling', label: c.cooling }, { value: 'flame', label: c.flame }, { value: 'smoke', label: c.smokeTrail }]}
      onChange={value => updateTuning('fireballTrail', value)} />}
    {parameters.form === 'wrapped' && <SelectControl label={c.ball} description={c.ball} value={tuning.fireballBall}
      options={[{ value: 'hot', label: c.hot }, { value: 'molten', label: c.molten }]}
      onChange={value => updateTuning('fireballBall', value)} />}
    {parameters.form === 'puff' && <label className="parameter-field"><span>{c.smoke}</span>
      <input type="checkbox" checked={parameters.puff.smoke} onChange={event => update('puff', { ...parameters.puff, smoke: event.target.checked })} />
    </label>}
    <SparkControls sparks={parameters.sparks} onChange={sparks => update('sparks', sparks)} />
  </div>
  return <div className="control-list">
    <PaletteRows label={c.warm} colors={parameters.warmPalette} onChange={colors => update('warmPalette', colors)} />
    <PaletteRows label={c.rock} colors={parameters.smokePalette} onChange={colors => update('smokePalette', colors)} />
  </div>
}

function PaletteRows({ label, colors, onChange }: { label: string; colors: readonly RgbColor[]; onChange: (colors: readonly RgbColor[]) => void }) {
  return <div className="palette-editor"><p className="panel-note">{label}</p>
    <PaletteLibraryPicker palette={colors} onChange={palette => onChange(fitFireballPalette(palette, colors.length))}
      minimum={2} maximum={6} />
    <div className="palette-list">
    {colors.map((color, index) => <div className="palette-row" key={index}>
      <span className="palette-order">{String(index + 1).padStart(2, '0')}</span>
      <input aria-label={`${label} ${index + 1}`} type="color" value={rgbaToHex(color).slice(0, 7)}
        onChange={event => onChange(colors.map((entry, i) => i === index ? { ...hexToRgb(event.target.value), a: entry.a } : entry))} />
      <input aria-label={`${label} ${index + 1} alpha`} type="range" min={0} max={255} value={color.a}
        onChange={event => onChange(colors.map((entry, i) => i === index ? { ...entry, a: Number(event.target.value) } : entry))} />
      <code>{rgbaToHex(color).toUpperCase()}</code>
    </div>)}
  </div></div>
}

export function FireballPreviewTools({ parameters, onChange, onResize }: Omit<Props, 'category'>) {
  const { locale } = useI18n()
  const c = copy[locale]
  return <GeneratorPreviewTools canvasSize={{ width: parameters.canvasWidth, height: parameters.canvasHeight }}
    onResize={onResize} seedValue={parameters.seed} onSeedChange={seed => onChange({ ...parameters, seed })}
    minimumSize={MIN_CANVAS_SIZE} maximumSize={MAX_CANVAS_SIZE} seedLabel={c.seed}
    seedDescription={c.seed} seedRandomizeLabel={locale === 'zh-CN' ? '随机' : 'Randomize'} />
}
