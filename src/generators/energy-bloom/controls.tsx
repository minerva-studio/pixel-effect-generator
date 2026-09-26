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
import type { BloomCategory } from './module'
import {
  bloomFrameLimits,
  createBloomSurface,
  DEFAULT_BLOOM_PARAMETERS,
  MAX_CANVAS_SIZE,
  MIN_CANVAS_SIZE,
  type BloomParameters,
  type BloomShape,
  type BloomSurfaceStyle,
  selectBloomShape,
} from './model'
import { renderBloomFrames } from './renderer'

interface BloomControlsProps {
  readonly category: BloomCategory
  readonly parameters: BloomParameters
  readonly onChange: (parameters: BloomParameters) => void
}

/** Renders the active four-tab energy bloom parameter category. */
export function BloomControls({ category, parameters, onChange }: BloomControlsProps) {
  const { t } = useI18n()
  const familyT: FamilyTranslate = useCallback(
    (suffix, params) => t(suffix as MessageKey, params as never),
    [t],
  )
  const limits = bloomFrameLimits({ width: parameters.canvasWidth, height: parameters.canvasHeight })
  const updateBody = (patch: Partial<BloomParameters['body']>) => onChange({ ...parameters, body: { ...parameters.body, ...patch } })
  const updateMotion = (patch: Partial<BloomParameters['motion']>) => onChange({ ...parameters, motion: { ...parameters.motion, ...patch } })
  const selectShape = (shape: string) => onChange(selectBloomShape(parameters, shape as BloomShape))
  const updateEffects = useCallback((values: FamilyEffectValues) => {
    onChange({ ...parameters, core: values.core, shockwave: values.shockwave, tongues: values.tongues, fragments: values.fragments })
  }, [parameters, onChange])

  switch (category) {
    case 'body':
      return (
        <div className="control-list">
          <ShapeCardGrid
            familyId="energyBloom"
            label={familyT('energyBloom.controls.shape.label')}
            options={SHAPE_CARD_OPTIONS}
            selected={parameters.body.shape}
            render={renderBloomFrames}
            onSelect={selectShape}
          />
          <NumberControl label={familyT('energyBloom.controls.radius.label')} description={familyT('energyBloom.controls.radius.description')} value={parameters.body.radius} minimum={2} maximum={limits.maxRadius} unit="px" onChange={(radius) => updateBody({ radius })} />
          {parameters.body.shape === 'softPetals' ? (
            <>
              <NumberControl label={familyT('energyBloom.controls.petalCount.label')} description={familyT('energyBloom.controls.petalCount.description')} value={parameters.body.petalCount} minimum={5} maximum={9} onChange={(petalCount) => updateBody({ petalCount })} />
              <PercentControl label={familyT('energyBloom.controls.petalStretch.label')} description={familyT('energyBloom.controls.petalStretch.description')} value={parameters.body.petalStretch} minimum={0} maximum={1} onChange={(petalStretch) => updateBody({ petalStretch })} />
            </>
          ) : null}
          {parameters.body.shape === 'sharpStarburst' ? (
            <>
              <NumberControl label={familyT('energyBloom.controls.rayCount.label')} description={familyT('energyBloom.controls.rayCount.description')} value={parameters.body.rayCount} minimum={6} maximum={16} onChange={(rayCount) => updateBody({ rayCount })} />
              <PercentControl label={familyT('energyBloom.controls.rayTaper.label')} description={familyT('energyBloom.controls.rayTaper.description')} value={parameters.body.rayTaper} minimum={0} maximum={1} onChange={(rayTaper) => updateBody({ rayTaper })} />
            </>
          ) : null}
          {parameters.body.shape === 'layeredCorolla' ? (
            <>
              <NumberControl label={familyT('energyBloom.controls.corollaLayers.label')} description={familyT('energyBloom.controls.corollaLayers.description')} value={parameters.body.corollaLayers} minimum={2} maximum={3} onChange={(corollaLayers) => updateBody({ corollaLayers })} />
              <PercentControl label={familyT('energyBloom.controls.layerDelay.label')} description={familyT('energyBloom.controls.layerDelay.description')} value={parameters.body.layerDelay} minimum={0} maximum={0.4} onChange={(layerDelay) => updateBody({ layerDelay })} />
            </>
          ) : null}
          <PercentControl label={familyT('energyBloom.controls.shapeIrregularity.label')} description={familyT('energyBloom.controls.shapeIrregularity.description')} value={parameters.body.shapeIrregularity} minimum={0} maximum={1} onChange={(shapeIrregularity) => updateBody({ shapeIrregularity })} />
          <NumberControl label={familyT('energyBloom.controls.rotation.label')} description={familyT('energyBloom.controls.rotation.description')} value={parameters.body.rotation} minimum={0} maximum={359} unit="°" onChange={(rotation) => updateBody({ rotation })} />
        </div>
      )
    case 'motion':
      return (
        <div className="control-list">
          <SegmentedControl label={familyT('energyBloom.controls.mode.label')} description={familyT('energyBloom.controls.mode.description')} value={parameters.motion.mode} options={[
            { value: 'explosion', label: familyT('energyBloom.options.explosion') },
            { value: 'implosion', label: familyT('energyBloom.options.implosion') },
          ]} onChange={(mode) => updateMotion({ mode })} />
          <SelectControl label={familyT('energyBloom.controls.motionCurve.label')} description={familyT('energyBloom.controls.motionCurve.description')} value={parameters.motion.motionCurve} options={[
            { value: 'crisp', label: familyT('energyBloom.options.crisp') },
            { value: 'balanced', label: familyT('energyBloom.options.balanced') },
            { value: 'drifting', label: familyT('energyBloom.options.drifting') },
          ]} onChange={(motionCurve) => updateMotion({ motionCurve })} />
          <PercentControl label={familyT('energyBloom.controls.formationDuration.label')} description={familyT('energyBloom.controls.formationDuration.description')} value={parameters.motion.formationDuration} minimum={0.1} maximum={0.8} onChange={(formationDuration) => updateMotion({ formationDuration })} />
          <PercentControl label={familyT('energyBloom.controls.holdDuration.label')} description={familyT('energyBloom.controls.holdDuration.description')} value={parameters.motion.holdDuration} minimum={0} maximum={0.5} onChange={(holdDuration) => updateMotion({ holdDuration })} />
        </div>
      )
    case 'material':
      return (
        <div className="control-list">
          <SelectControl label={familyT('energyBloom.controls.surfaceStyle.label')} description={familyT('energyBloom.controls.surfaceStyle.description')} value={parameters.surface.style} options={SURFACE_OPTIONS.map((style) => ({ value: style, label: familyT(`energyBloom.options.${style}`) }))} onChange={(style) => onChange({ ...parameters, surface: createBloomSurface(style as BloomSurfaceStyle, parameters.surface.coverage) })} />
          <PercentControl label={familyT('energyBloom.controls.coverage.label')} description={familyT('energyBloom.controls.coverage.description')} value={parameters.surface.coverage} minimum={0} maximum={1} onChange={(coverage) => onChange({ ...parameters, surface: { ...parameters.surface, coverage } })} />
          <BloomSurfaceAdvancedControls parameters={parameters} onChange={onChange} familyT={familyT} />
          <PercentControl label={familyT('energyBloom.controls.dissolveStart.label')} description={familyT('energyBloom.controls.dissolveStart.description')} value={parameters.motion.dissolveStart} minimum={0.1} maximum={0.9} onChange={(dissolveStart) => updateMotion({ dissolveStart })} />
        </div>
      )
    case 'effects':
      return (
        <EffectControls
          family="energyBloom"
          t={familyT}
          limits={limits}
          shapeCount={10}
          values={{ core: parameters.core, shockwave: parameters.shockwave, tongues: parameters.tongues, fragments: parameters.fragments }}
          onChange={updateEffects}
        />
      )
  }
}

