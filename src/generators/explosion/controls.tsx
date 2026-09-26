import { useCallback } from 'react'
import { PercentControl, NumberControl, SelectControl, SegmentedControl } from '../../components/controls'
import { createPreviewTools } from '../../components/PreviewTools'
import { useI18n } from '../../i18n/I18nProvider'
import type { MessageKey } from '../../i18n/messages'
import type { FrameSize } from '../../shared/pixel/frame'
import {
  DissolveControls,
  EffectControls,
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
  createExplosionSurface,
  explosionFrameLimits,
  explosionShapeCount,
  explosionVolumeProfiles,
  isFieldExplosionShape,
  normalizeExplosionVolume,
  selectExplosionShape,
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
  const selectShape = (shape: string) => onChange(selectExplosionShape(parameters, shape as ExplosionShape))
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
          {parameters.body.shape === 'billowBurst' ? (
            <>
              <PercentControl label={familyT('explosion.controls.impulse.label')} description={familyT('explosion.controls.impulse.description')} value={parameters.body.impulse} minimum={0} maximum={1} onChange={(impulse) => updateBody({ impulse })} />
              <PercentControl label={familyT('explosion.controls.billow.label')} description={familyT('explosion.controls.billow.description')} value={parameters.body.billow} minimum={0} maximum={1} onChange={(billow) => updateBody({ billow })} />
              <PercentControl label={familyT('explosion.controls.midRoll.label')} description={familyT('explosion.controls.midRoll.description')} value={parameters.body.churnAmount} minimum={0} maximum={1} onChange={(churnAmount) => updateBody({ churnAmount })} />
              <NumberControl label={familyT('explosion.controls.debrisCount.label')} description={familyT('explosion.controls.debrisCount.description')} value={parameters.body.debrisCount} minimum={0} maximum={24} onChange={(debrisCount) => updateBody({ debrisCount })} />
            </>
          ) : null}
          {parameters.body.shape === 'puffCluster' ? (
            <>
              <NumberControl label={familyT('explosion.controls.massCount.label')} description={familyT('explosion.controls.massCount.description')} value={parameters.body.massCount} minimum={4} maximum={14} onChange={(massCount) => updateBody({ massCount })} />
              <PercentControl label={familyT('explosion.controls.throwDistance.label')} description={familyT('explosion.controls.throwDistance.description')} value={parameters.body.throwDistance} minimum={0} maximum={1} onChange={(throwDistance) => updateBody({ throwDistance })} />
              <PercentControl label={familyT('explosion.controls.buoyancy.label')} description={familyT('explosion.controls.buoyancy.description')} value={parameters.body.buoyancy} minimum={0} maximum={1} onChange={(buoyancy) => updateBody({ buoyancy })} />
              <PercentControl label={familyT('explosion.controls.billow.label')} description={familyT('explosion.controls.billow.description')} value={parameters.body.billow} minimum={0} maximum={1} onChange={(billow) => updateBody({ billow })} />
            </>
          ) : null}
          {parameters.body.shape === 'rollingFireball' ? (
            <>
              <NumberControl label={familyT('explosion.controls.lobeCount.label')} description={familyT('explosion.controls.lobeCount.description')} value={parameters.body.lobeCount} minimum={3} maximum={9} onChange={(lobeCount) => updateBody({ lobeCount })} />
              <PercentControl label={familyT('explosion.controls.churnAmount.label')} description={familyT('explosion.controls.churnAmount.description')} value={parameters.body.churnAmount} minimum={0} maximum={1} onChange={(churnAmount) => updateBody({ churnAmount })} />
            </>
          ) : null}
          {parameters.body.shape === 'shockBlast' ? (
            <>
              <NumberControl label={familyT('explosion.controls.pressureCount.label')} description={familyT('explosion.controls.pressureCount.description')} value={parameters.body.pressureCount} minimum={3} maximum={12} onChange={(pressureCount) => updateBody({ pressureCount })} />
              <NumberControl label={familyT('explosion.controls.pressureWidth.label')} description={familyT('explosion.controls.pressureWidth.description')} value={parameters.body.pressureWidth} minimum={1} maximum={48} unit="px" onChange={(pressureWidth) => updateBody({ pressureWidth })} />
              <PercentControl label={familyT('explosion.controls.pressureSharpness.label')} description={familyT('explosion.controls.pressureSharpness.description')} value={parameters.body.pressureSharpness} minimum={0} maximum={1} onChange={(pressureSharpness) => updateBody({ pressureSharpness })} />
            </>
          ) : null}
          {parameters.body.shape === 'smokeBurst' ? (
            <>
              <SelectControl label={familyT('explosion.controls.smokeMotion.label')} description={familyT('explosion.controls.smokeMotion.description')} value={parameters.body.smokeMotion} options={SMOKE_MOTION_OPTIONS.map((value) => ({ value, label: familyT(`explosion.options.${value}`) }))} onChange={(smokeMotion) => updateBody({ smokeMotion: smokeMotion as ExplosionSmokeMotion })} />
              <NumberControl label={familyT('explosion.controls.smokeCount.label')} description={familyT('explosion.controls.smokeCount.description')} value={parameters.body.smokeCount} minimum={3} maximum={9} onChange={(smokeCount) => updateBody({ smokeCount })} />
              <PercentControl label={familyT('explosion.controls.smokeSpread.label')} description={familyT('explosion.controls.smokeSpread.description')} value={parameters.body.smokeSpread} minimum={0.2} maximum={1.4} onChange={(smokeSpread) => updateBody({ smokeSpread })} />
              <PercentControl label={familyT('explosion.controls.smokeRise.label')} description={familyT('explosion.controls.smokeRise.description')} value={parameters.body.smokeRise} minimum={-0.6} maximum={0.6} onChange={(smokeRise) => updateBody({ smokeRise })} />
            </>
          ) : null}
          {isFieldExplosionShape(parameters.body.shape) ? null : <PercentControl label={familyT('explosion.controls.shapeIrregularity.label')} description={familyT('explosion.controls.shapeIrregularity.description')} value={parameters.body.shapeIrregularity} minimum={0} maximum={1} onChange={(shapeIrregularity) => updateBody({ shapeIrregularity })} />}
          <NumberControl label={familyT('explosion.controls.rotation.label')} description={familyT('explosion.controls.rotation.description')} value={parameters.body.rotation} minimum={0} maximum={359} unit="°" onChange={(rotation) => updateBody({ rotation })} />
        </div>
      )
    case 'motion':
      return (
        <div className="control-list">
          <SegmentedControl label={familyT('explosion.controls.mode.label')} description={familyT('explosion.controls.mode.description')} value={parameters.motion.mode} options={[
            { value: 'explosion', label: familyT('explosion.options.explosion') },
            { value: 'implosion', label: familyT('explosion.options.implosion') },
          ]} onChange={(mode) => updateMotion({ mode })} />
          {isFieldExplosionShape(parameters.body.shape) ? <p className="material-mode-note">{familyT('explosion.controls.fieldMotionNote')}</p> : <>
          <SelectControl label={familyT('explosion.controls.motionCurve.label')} description={familyT('explosion.controls.motionCurve.description')} value={parameters.motion.motionCurve} options={[
            { value: 'crisp', label: familyT('explosion.options.crisp') },
            { value: 'balanced', label: familyT('explosion.options.balanced') },
            { value: 'drifting', label: familyT('explosion.options.drifting') },
          ]} onChange={(motionCurve) => updateMotion({ motionCurve })} />
          <PercentControl label={familyT('explosion.controls.formationDuration.label')} description={familyT('explosion.controls.formationDuration.description')} value={parameters.motion.formationDuration} minimum={0.1} maximum={0.8} onChange={(formationDuration) => updateMotion({ formationDuration })} />
          <PercentControl label={familyT('explosion.controls.holdDuration.label')} description={familyT('explosion.controls.holdDuration.description')} value={parameters.motion.holdDuration} minimum={0} maximum={0.5} onChange={(holdDuration) => updateMotion({ holdDuration })} />
          </>}
        </div>
      )
    case 'material': {
      if (isFieldExplosionShape(parameters.body.shape)) {
        return (
          <div className="control-list">
            <p className="material-mode-note">{familyT('explosion.controls.fieldMaterial')}</p>
            <ExplosionSurfaceAdvancedControls parameters={parameters} onChange={onChange} familyT={familyT} />
          </div>
        )
      }
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
          <PercentControl label={familyT('explosion.controls.coverage.label')} description={familyT('explosion.controls.coverage.description')} value={parameters.surface.coverage} minimum={0} maximum={1} onChange={(coverage) => onChange({ ...parameters, surface: { ...parameters.surface, coverage } })} />
          <ExplosionSurfaceAdvancedControls parameters={parameters} onChange={onChange} familyT={familyT} />
          <PercentControl label={familyT('explosion.controls.dissolveStart.label')} description={familyT('explosion.controls.dissolveStart.description')} value={parameters.motion.dissolveStart} minimum={0.1} maximum={0.9} onChange={(dissolveStart) => updateMotion({ dissolveStart })} />
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
          <PercentControl label={familyT('explosion.controls.bandWarp.label')} description={familyT('explosion.controls.bandWarp.description')} value={surface.bandWarp} minimum={0} maximum={1} onChange={(bandWarp) => onChange({ ...parameters, surface: { ...surface, bandWarp } })} />
          <PercentControl label={familyT('explosion.controls.edgeBreakup.label')} description={familyT('explosion.controls.edgeBreakup.description')} value={surface.edgeBreakup} minimum={0} maximum={1} onChange={(edgeBreakup) => onChange({ ...parameters, surface: { ...surface, edgeBreakup } })} />
        </>
      ) : (
        <>
          <PercentControl label={familyT('explosion.controls.sootAmount.label')} description={familyT('explosion.controls.sootAmount.description')} value={surface.sootAmount} minimum={0} maximum={0.65} onChange={(sootAmount) => onChange({ ...parameters, surface: { ...surface, sootAmount } })} />
          <NumberControl label={familyT('explosion.controls.sootScale.label')} description={familyT('explosion.controls.sootScale.description')} value={surface.sootScale} minimum={6} maximum={24} unit="px" onChange={(sootScale) => onChange({ ...parameters, surface: { ...surface, sootScale } })} />
        </>
      )}
    </>
  )
}

