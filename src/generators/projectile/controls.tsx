import { PercentControl, NumberControl, SelectControl } from '../../components/controls'
import { createPreviewTools } from '../../components/PreviewTools'
import { useI18n } from '../../i18n/I18nProvider'
import type { FrameSize } from '../../shared/pixel/frame'
import {
  FeatureSection,
  ShapeCardGrid,
  type ShapeCardOption,
} from '../shared-effects/controls'
import {
  DEFAULT_PROJECTILE_PARAMETERS,
  MAX_AFTERIMAGE_COUNT,
  MAX_CANVAS_SIZE,
  MAX_LOOP_CYCLES,
  MAX_SPARK_COUNT,
  MIN_CANVAS_SIZE,
  projectileFrameLimits,
  selectProjectileShape,
  selectedProjectileShape,
  setProjectileTrailEnabled,
  type ProjectileParameters,
  type ProjectileShape,
  type SparkSettings,
} from './model'
import type { ProjectileCategory } from './module'
import { renderProjectileFrames } from './renderer'

interface ProjectileControlsProps {
  readonly category: ProjectileCategory
  readonly parameters: ProjectileParameters
  readonly onChange: (parameters: ProjectileParameters) => void
  readonly onResize?: (nextSize: FrameSize, scaleEffect: boolean) => void
  readonly allowedKind?: ProjectileParameters['kind']
  readonly embeddedClassic?: boolean
}

