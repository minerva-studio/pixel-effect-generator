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
  SMOKE_EXPLOSION_PALETTE,
  createExplosionSurface,
  explosionFrameLimits,
  explosionShapeCount,
  explosionVolumeProfiles,
  normalizeExplosionVolume,
  type ExplosionParameters,
  type ExplosionShape,
  type ExplosionSmokeMotion,
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
    const option = SHAPE_CARD_OPTIONS.find((candidate) => candidate.value === shape)
    if (!option?.buildParameters || option.disabled) return
    const next = option.buildParameters()
    onChangeRef.current({
      ...next,
      canvasWidth: current.canvasWidth,
      canvasHeight: current.canvasHeight,
      frameCount: current.frameCount,
      seed: current.seed,
    })
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
          {parameters.body.shape === 'gameFireball' ? (
            <>
              <NumberControl label={familyT('explosion.controls.lobeCount.label')} description={familyT('explosion.controls.lobeCount.description')} value={parameters.body.lobeCount} minimum={3} maximum={9} onChange={(lobeCount) => updateBody({ lobeCount })} />
              <NumberControl label={familyT('explosion.controls.churnAmount.label')} description={familyT('explosion.controls.churnAmount.description')} value={parameters.body.churnAmount} minimum={0} maximum={1} step={0.01} scale={100} unit="%" onChange={(churnAmount) => updateBody({ churnAmount })} />
            </>
          ) : null}
          {parameters.body.shape === 'turbulentFireball' ? (
            <NumberControl label={familyT('explosion.controls.turbulence.label')} description={familyT('explosion.controls.turbulence.description')} value={parameters.body.churnAmount} minimum={0} maximum={1} step={0.01} scale={100} unit="%" onChange={(churnAmount) => updateBody({ churnAmount })} />
          ) : null}
          {parameters.body.shape === 'shockBlast' ? (
            <>
              <NumberControl label={familyT('explosion.controls.pressureCount.label')} description={familyT('explosion.controls.pressureCount.description')} value={parameters.body.pressureCount} minimum={3} maximum={12} onChange={(pressureCount) => updateBody({ pressureCount })} />
              <NumberControl label={familyT('explosion.controls.pressureWidth.label')} description={familyT('explosion.controls.pressureWidth.description')} value={parameters.body.pressureWidth} minimum={1} maximum={48} unit="px" onChange={(pressureWidth) => updateBody({ pressureWidth })} />
              <NumberControl label={familyT('explosion.controls.pressureSharpness.label')} description={familyT('explosion.controls.pressureSharpness.description')} value={parameters.body.pressureSharpness} minimum={0} maximum={1} step={0.01} scale={100} unit="%" onChange={(pressureSharpness) => updateBody({ pressureSharpness })} />
            </>
          ) : null}
          {parameters.body.shape === 'smokeBurst' ? (
            <>
              <SelectControl label={familyT('explosion.controls.smokeMotion.label')} description={familyT('explosion.controls.smokeMotion.description')} value={parameters.body.smokeMotion} options={SMOKE_MOTION_OPTIONS.map((value) => ({ value, label: familyT(`explosion.options.${value}`) }))} onChange={(smokeMotion) => updateBody({ smokeMotion: smokeMotion as ExplosionSmokeMotion })} />
              <NumberControl label={familyT('explosion.controls.smokeCount.label')} description={familyT('explosion.controls.smokeCount.description')} value={parameters.body.smokeCount} minimum={3} maximum={9} onChange={(smokeCount) => updateBody({ smokeCount })} />
              <NumberControl label={familyT('explosion.controls.smokeSpread.label')} description={familyT('explosion.controls.smokeSpread.description')} value={parameters.body.smokeSpread} minimum={0.2} maximum={1.4} step={0.01} scale={100} unit="%" onChange={(smokeSpread) => updateBody({ smokeSpread })} />
              <NumberControl label={familyT('explosion.controls.smokeRise.label')} description={familyT('explosion.controls.smokeRise.description')} value={parameters.body.smokeRise} minimum={-0.6} maximum={0.6} step={0.01} scale={100} unit="%" onChange={(smokeRise) => updateBody({ smokeRise })} />
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
    case 'material': {
      const modernShape = parameters.body.shape !== 'legacyRadial'
      const profiles = explosionVolumeProfiles(parameters.body.shape)
      if (modernShape && parameters.volume.enabled) {
        return (
          <div className="control-list">
            {profiles.length > 1 ? (
              <SelectControl label={familyT('explosion.controls.volumeProfile.label')} description={familyT('explosion.controls.volumeProfile.description')} value={parameters.volume.profile} options={profiles.map((profile) => ({
                value: profile,
                label: familyT(`explosion.options.${profile}`),
              }))} onChange={(profile) => onChange({ ...parameters, volume: normalizeExplosionVolume(parameters.body.shape, { ...parameters.volume, profile }) })} />
            ) : (
              <p className="material-mode-note">{familyT('explosion.controls.fixedVolumeProfile')}</p>
            )}
          </div>
        )
      }
      return (
        <div className="control-list">
          {modernShape ? (
            <div className="compatibility-panel" role="status">
              <p>{familyT('explosion.controls.flatCompatibility')}</p>
              <button className="secondary-button" type="button" onClick={() => onChange({
                ...parameters,
                volume: normalizeExplosionVolume(parameters.body.shape, { ...parameters.volume, enabled: true }),
              })}>{familyT('explosion.controls.convertToVolume')}</button>
            </div>
          ) : null}
          <SelectControl label={familyT('explosion.controls.surfaceStyle.label')} description={familyT('explosion.controls.surfaceStyle.description')} value={parameters.surface.style} options={SURFACE_OPTIONS.map((style) => ({ value: style, label: familyT(`explosion.options.${style}`) }))} onChange={(style) => onChange({ ...parameters, surface: createExplosionSurface(style as ExplosionSurfaceStyle, parameters.surface.coverage) })} />
          <NumberControl label={familyT('explosion.controls.coverage.label')} description={familyT('explosion.controls.coverage.description')} value={parameters.surface.coverage} minimum={0} maximum={1} step={0.01} scale={100} unit="%" onChange={(coverage) => onChange({ ...parameters, surface: { ...parameters.surface, coverage } })} />
          <ExplosionSurfaceAdvancedControls parameters={parameters} onChange={onChange} familyT={familyT} />
          <NumberControl label={familyT('explosion.controls.dissolveStart.label')} description={familyT('explosion.controls.dissolveStart.description')} value={parameters.motion.dissolveStart} minimum={0.1} maximum={0.9} step={0.01} scale={100} unit="%" onChange={(dissolveStart) => updateMotion({ dissolveStart })} />
        </div>
      )
    }
    case 'effects':
      return (
        <EffectControls
          family="explosion"
          t={familyT}
          limits={limits}
          shapeCount={explosionShapeCount(parameters.body.shape, parameters.body.lobeCount, parameters.body.pressureCount)}
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
const THUMBNAIL_FRAGMENTS = { ...MODERN_EXPLOSION_PARAMETERS.fragments, enabled: false }
const SHAPE_THUMBNAILS: Readonly<Record<ExplosionShape, ExplosionParameters>> = {
  gameFireball: { ...MODERN_EXPLOSION_PARAMETERS, seed: THUMBNAIL_SEED, fragments: THUMBNAIL_FRAGMENTS },
  turbulentFireball: {
    ...MODERN_EXPLOSION_PARAMETERS,
    seed: THUMBNAIL_SEED,
    body: { ...MODERN_EXPLOSION_PARAMETERS.body, shape: 'turbulentFireball', churnAmount: 0.78 },
    volume: { enabled: true, profile: 'smokeFire' },
    fragments: THUMBNAIL_FRAGMENTS,
  },
  shockBlast: {
    ...MODERN_EXPLOSION_PARAMETERS,
    seed: THUMBNAIL_SEED,
    body: { ...MODERN_EXPLOSION_PARAMETERS.body, shape: 'shockBlast', pressureWidth: 24, pressureSharpness: 0.78 },
    fragments: THUMBNAIL_FRAGMENTS,
  },
  smokeBurst: {
    ...MODERN_EXPLOSION_PARAMETERS,
    seed: THUMBNAIL_SEED,
    palette: SMOKE_EXPLOSION_PALETTE,
    volume: { enabled: true, profile: 'smokeFire' },
    body: { ...MODERN_EXPLOSION_PARAMETERS.body, shape: 'smokeBurst', smokeSpread: 1.2, smokeRise: 0.18, smokeCount: 5, smokeMotion: 'billowing' },
    surface: { style: 'rollingSoot', coverage: 0.94, sootAmount: 0.38, sootScale: 15 },
    core: { ...MODERN_EXPLOSION_PARAMETERS.core, enabled: false },
    fragments: THUMBNAIL_FRAGMENTS,
  },
  legacyRadial: {
    ...DEFAULT_EXPLOSION_PARAMETERS,
    seed: THUMBNAIL_SEED,
  },
}

const SHAPE_CARD_OPTIONS: readonly ShapeCardOption<ExplosionParameters>[] = [
  { value: 'legacyRadial', labelKey: 'explosion.options.legacyRadial', descriptionKey: 'explosion.shapeDescriptions.legacyRadial', buildParameters: () => SHAPE_THUMBNAILS.legacyRadial },
  { value: 'gameFireball', labelKey: 'explosion.options.gameFireball', descriptionKey: 'explosion.shapeDescriptions.gameFireball', buildParameters: () => SHAPE_THUMBNAILS.gameFireball },
  { value: 'smokeBurst', labelKey: 'explosion.options.smokeBurst', descriptionKey: 'explosion.shapeDescriptions.smokeBurst', buildParameters: () => SHAPE_THUMBNAILS.smokeBurst },
  { value: 'shockBlast', labelKey: 'explosion.options.shockBlast', descriptionKey: 'explosion.shapeDescriptions.shockBlast', buildParameters: () => SHAPE_THUMBNAILS.shockBlast },
  { value: 'turbulentFireball', labelKey: 'explosion.options.turbulentFireball', descriptionKey: 'explosion.shapeDescriptions.turbulentFireball', buildParameters: () => SHAPE_THUMBNAILS.turbulentFireball },
]

const SURFACE_OPTIONS: readonly ExplosionSurfaceStyle[] = ['retroPixel', 'burningLayers', 'rollingSoot']
const SMOKE_MOTION_OPTIONS: readonly ExplosionSmokeMotion[] = ['billowing', 'particulate']
