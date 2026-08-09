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
  const parametersRef = useRef(parameters)
  parametersRef.current = parameters
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const selectShape = useCallback((shape: string) => {
    const current = parametersRef.current
    onChangeRef.current({ ...current, body: { ...current.body, shape: shape as BloomShape } })
  }, [])
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
              <NumberControl label={familyT('energyBloom.controls.petalStretch.label')} description={familyT('energyBloom.controls.petalStretch.description')} value={parameters.body.petalStretch} minimum={0} maximum={1} step={0.01} scale={100} unit="%" onChange={(petalStretch) => updateBody({ petalStretch })} />
            </>
          ) : null}
          {parameters.body.shape === 'sharpStarburst' ? (
            <>
              <NumberControl label={familyT('energyBloom.controls.rayCount.label')} description={familyT('energyBloom.controls.rayCount.description')} value={parameters.body.rayCount} minimum={6} maximum={16} onChange={(rayCount) => updateBody({ rayCount })} />
              <NumberControl label={familyT('energyBloom.controls.rayTaper.label')} description={familyT('energyBloom.controls.rayTaper.description')} value={parameters.body.rayTaper} minimum={0} maximum={1} step={0.01} scale={100} unit="%" onChange={(rayTaper) => updateBody({ rayTaper })} />
            </>
          ) : null}
          {parameters.body.shape === 'layeredCorolla' ? (
            <>
              <NumberControl label={familyT('energyBloom.controls.corollaLayers.label')} description={familyT('energyBloom.controls.corollaLayers.description')} value={parameters.body.corollaLayers} minimum={2} maximum={3} onChange={(corollaLayers) => updateBody({ corollaLayers })} />
              <NumberControl label={familyT('energyBloom.controls.layerDelay.label')} description={familyT('energyBloom.controls.layerDelay.description')} value={parameters.body.layerDelay} minimum={0} maximum={0.4} step={0.01} scale={100} unit="%" onChange={(layerDelay) => updateBody({ layerDelay })} />
            </>
          ) : null}
          <NumberControl label={familyT('energyBloom.controls.shapeIrregularity.label')} description={familyT('energyBloom.controls.shapeIrregularity.description')} value={parameters.body.shapeIrregularity} minimum={0} maximum={1} step={0.01} scale={100} unit="%" onChange={(shapeIrregularity) => updateBody({ shapeIrregularity })} />
          <NumberControl label={familyT('energyBloom.controls.rotation.label')} description={familyT('energyBloom.controls.rotation.description')} value={parameters.body.rotation} minimum={0} maximum={359} unit="°" onChange={(rotation) => updateBody({ rotation })} />
        </div>
      )
    case 'motion':
      return (
        <div className="control-list">
          <SelectControl label={familyT('energyBloom.controls.mode.label')} description={familyT('energyBloom.controls.mode.description')} value={parameters.motion.mode} options={[
            { value: 'explosion', label: familyT('energyBloom.options.explosion') },
            { value: 'implosion', label: familyT('energyBloom.options.implosion') },
          ]} onChange={(mode) => updateMotion({ mode })} />
          <SelectControl label={familyT('energyBloom.controls.motionCurve.label')} description={familyT('energyBloom.controls.motionCurve.description')} value={parameters.motion.motionCurve} options={[
            { value: 'crisp', label: familyT('energyBloom.options.crisp') },
            { value: 'balanced', label: familyT('energyBloom.options.balanced') },
            { value: 'drifting', label: familyT('energyBloom.options.drifting') },
          ]} onChange={(motionCurve) => updateMotion({ motionCurve })} />
          <NumberControl label={familyT('energyBloom.controls.formationDuration.label')} description={familyT('energyBloom.controls.formationDuration.description')} value={parameters.motion.formationDuration} minimum={0.1} maximum={0.8} step={0.01} scale={100} unit="%" onChange={(formationDuration) => updateMotion({ formationDuration })} />
          <NumberControl label={familyT('energyBloom.controls.holdDuration.label')} description={familyT('energyBloom.controls.holdDuration.description')} value={parameters.motion.holdDuration} minimum={0} maximum={0.5} step={0.01} scale={100} unit="%" onChange={(holdDuration) => updateMotion({ holdDuration })} />
        </div>
      )
    case 'material':
      return (
        <div className="control-list">
          <SelectControl label={familyT('energyBloom.controls.surfaceStyle.label')} description={familyT('energyBloom.controls.surfaceStyle.description')} value={parameters.surface.style} options={SURFACE_OPTIONS.map((style) => ({ value: style, label: familyT(`energyBloom.options.${style}`) }))} onChange={(style) => onChange({ ...parameters, surface: createBloomSurface(style as BloomSurfaceStyle, parameters.surface.coverage) })} />
          <NumberControl label={familyT('energyBloom.controls.coverage.label')} description={familyT('energyBloom.controls.coverage.description')} value={parameters.surface.coverage} minimum={0} maximum={1} step={0.01} scale={100} unit="%" onChange={(coverage) => onChange({ ...parameters, surface: { ...parameters.surface, coverage } })} />
          <BloomSurfaceAdvancedControls parameters={parameters} onChange={onChange} familyT={familyT} />
          <NumberControl label={familyT('energyBloom.controls.dissolveStart.label')} description={familyT('energyBloom.controls.dissolveStart.description')} value={parameters.motion.dissolveStart} minimum={0.1} maximum={0.9} step={0.01} scale={100} unit="%" onChange={(dissolveStart) => updateMotion({ dissolveStart })} />
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
    case 'palette':
      return <FamilyPaletteEditor family="energyBloom" t={familyT} palette={parameters.palette} onChange={(palette) => onChange({ ...parameters, palette })} />
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
          <NumberControl label={familyT('energyBloom.controls.bandWarp.label')} description={familyT('energyBloom.controls.bandWarp.description')} value={surface.bandWarp} minimum={0} maximum={1} step={0.01} scale={100} unit="%" onChange={(bandWarp) => onChange({ ...parameters, surface: { ...surface, bandWarp } })} />
          <NumberControl label={familyT('energyBloom.controls.edgeBreakup.label')} description={familyT('energyBloom.controls.edgeBreakup.description')} value={surface.edgeBreakup} minimum={0} maximum={1} step={0.01} scale={100} unit="%" onChange={(edgeBreakup) => onChange({ ...parameters, surface: { ...surface, edgeBreakup } })} />
        </>
      ) : null}
      {surface.style === 'moltenCavities' ? (
        <>
          <NumberControl label={familyT('energyBloom.controls.cavityAmount.label')} description={familyT('energyBloom.controls.cavityAmount.description')} value={surface.cavityAmount} minimum={0} maximum={0.65} step={0.01} scale={100} unit="%" onChange={(cavityAmount) => onChange({ ...parameters, surface: { ...surface, cavityAmount } })} />
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

/** Renders canvas size and deterministic seed controls under the timeline. */
export function BloomPreviewTools({ parameters, onChange, onResize }: {
  readonly parameters: BloomParameters
  readonly onChange: (parameters: BloomParameters) => void
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
      seedLabel={t('energyBloom.controls.seed.label')}
      seedDescription={t('energyBloom.controls.seed.description')}
      seedRandomizeLabel={t('energyBloom.seed.randomize')}
    />
  )
}

/** Fixed-seed thumbnail parameters for every bloom shape card. */
const THUMBNAIL_SEED = 1337
const SHAPE_THUMBNAILS: Readonly<Record<BloomShape, BloomParameters>> = {
  softPetals: { ...DEFAULT_BLOOM_PARAMETERS, seed: THUMBNAIL_SEED },
  sharpStarburst: {
    ...DEFAULT_BLOOM_PARAMETERS,
    seed: THUMBNAIL_SEED,
    body: { ...DEFAULT_BLOOM_PARAMETERS.body, shape: 'sharpStarburst', rayCount: 12, rayTaper: 0.75, shapeIrregularity: 0.12 },
    surface: { style: 'crystalShards', coverage: 0.95, chunkSize: 10, crackWidth: 1 },
    tongues: { ...DEFAULT_BLOOM_PARAMETERS.tongues, enabled: true, count: 6, length: 26, width: 2 },
  },
  layeredCorolla: {
    ...DEFAULT_BLOOM_PARAMETERS,
    seed: THUMBNAIL_SEED,
    body: { ...DEFAULT_BLOOM_PARAMETERS.body, shape: 'layeredCorolla', corollaLayers: 2, layerDelay: 0.2, petalCount: 8 },
    surface: { style: 'moltenCavities', coverage: 0.94, cavityAmount: 0.22, cavityScale: 12 },
    tongues: { ...DEFAULT_BLOOM_PARAMETERS.tongues, enabled: true, count: 8, length: 18, width: 2 },
  },
  arcaneBurst: {
    ...DEFAULT_BLOOM_PARAMETERS,
    seed: THUMBNAIL_SEED,
    body: { ...DEFAULT_BLOOM_PARAMETERS.body, shape: 'arcaneBurst', petalCount: 5, petalStretch: 0.7, shapeIrregularity: 0.12 },
    surface: { style: 'crystalShards', coverage: 0.95, chunkSize: 7, crackWidth: 1 },
    shockwave: { ...DEFAULT_BLOOM_PARAMETERS.shockwave, mode: 'none' },
    tongues: { ...DEFAULT_BLOOM_PARAMETERS.tongues, enabled: false },
  },
}

const SHAPE_CARD_OPTIONS: readonly ShapeCardOption<BloomParameters>[] = [
  { value: 'softPetals', labelKey: 'energyBloom.options.softPetals', descriptionKey: 'energyBloom.shapeDescriptions.softPetals', buildParameters: () => SHAPE_THUMBNAILS.softPetals },
  { value: 'sharpStarburst', labelKey: 'energyBloom.options.sharpStarburst', descriptionKey: 'energyBloom.shapeDescriptions.sharpStarburst', buildParameters: () => SHAPE_THUMBNAILS.sharpStarburst },
  { value: 'layeredCorolla', labelKey: 'energyBloom.options.layeredCorolla', descriptionKey: 'energyBloom.shapeDescriptions.layeredCorolla', buildParameters: () => SHAPE_THUMBNAILS.layeredCorolla },
  { value: 'arcaneBurst', labelKey: 'energyBloom.options.arcaneBurst', descriptionKey: 'energyBloom.shapeDescriptions.arcaneBurst', buildParameters: () => SHAPE_THUMBNAILS.arcaneBurst },
]

const SURFACE_OPTIONS: readonly BloomSurfaceStyle[] = ['celBands', 'moltenCavities', 'crystalShards', 'gridNoise', 'pixelNoise']