/** Renders the active projectile parameter category without owning state. */
export function ProjectileControls({ category, parameters, onChange, allowedKind, embeddedClassic = false }: ProjectileControlsProps) {
  const { t } = useI18n()
  const limits = projectileFrameLimits({ width: parameters.canvasWidth, height: parameters.canvasHeight })
  const update = <Key extends keyof ProjectileParameters>(key: Key, value: ProjectileParameters[Key]) => {
    const next = { ...parameters, [key]: value }
    if (key === 'radius' && next.trailWidth > Number(value)) {
      next.trailWidth = Number(value)
    }
    onChange(next)
  }

  switch (category) {
    case 'body':
      return (
        <div className="control-list">
          {allowedKind !== 'fireball' && <ShapeCardGrid
            familyId="projectile"
            label={t('projectile.controls.kind.label')}
            options={allowedKind ? BODY_CARD_OPTIONS.filter((option) =>
              allowedKind === 'arrow' ? option.value === 'solidArrow' || option.value === 'energyArrow'
                : option.value === 'crystalSpear' || option.value === 'crystalCore') : BODY_CARD_OPTIONS}
            selected={selectedProjectileShape(parameters)}
            render={renderProjectileFrames}
            onSelect={(value) => onChange(selectProjectileShape(parameters, value as ProjectileShape))}
          />}
          {!embeddedClassic && <NumberControl label={t('projectile.controls.radius.label')} description={t('projectile.controls.radius.description')} value={parameters.radius} minimum={2} maximum={limits.maxRadius} unit="px" onChange={(value) => update('radius', value)} />}
          <NumberControl label={t('projectile.controls.bodyLength.label')} description={t('projectile.controls.bodyLength.description')} value={parameters.bodyLength} minimum={4} maximum={limits.maxBodyLength} unit="px" onChange={(value) => update('bodyLength', value)} />
          <PercentControl label={t('projectile.controls.silhouetteVariation.label')} description={t('projectile.controls.silhouetteVariation.description')} value={parameters.silhouetteVariation} minimum={0} maximum={1} onChange={(value) => update('silhouetteVariation', value)} />
          {parameters.kind === 'fireball' ? <>
            <PercentControl label={t('projectile.controls.fireRearExtension.label')} description={t('projectile.controls.fireRearExtension.description')} value={parameters.fireRearExtension} minimum={0} maximum={1} onChange={(value) => update('fireRearExtension', value)} />
            <PercentControl label={t('projectile.controls.fireRearTurbulence.label')} description={t('projectile.controls.fireRearTurbulence.description')} value={parameters.fireRearTurbulence} minimum={0} maximum={1} onChange={(value) => update('fireRearTurbulence', value)} />
            <NumberControl label={t('projectile.controls.fireFlowSpeed.label')} description={t('projectile.controls.fireFlowSpeed.description')} value={parameters.fireFlowSpeed} minimum={0.25} maximum={3} step={0.05} unit="×" onChange={(value) => update('fireFlowSpeed', value)} />
            <PercentControl label={t('projectile.controls.fireMottleAmount.label')} description={t('projectile.controls.fireMottleAmount.description')} value={parameters.fireMottleAmount} minimum={0} maximum={1} onChange={(value) => update('fireMottleAmount', value)} />
          </> : null}
          {parameters.kind === 'arrow' && parameters.arrowMaterial === 'solid' ? <>
            <PercentControl label={t('projectile.controls.solidHeadLength.label')} description={t('projectile.controls.solidHeadLength.description')} value={parameters.solidHeadLength} minimum={0.15} maximum={0.55} onChange={(value) => update('solidHeadLength', value)} />
            <PercentControl label={t('projectile.controls.solidShaftWidth.label')} description={t('projectile.controls.solidShaftWidth.description')} value={parameters.solidShaftWidth} minimum={0.08} maximum={0.4} onChange={(value) => update('solidShaftWidth', value)} />
            <PercentControl label={t('projectile.controls.solidFletchingSpread.label')} description={t('projectile.controls.solidFletchingSpread.description')} value={parameters.solidFletchingSpread} minimum={0.2} maximum={1} onChange={(value) => update('solidFletchingSpread', value)} />
          </> : null}
          {parameters.kind === 'arrow' && parameters.arrowMaterial === 'energy' ? <>
            <PercentControl label={t('projectile.controls.energyCoreLength.label')} description={t('projectile.controls.energyCoreLength.description')} value={parameters.energyCoreLength} minimum={0.25} maximum={0.85} onChange={(value) => update('energyCoreLength', value)} />
            <PercentControl label={t('projectile.controls.energyShellWidth.label')} description={t('projectile.controls.energyShellWidth.description')} value={parameters.energyShellWidth} minimum={0.05} maximum={0.5} onChange={(value) => update('energyShellWidth', value)} />
            <PercentControl label={t('projectile.controls.energyTipSharpness.label')} description={t('projectile.controls.energyTipSharpness.description')} value={parameters.energyTipSharpness} minimum={0.2} maximum={0.8} onChange={(value) => update('energyTipSharpness', value)} />
          </> : null}
          {parameters.kind === 'crystal' && parameters.crystalForm === 'spear' ? <>
            <PercentControl label={t('projectile.controls.crystalSpearTaper.label')} description={t('projectile.controls.crystalSpearTaper.description')} value={parameters.crystalSpearTaper} minimum={0.2} maximum={0.8} onChange={(value) => update('crystalSpearTaper', value)} />
            <PercentControl label={t('projectile.controls.crystalSpearThickness.label')} description={t('projectile.controls.crystalSpearThickness.description')} value={parameters.crystalSpearThickness} minimum={0.5} maximum={1.5} onChange={(value) => update('crystalSpearThickness', value)} />
            <PercentControl label={t('projectile.controls.crystalRefractionStrength.label')} description={t('projectile.controls.crystalRefractionStrength.description')} value={parameters.crystalRefractionStrength} minimum={0} maximum={1} onChange={(value) => update('crystalRefractionStrength', value)} />
            <PercentControl label={t('projectile.controls.crystalGlintStrength.label')} description={t('projectile.controls.crystalGlintStrength.description')} value={parameters.crystalGlintStrength} minimum={0} maximum={1} onChange={(value) => update('crystalGlintStrength', value)} />
            <NumberControl label={t('projectile.controls.crystalGlintSpeed.label')} description={t('projectile.controls.crystalGlintSpeed.description')} value={parameters.crystalGlintSpeed} minimum={0.25} maximum={3} step={0.05} unit="×" onChange={(value) => update('crystalGlintSpeed', value)} />
          </> : null}
          {parameters.kind === 'crystal' && parameters.crystalForm === 'core' ? <>
            <PercentControl label={t('projectile.controls.crystalCoreScale.label')} description={t('projectile.controls.crystalCoreScale.description')} value={parameters.crystalCoreScale} minimum={0.5} maximum={1.5} onChange={(value) => update('crystalCoreScale', value)} />
            <PercentControl label={t('projectile.controls.crystalOrbitRadius.label')} description={t('projectile.controls.crystalOrbitRadius.description')} value={parameters.crystalOrbitRadius} minimum={0.75} maximum={2.25} onChange={(value) => update('crystalOrbitRadius', value)} />
            <NumberControl label={t('projectile.controls.crystalOrbitSpeed.label')} description={t('projectile.controls.crystalOrbitSpeed.description')} value={parameters.crystalOrbitSpeed} minimum={0.25} maximum={3} step={0.05} unit="×" onChange={(value) => update('crystalOrbitSpeed', value)} />
            <PercentControl label={t('projectile.controls.crystalGlintStrength.label')} description={t('projectile.controls.crystalGlintStrength.description')} value={parameters.crystalGlintStrength} minimum={0} maximum={1} onChange={(value) => update('crystalGlintStrength', value)} />
            <NumberControl label={t('projectile.controls.crystalGlintSpeed.label')} description={t('projectile.controls.crystalGlintSpeed.description')} value={parameters.crystalGlintSpeed} minimum={0.25} maximum={3} step={0.05} unit="×" onChange={(value) => update('crystalGlintSpeed', value)} />
          </> : null}
          {!embeddedClassic && <NumberControl label={t('projectile.controls.rotation.label')} description={t('projectile.controls.rotation.description')} value={parameters.rotationDegrees} minimum={0} maximum={359} unit="°" onChange={(value) => update('rotationDegrees', value)} />}
        </div>
      )
    case 'motion':
      return (
        <div className="control-list">
          {!embeddedClassic && <NumberControl label={t('projectile.controls.loopCycles.label')} description={t('projectile.controls.loopCycles.description')} value={parameters.loopCycles} minimum={1} maximum={MAX_LOOP_CYCLES} unit="×" onChange={(value) => update('loopCycles', value)} />}
          <PercentControl label={t('projectile.controls.pulseAmount.label')} description={t('projectile.controls.pulseAmount.description')} value={parameters.pulseAmount} minimum={0} maximum={1} onChange={(value) => update('pulseAmount', value)} />
          <PercentControl label={t('projectile.controls.wobbleAmount.label')} description={t('projectile.controls.wobbleAmount.description')} value={parameters.wobbleAmount} minimum={0} maximum={1} onChange={(value) => update('wobbleAmount', value)} />
        </div>
      )
    case 'trail':
      return (
        <div className="control-list">
          <FeatureSection label={t('projectile.controls.trailMode.label')} description={t('projectile.controls.trailMode.description')} enabled={parameters.trailEnabled && parameters.trailMode !== 'off'} status={t(parameters.trailEnabled && parameters.trailMode !== 'off' ? 'controls.feature.enabled' : 'controls.feature.disabled')} onChangeEnabled={(enabled) => onChange(setProjectileTrailEnabled(parameters, enabled))}>
            <SelectControl label={t('projectile.controls.trailMode.label')} description={t('projectile.controls.trailMode.description')} value={parameters.trailMode === 'off' ? (parameters.kind === 'fireball' ? 'fire' : 'energy') : parameters.trailMode} options={[
              { value: 'fire', label: t('projectile.options.trailFire') },
              { value: 'energy', label: t('projectile.options.trailEnergy') },
            ]} onChange={(value) => update('trailMode', value)} />
            <PercentControl label={t('projectile.controls.trailLength.label')} description={t('projectile.controls.trailLength.description')} value={parameters.trailLength} minimum={0} maximum={1} onChange={(value) => update('trailLength', value)} />
            <NumberControl label={t('projectile.controls.trailWidth.label')} description={t('projectile.controls.trailWidth.description')} value={parameters.trailWidth} minimum={1} maximum={parameters.radius} unit="px" onChange={(value) => update('trailWidth', value)} />
            <PercentControl label={t('projectile.controls.trailWave.label')} description={t('projectile.controls.trailWave.description')} value={parameters.trailWave} minimum={0} maximum={1} onChange={(value) => update('trailWave', value)} />
            <PercentControl label={t('projectile.controls.trailBreakup.label')} description={t('projectile.controls.trailBreakup.description')} value={parameters.trailBreakup} minimum={0} maximum={1} onChange={(value) => update('trailBreakup', value)} />
          </FeatureSection>
        </div>
      )
    case 'effects':
      return (
        <div className="control-list">
          <SparkControls sparks={parameters} onChange={(sparks) => onChange({ ...parameters, ...sparks })} />
          <FeatureSection label={t('projectile.controls.afterimages.label')} description={t('projectile.controls.afterimages.description')} enabled={parameters.afterimagesEnabled} status={t(parameters.afterimagesEnabled ? 'controls.feature.enabled' : 'controls.feature.disabled')} onChangeEnabled={(value) => update('afterimagesEnabled', value)}>
            <NumberControl label={t('projectile.controls.afterimageCount.label')} description={t('projectile.controls.afterimageCount.description')} value={parameters.afterimageCount} minimum={0} maximum={MAX_AFTERIMAGE_COUNT} onChange={(value) => update('afterimageCount', value)} />
            <PercentControl label={t('projectile.controls.afterimageSpacing.label')} description={t('projectile.controls.afterimageSpacing.description')} value={parameters.afterimageSpacing} minimum={0} maximum={1} onChange={(value) => update('afterimageSpacing', value)} />
            <PercentControl label={t('projectile.controls.afterimageDecay.label')} description={t('projectile.controls.afterimageDecay.description')} value={parameters.afterimageDecay} minimum={0} maximum={1} onChange={(value) => update('afterimageDecay', value)} />
          </FeatureSection>
        </div>
      )
  }
}