/** Renders only the parameters owned by the active surface variant. */
function BloomSurfaceAdvancedControls({
  parameters,
  onChange,
  familyT,
}: {
  readonly parameters: BloomParameters
  readonly onChange: (parameters: BloomParameters) => void
  readonly familyT: FamilyTranslate
}) {
  const surface = parameters.surface
  if (surface.style === 'gridNoise') return null
  if (surface.style === 'pixelNoise') {
    return (
      <DissolveControls
        family="energyBloom"
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
      {surface.style === 'celBands' ? (
        <>
          <PercentControl label={familyT('energyBloom.controls.bandWarp.label')} description={familyT('energyBloom.controls.bandWarp.description')} value={surface.bandWarp} minimum={0} maximum={1} onChange={(bandWarp) => onChange({ ...parameters, surface: { ...surface, bandWarp } })} />
          <PercentControl label={familyT('energyBloom.controls.edgeBreakup.label')} description={familyT('energyBloom.controls.edgeBreakup.description')} value={surface.edgeBreakup} minimum={0} maximum={1} onChange={(edgeBreakup) => onChange({ ...parameters, surface: { ...surface, edgeBreakup } })} />
        </>
      ) : null}
      {surface.style === 'moltenCavities' ? (
        <>
          <PercentControl label={familyT('energyBloom.controls.cavityAmount.label')} description={familyT('energyBloom.controls.cavityAmount.description')} value={surface.cavityAmount} minimum={0} maximum={0.65} onChange={(cavityAmount) => onChange({ ...parameters, surface: { ...surface, cavityAmount } })} />
          <NumberControl label={familyT('energyBloom.controls.cavityScale.label')} description={familyT('energyBloom.controls.cavityScale.description')} value={surface.cavityScale} minimum={6} maximum={24} unit="px" onChange={(cavityScale) => onChange({ ...parameters, surface: { ...surface, cavityScale } })} />
        </>
      ) : null}
      {surface.style === 'crystalShards' ? (
        <>
          <NumberControl label={familyT('energyBloom.controls.chunkSize.label')} description={familyT('energyBloom.controls.chunkSize.description')} value={surface.chunkSize} minimum={4} maximum={16} unit="px" onChange={(chunkSize) => onChange({ ...parameters, surface: { ...surface, chunkSize } })} />
          <NumberControl label={familyT('energyBloom.controls.crackWidth.label')} description={familyT('energyBloom.controls.crackWidth.description')} value={surface.crackWidth} minimum={1} maximum={2} unit="px" onChange={(crackWidth) => onChange({ ...parameters, surface: { ...surface, crackWidth } })} />
        </>
      ) : null}
    </>
  )
}

export const BloomPreviewTools = createPreviewTools<BloomParameters>({ keyPrefix: 'energyBloom', minimumSize: MIN_CANVAS_SIZE, maximumSize: MAX_CANVAS_SIZE })

/** Neutral fixed-seed parameters keep bloom shape cards focused on body geometry. */
const SHAPE_THUMBNAIL_BASE: BloomParameters = {
  ...DEFAULT_BLOOM_PARAMETERS,
  seed: 1337,
  core: { ...DEFAULT_BLOOM_PARAMETERS.core, enabled: false },
  shockwave: { ...DEFAULT_BLOOM_PARAMETERS.shockwave, mode: 'none' },
  tongues: { ...DEFAULT_BLOOM_PARAMETERS.tongues, enabled: false },
  fragments: { ...DEFAULT_BLOOM_PARAMETERS.fragments, enabled: false },
}

const SHAPE_CARD_OPTIONS: readonly ShapeCardOption<BloomParameters>[] = [
  { value: 'softPetals', labelKey: 'energyBloom.options.softPetals', descriptionKey: 'energyBloom.shapeDescriptions.softPetals', buildParameters: () => selectBloomShape(SHAPE_THUMBNAIL_BASE, 'softPetals') },
  { value: 'sharpStarburst', labelKey: 'energyBloom.options.sharpStarburst', descriptionKey: 'energyBloom.shapeDescriptions.sharpStarburst', buildParameters: () => selectBloomShape(SHAPE_THUMBNAIL_BASE, 'sharpStarburst') },
  { value: 'layeredCorolla', labelKey: 'energyBloom.options.layeredCorolla', descriptionKey: 'energyBloom.shapeDescriptions.layeredCorolla', buildParameters: () => selectBloomShape(SHAPE_THUMBNAIL_BASE, 'layeredCorolla') },
  { value: 'arcaneBurst', labelKey: 'energyBloom.options.arcaneBurst', descriptionKey: 'energyBloom.shapeDescriptions.arcaneBurst', buildParameters: () => selectBloomShape(SHAPE_THUMBNAIL_BASE, 'arcaneBurst') },
]

const SURFACE_OPTIONS: readonly BloomSurfaceStyle[] = ['celBands', 'moltenCavities', 'crystalShards', 'gridNoise', 'pixelNoise']
