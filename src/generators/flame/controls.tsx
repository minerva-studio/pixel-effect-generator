import { NumberControl, ToggleControl } from '../../components/controls'
import { createPreviewTools } from '../../components/PreviewTools'
import { useI18n } from '../../i18n/I18nProvider'
import type { MessageKey } from '../../i18n/messages'
import { FamilyPaletteEditor, ShapeCardGrid, type FamilyTranslate } from '../shared-effects/controls'
import { FLAME_SHAPES, MAX_CANVAS_SIZE, MIN_CANVAS_SIZE, flameNumericBounds, type FlameParameters, type FlameShape } from './model'
import { FLAME_SHAPE_DEFAULTS } from './presets'
import { renderFlameFrames } from './renderer'
import type { FlameCategory } from './module'

const cards = FLAME_SHAPES.map((shape) => ({ value: shape, labelKey: `flame.options.${shape}`, descriptionKey: `flame.shapeDescriptions.${shape}`, buildParameters: () => ({ ...FLAME_SHAPE_DEFAULTS[shape], seed: 1337 }) }))
const categoryFields = {
  shape: ['width', 'height', 'baseWidth', 'fork', 'roughness'],
  motion: ['loopCycles', 'sway', 'flicker', 'flowSpeed', 'turbulence'],
  details: ['coreSize', 'bandWarp', 'edgeBreakup'],
} as const

/** Uses shared inputs while preserving opaque palette and shape-only selection contracts. */
export function FlameControls({ category, parameters: p, onChange }: { readonly category: FlameCategory; readonly parameters: FlameParameters; readonly onChange: (p: FlameParameters) => void }) {
  const { t } = useI18n()
  const translate: FamilyTranslate = (key, params) => t(key as MessageKey, params as never)
  const bounds = flameNumericBounds(p)
  const field = (key: (typeof categoryFields)[keyof typeof categoryFields][number] | 'sparkCount' | 'sparkSpread' | 'sparkRise') => {
    const [minimum, maximum, step] = bounds[key]
    return <NumberControl key={key} label={t(`flame.controls.${key}.label`)} description={t(`flame.controls.${key}.description`)} value={p[key]} minimum={minimum} maximum={maximum} step={step} scale={step === 0.01 ? 100 : 1} unit={step === 0.01 ? '%' : ['width', 'height', 'baseWidth', 'sparkRise'].includes(key) ? 'px' : ''} onChange={(value) => onChange({ ...p, [key]: value, ...(key === 'width' ? { baseWidth: Math.min(p.baseWidth, value) } : {}) })} />
  }
  if (category === 'palette') return <FamilyPaletteEditor family="flame" t={translate} palette={p.palette} minimumColors={3} opaque onChange={(palette) => onChange({ ...p, palette })} />
  return <div className="control-list">
    {category === 'shape' && <ShapeCardGrid familyId="flame" label={t('flame.controls.shape.label')} options={cards} selected={p.shape} render={renderFlameFrames} onSelect={(shape) => onChange({ ...p, shape: shape as FlameShape })} />}
    {categoryFields[category].map(field)}
    {category === 'details' && <>
      <ToggleControl label={t('flame.controls.sparksEnabled.label')} description={t('flame.controls.sparksEnabled.description')} checked={p.sparksEnabled} onChange={(sparksEnabled) => onChange({ ...p, sparksEnabled })} />
      {p.sparksEnabled && (['sparkCount', 'sparkSpread', 'sparkRise'] as const).map(field)}
    </>}
  </div>
}

/** Canvas resize and seed controls shared with the other generator workspaces. */
export const FlamePreviewTools = createPreviewTools<FlameParameters>({ keyPrefix: 'flame', minimumSize: MIN_CANVAS_SIZE, maximumSize: MAX_CANVAS_SIZE })