export const ExplosionPreviewTools = createPreviewTools<ExplosionParameters>({ keyPrefix: 'explosion', minimumSize: MIN_CANVAS_SIZE, maximumSize: MAX_CANVAS_SIZE })

/** Neutral fixed-seed parameters keep shape cards focused on body geometry. */
const SHAPE_THUMBNAIL_BASE: ExplosionParameters = {
  ...DEFAULT_EXPLOSION_PARAMETERS,
  seed: 1337,
  core: { ...DEFAULT_EXPLOSION_PARAMETERS.core, enabled: false },
  shockwave: { ...DEFAULT_EXPLOSION_PARAMETERS.shockwave, mode: 'none' },
  tongues: { ...DEFAULT_EXPLOSION_PARAMETERS.tongues, enabled: false },
  fragments: { ...DEFAULT_EXPLOSION_PARAMETERS.fragments, enabled: false },
}

const SHAPE_CARD_OPTIONS: readonly ShapeCardOption<ExplosionParameters>[] = [
  { value: 'billowBurst', labelKey: 'explosion.options.billowBurst', descriptionKey: 'explosion.shapeDescriptions.billowBurst', buildParameters: () => selectExplosionShape(SHAPE_THUMBNAIL_BASE, 'billowBurst') },
  { value: 'puffCluster', labelKey: 'explosion.options.puffCluster', descriptionKey: 'explosion.shapeDescriptions.puffCluster', buildParameters: () => selectExplosionShape(SHAPE_THUMBNAIL_BASE, 'puffCluster') },
  { value: 'legacyRadial', labelKey: 'explosion.options.legacyRadial', descriptionKey: 'explosion.shapeDescriptions.legacyRadial', buildParameters: () => selectExplosionShape(SHAPE_THUMBNAIL_BASE, 'legacyRadial') },
  { value: 'rollingFireball', labelKey: 'explosion.options.rollingFireball', descriptionKey: 'explosion.shapeDescriptions.rollingFireball', buildParameters: () => selectExplosionShape(SHAPE_THUMBNAIL_BASE, 'rollingFireball') },
  { value: 'smokeBurst', labelKey: 'explosion.options.smokeBurst', descriptionKey: 'explosion.shapeDescriptions.smokeBurst', buildParameters: () => selectExplosionShape(SHAPE_THUMBNAIL_BASE, 'smokeBurst') },
  { value: 'shockBlast', labelKey: 'explosion.options.shockBlast', descriptionKey: 'explosion.shapeDescriptions.shockBlast', buildParameters: () => selectExplosionShape(SHAPE_THUMBNAIL_BASE, 'shockBlast') },
]

const SURFACE_OPTIONS: readonly ExplosionSurfaceStyle[] = ['retroPixel', 'burningLayers', 'rollingSoot']
const SMOKE_MOTION_OPTIONS: readonly ExplosionSmokeMotion[] = ['billowing', 'particulate']
