import { useCallback, useRef } from 'react'
import { NumberControl, SelectControl } from '../../components/controls'
import { GeneratorPreviewTools } from '../../components/PreviewTools'
import { useI18n } from '../../i18n/I18nProvider'
import type { MessageKey } from '../../i18n/messages'
import type { FrameSize } from '../../shared/pixel/frame'
import {
  DissolveControls,
  EffectControls,
  FamilyPaletteEditor,
  ShapeCardGrid,
  type FamilyEffectValues,
  type FamilyTranslate,
  type ShapeCardOption,
} from '../shared-effects/controls'
import type { ExplosionCategory } from './module'
import {
  DEFAULT_EXPLOSION_PARAMETERS,
  MAX_CANVAS_SIZE,
  MIN_CANVAS_SIZE,
  MODERN_EXPLOSION_PARAMETERS,
  createExplosionSurface,
  explosionFrameLimits,
  type ExplosionParameters,
  type ExplosionShape,
  type ExplosionSurfaceStyle,
} from './model'
import { renderExplosionFrames } from './renderer'

interface ExplosionControlsProps {
  readonly category: ExplosionCategory
  readonly parameters: ExplosionParameters
  readonly onChange: (parameters: ExplosionParameters) => void
}

/** Renders the active four-tab combustion explosion parameter category. */
export function ExplosionControls({ category, parameters, onChange }: ExplosionControlsProps) {
  const { t } = useI18n()
  const familyT: FamilyTranslate = useCallback(
    (suffix, params) => t(suffix as MessageKey, params as never),
    [t],
  )
  const limits = explosionFrameLimits({ width: parameters.canvasWidth, height: parameters.canvasHeight })
  const updateBody = (patch: Partial<ExplosionParameters['body']>) => onChange({ ...parameters, body: { ...parameters.body, ...patch } })
  const updateMotion = (patch: Partial<ExplosionParameters['motion']>) => onChange({ ...parameters, motion: { ...parameters.motion, ...patch } })
  const parametersRef = useRef(parameters)
  parametersRef.current = parameters
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const selectShape = useCallback((shape: string) => {
    const current = parametersRef.current
    onChangeRef.current({ ...current, body: { ...current.body, shape: shape as ExplosionShape } })
  }, [])
  const updateEffects = useCallback((values: FamilyEffectValues) => {
    onChange({ ...parameters, core: values.core, shockwave: values.shockwave, tongues: values.tongues, fragments: values.fragments })
  }, [parameters, onChange])

  switch (category) {
    case 'body':
      return (
        <div className="control-list">
          <ShapeCardGrid
            familyId="explosion"
            label={familyT('explosion.controls.shape.label')}
            options={SHAPE_CARD_OPTIONS}
            selected={parameters.body.shape}
            render={renderExplosionFrames}
            onSelect={selectShape}
          />
          <NumberControl label={familyT('explosion.controls.radius.label')} description={familyT('explosion.controls.radius.description')} value={parameters.body.radius} minimum={2} maximum={limits.maxRadius} unit="px" onChange={(radius) => updateBody({ radius })} />
          {parameters.body.shape === 'billowingFireball' ? (
            <NumberControl label={familyT('explosion.controls.churnAmount.label')} description={familyT('explosion.controls.churnAmount.description')} value={parameters.body.churnAmount} minimum={0} maximum={1} step={0.01} scale={100} unit="%" onChange={(churnAmount) => updateBody({ churnAmount })} />
          ) : null}
          {parameters.body.shape === 'pressureBurst' ? (
            <>
              <NumberControl label={familyT('explosion.controls.pressureWidth.label')} description={familyT('explosion.controls.pressureWidth.description')} value={parameters.body.pressureWidth} minimum={1} maximum={24} unit="px" onChange={(pressureWidth) => updateBody({ pressureWidth })} />
              <NumberControl label={familyT('explosion.controls.pressureSharpness.label')} description={familyT('explosion.controls.pressureSharpness.description')} value={parameters.body.pressureSharpness} minimum={0} maximum={1} step={0.01} scale={100} unit="%" onChange={(pressureSharpness) => updateBody({ pressureSharpness })} />
            </>
          ) : null}
          <NumberControl label={familyT('explosion.controls.shapeIrregularity.label')} description={familyT('explosion.controls.shapeIrregularity.description')} value={parameters.body.shapeIrregularity} minimum={0} maximum={1} step={0.01} scale={100} unit="%" onChange={(shapeIrregularity) => updateBody({ shapeIrregularity })} />
          <NumberControl label={familyT('explosion.controls.rotation.label')} description={familyT('explosion.controls.rotation.description')} value={parameters.body.rotation} minimum={0} maximum={359} unit="°" onChange={(rotation) => updateBody({ rotation })} />
        </div>
      )
    case 'motion':
      return (
        <div className="control-list">
          <SelectControl label={familyT('explosion.controls.mode.label')} description={familyT('explosion.controls.mode.description')} value={parameters.motion.mode} options={[
            { value: 'explosion', label: familyT('explosion.options.explosion') },
            { value: 'implosion', label: familyT('explosion.options.implosion') },
          ]} onChange={(mode) => updateMotion({ mode })} />
          <SelectControl label={familyT('explosion.controls.motionCurve.label')} description={familyT('explosion.controls.motionCurve.description')} value={parameters.motion.motionCurve} options={[
            { value: 'crisp', label: familyT('explosion.options.crisp') },
            { value: 'balanced', label: familyT('explosion.options.balanced') },
            { value: 'drifting', label: familyT('explosion.options.drifting') },
          ]} onChange={(motionCurve) => updateMotion({ motionCurve })} />
          <NumberControl label={familyT('explosion.controls.formationDuration.label')} description={familyT('explosion.controls.formationDuration.description')} value={parameters.motion.formationDuration} minimum={0.1} maximum={0.8} step={0.01} scale={100} unit="%" onChange={(formationDuration) => updateMotion({ formationDuration })} />
          <NumberControl label={familyT('explosion.controls.holdDuration.label')} description={familyT('explosion.controls.holdDuration.description')} value={parameters.motion.holdDuration} minimum={0} maximum={0.5} step={0.01} scale={100} unit="%" onChange={(holdDuration) => updateMotion({ holdDuration })} />
        </div>
      )
    case 'material':
      return (
        <div className="control-list">
          <SelectControl label={familyT('explosion.controls.surfaceStyle.label')} description={familyT('explosion.controls.surfaceStyle.description')} value={parameters.surface.style} options={SURFACE_OPTIONS.map((style) => ({ value: style, label: familyT(`explosion.options.${style}`) }))} onChange={(style) => onChange({ ...parameters, surface: createExplosionSurface(style as ExplosionSurfaceStyle, parameters.surface.coverage) })} />
          <NumberControl label={familyT('explosion.controls.coverage.label')} description={familyT('explosion.controls.coverage.description')} value={parameters.surface.coverage} minimum={0} maximum={1} step={0.01} scale={100} unit="%" onChange={(coverage) => onChange({ ...parameters, surface: { ...parameters.surface, coverage } })} />
          <ExplosionSurfaceAdvancedControls parameters={parameters} onChange={onChange} familyT={familyT} />
          <NumberControl label={familyT('explosion.controls.dissolveStart.label')} description={familyT('explosion.controls.dissolveStart.description')} value={parameters.motion.dissolveStart} minimum={0.1} maximum={0.9} step={0.01} scale={100} unit="%" onChange={(dissolveStart) => updateMotion({ dissolveStart })} />
        </div>
      )
    case 'effects':
      return (
        <EffectControls
          family="explosion"
          t={familyT}
          limits={limits}
          shapeCount={8}
          values={{ core: parameters.core, shockwave: parameters.shockwave, tongues: parameters.tongues, fragments: parameters.fragments }}
          onChange={updateEffects}
        />
      )
    case 'palette':
      return <FamilyPaletteEditor family="explosion" t={familyT} palette={parameters.palette} onChange={(palette) => onChange({ ...parameters, palette })} />
  }
}