/** Neutral fixed-seed parameters keep body thumbnails comparable. */
const BODY_THUMBNAIL_BASE: ProjectileParameters = {
  ...DEFAULT_PROJECTILE_PARAMETERS,
  seed: 1337,
  trailMode: 'off',
  trailEnabled: false,
  sparksEnabled: false,
  afterimagesEnabled: false,
}

const BODY_CARD_OPTIONS: readonly ShapeCardOption<ProjectileParameters>[] = [
  { value: 'fireball', labelKey: 'projectile.bodyCards.fireball.label', descriptionKey: 'projectile.bodyCards.fireball.description', buildParameters: () => selectProjectileShape(BODY_THUMBNAIL_BASE, 'fireball') },
  { value: 'solidArrow', labelKey: 'projectile.bodyCards.solidArrow.label', descriptionKey: 'projectile.bodyCards.solidArrow.description', buildParameters: () => selectProjectileShape(BODY_THUMBNAIL_BASE, 'solidArrow') },
  { value: 'energyArrow', labelKey: 'projectile.bodyCards.energyArrow.label', descriptionKey: 'projectile.bodyCards.energyArrow.description', buildParameters: () => selectProjectileShape(BODY_THUMBNAIL_BASE, 'energyArrow') },
  { value: 'crystalSpear', labelKey: 'projectile.bodyCards.crystalSpear.label', descriptionKey: 'projectile.bodyCards.crystalSpear.description', buildParameters: () => selectProjectileShape(BODY_THUMBNAIL_BASE, 'crystalSpear') },
  { value: 'crystalCore', labelKey: 'projectile.bodyCards.crystalCore.label', descriptionKey: 'projectile.bodyCards.crystalCore.description', buildParameters: () => selectProjectileShape(BODY_THUMBNAIL_BASE, 'crystalCore') },
]