/** Renders only the parameters owned by the active surface variant. */
function ExplosionSurfaceAdvancedControls({
  parameters,
  onChange,
  familyT,
}: {
  readonly parameters: ExplosionParameters
  readonly onChange: (parameters: ExplosionParameters) => void
  readonly familyT: FamilyTranslate
}) {
  const surface = parameters.surface
  if (surface.style === 'retroPixel') {
    return (
      <DissolveControls
        family="explosion"
        t={familyT}
        style={surface.dissolveStyle}
        size={surface.dissolveSize}
        jitter={surface.dissolveJitter}
        density={surface.dissolveDensity}
        speed={surface.dissolveSpeed}
        onChange={(dissolve) => onChange({ ...parameters, surface: { ...surface, ...dissolve } })}
      />
    )
  }
  return (
    <>
      {surface.style === 'burningLayers' ? (
        <>
          <NumberControl label={familyT('explosion.controls.bandWarp.label')} description={familyT('explosion.controls.bandWarp.description')} value={surface.bandWarp} minimum={0} maximum={1} step={0.01} scale={100} unit="%" onChange={(bandWarp) => onChange({ ...parameters, surface: { ...surface, bandWarp } })} />
          <NumberControl label={familyT('explosion.controls.edgeBreakup.label')} description={familyT('explosion.controls.edgeBreakup.description')} value={surface.edgeBreakup} minimum={0} maximum={1} step={0.01} scale={100} unit="%" onChange={(edgeBreakup) => onChange({ ...parameters, surface: { ...surface, edgeBreakup } })} />
        </>
      ) : (
        <>
          <NumberControl label={familyT('explosion.controls.sootAmount.label')} description={familyT('explosion.controls.sootAmount.description')} value={surface.sootAmount} minimum={0} maximum={0.65} step={0.01} scale={100} unit="%" onChange={(sootAmount) => onChange({ ...parameters, surface: { ...surface, sootAmount } })} />
          <NumberControl label={familyT('explosion.controls.sootScale.label')} description={familyT('explosion.controls.sootScale.description')} value={surface.sootScale} minimum={6} maximum={24} unit="px" onChange={(sootScale) => onChange({ ...parameters, surface: { ...surface, sootScale } })} />
        </>
      )}
    </>
  )
}