export const ProjectilePreviewTools = createPreviewTools<ProjectileParameters>({ keyPrefix: 'projectile', minimumSize: MIN_CANVAS_SIZE, maximumSize: MAX_CANVAS_SIZE, seedKey: 'randomSeed' })

/** Shared spark section; the fireball's other forms reuse the same controls. */
export function SparkControls({ sparks, onChange }: { readonly sparks: SparkSettings; readonly onChange: (sparks: SparkSettings) => void }) {
  const { t } = useI18n()
  const update = <Key extends keyof SparkSettings>(key: Key, value: SparkSettings[Key]) => onChange({ ...sparks, [key]: value })
  return (
    <FeatureSection label={t('projectile.controls.sparks.label')} description={t('projectile.controls.sparks.description')} enabled={sparks.sparksEnabled} status={t(sparks.sparksEnabled ? 'controls.feature.enabled' : 'controls.feature.disabled')} onChangeEnabled={(enabled) => update('sparksEnabled', enabled)}>
      <NumberControl label={t('projectile.controls.sparkCount.label')} description={t('projectile.controls.sparkCount.description')} value={sparks.sparkCount} minimum={0} maximum={MAX_SPARK_COUNT} onChange={(value) => update('sparkCount', value)} />
      <PercentControl label={t('projectile.controls.sparkSpread.label')} description={t('projectile.controls.sparkSpread.description')} value={sparks.sparkSpread} minimum={0} maximum={1} onChange={(value) => update('sparkSpread', value)} />
      <PercentControl label={t('projectile.controls.sparkSpacing.label')} description={t('projectile.controls.sparkSpacing.description')} value={sparks.sparkSpacing} minimum={0} maximum={1} onChange={(value) => update('sparkSpacing', value)} />
      <PercentControl label={t('projectile.controls.sparkFade.label')} description={t('projectile.controls.sparkFade.description')} value={sparks.sparkFade} minimum={0} maximum={1} onChange={(value) => update('sparkFade', value)} />
    </FeatureSection>
  )
}