/** Renders canvas size and deterministic seed controls under the timeline. */
export function ExplosionPreviewTools({ parameters, onChange, onResize }: {
  readonly parameters: ExplosionParameters
  readonly onChange: (parameters: ExplosionParameters) => void
  readonly onResize?: (nextSize: FrameSize, scaleEffect: boolean) => void
}) {
  const { t } = useI18n()
  return (
    <GeneratorPreviewTools
      canvasSize={{ width: parameters.canvasWidth, height: parameters.canvasHeight }}
      onResize={onResize}
      seedValue={parameters.seed}
      onSeedChange={(seed) => onChange({ ...parameters, seed })}
      minimumSize={MIN_CANVAS_SIZE}
      maximumSize={MAX_CANVAS_SIZE}
      seedLabel={t('explosion.controls.seed.label')}
      seedDescription={t('explosion.controls.seed.description')}
      seedRandomizeLabel={t('explosion.seed.randomize')}
    />
  )
}

/** Fixed-seed thumbnail parameters for every combustion shape card. */
const THUMBNAIL_SEED = 1337
const SHAPE_THUMBNAILS: Readonly<Record<ExplosionShape, ExplosionParameters>> = {
  billowingFireball: { ...MODERN_EXPLOSION_PARAMETERS, seed: THUMBNAIL_SEED },
  pressureBurst: {
    ...MODERN_EXPLOSION_PARAMETERS,
    seed: THUMBNAIL_SEED,
    body: { ...MODERN_EXPLOSION_PARAMETERS.body, shape: 'pressureBurst', shapeIrregularity: 0.1, pressureWidth: 8, pressureSharpness: 0.95 },
    surface: { style: 'rollingSoot', coverage: 0.9, sootAmount: 0.16, sootScale: 12 },
    core: { ...MODERN_EXPLOSION_PARAMETERS.core, radius: 18, duration: 0.14 },
    tongues: { ...MODERN_EXPLOSION_PARAMETERS.tongues, count: 6, length: 16, width: 2 },
  },
  legacyRadial: {
    ...DEFAULT_EXPLOSION_PARAMETERS,
    seed: THUMBNAIL_SEED,
  },
}

const SHAPE_CARD_OPTIONS: readonly ShapeCardOption<ExplosionParameters>[] = [
  { value: 'billowingFireball', labelKey: 'explosion.options.billowingFireball', descriptionKey: 'explosion.shapeDescriptions.billowingFireball', buildParameters: () => SHAPE_THUMBNAILS.billowingFireball },
  { value: 'pressureBurst', labelKey: 'explosion.options.pressureBurst', descriptionKey: 'explosion.shapeDescriptions.pressureBurst', buildParameters: () => SHAPE_THUMBNAILS.pressureBurst },
  { value: 'legacyRadial', labelKey: 'explosion.options.legacyRadial', descriptionKey: 'explosion.shapeDescriptions.legacyRadial', buildParameters: () => SHAPE_THUMBNAILS.legacyRadial },
]

const SURFACE_OPTIONS: readonly ExplosionSurfaceStyle[] = ['retroPixel', 'burningLayers', 'rollingSoot']
