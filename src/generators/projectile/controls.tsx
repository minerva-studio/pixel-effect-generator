import { useId } from 'react'
import { InfoHint, NumberControl, SelectControl } from '../../components/controls'
import { GeneratorPreviewTools } from '../../components/PreviewTools'
import { useI18n } from '../../i18n/I18nProvider'
import { hexToRgb, rgbaToHex, type RgbColor } from '../../shared/pixel/color'
import type { FrameSize } from '../../shared/pixel/frame'
import {
  ShapeCardGrid,
  type ShapeCardOption,
} from '../shared-effects/controls'
import {
  DEFAULT_PROJECTILE_PARAMETERS,
  MAX_AFTERIMAGE_COUNT,
  MAX_BODY_PALETTE_SIZE,
  MAX_CANVAS_SIZE,
  MAX_ENERGY_PALETTE_SIZE,
  MAX_LOOP_CYCLES,
  MAX_SPARK_COUNT,
  MIN_BODY_PALETTE_SIZE,
  MIN_CANVAS_SIZE,
  MIN_ENERGY_PALETTE_SIZE,
  projectileFrameLimits,
  type ProjectileParameters,
} from './model'
import type { ProjectileCategory } from './module'
import { renderProjectileFrames } from './renderer'

interface ProjectileControlsProps {
  readonly category: ProjectileCategory
  readonly parameters: ProjectileParameters
  readonly onChange: (parameters: ProjectileParameters) => void
  readonly onResize?: (nextSize: FrameSize, scaleEffect: boolean) => void
}

/** Renders the active projectile parameter category without owning state. */
export function ProjectileControls({ category, parameters, onChange }: ProjectileControlsProps) {
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
          <ShapeCardGrid
            familyId="projectile"
            label={t('projectile.controls.kind.label')}
            options={BODY_CARD_OPTIONS}
            selected={selectedBodyCard(parameters)}
            render={renderProjectileFrames}
            onSelect={(value) => onChange(selectBodyCard(parameters, value as ProjectileBodyCard))}
          />
          <NumberControl label={t('projectile.controls.radius.label')} description={t('projectile.controls.radius.description')} value={parameters.radius} minimum={2} maximum={limits.maxRadius} unit="px" onChange={(value) => update('radius', value)} />
          <NumberControl label={t('projectile.controls.bodyLength.label')} description={t('projectile.controls.bodyLength.description')} value={parameters.bodyLength} minimum={4} maximum={limits.maxBodyLength} unit="px" onChange={(value) => update('bodyLength', value)} />
          <NumberControl label={t('projectile.controls.silhouetteVariation.label')} description={t('projectile.controls.silhouetteVariation.description')} value={parameters.silhouetteVariation} minimum={0} maximum={1} step={0.01} scale={100} unit="%" onChange={(value) => update('silhouetteVariation', value)} />
          {parameters.kind === 'fireball' ? <>
            <NumberControl label={t('projectile.controls.fireRearExtension.label')} description={t('projectile.controls.fireRearExtension.description')} value={parameters.fireRearExtension} minimum={0} maximum={1} step={0.01} scale={100} unit="%" onChange={(value) => update('fireRearExtension', value)} />
            <NumberControl label={t('projectile.controls.fireRearTurbulence.label')} description={t('projectile.controls.fireRearTurbulence.description')} value={parameters.fireRearTurbulence} minimum={0} maximum={1} step={0.01} scale={100} unit="%" onChange={(value) => update('fireRearTurbulence', value)} />
            <NumberControl label={t('projectile.controls.fireFlowSpeed.label')} description={t('projectile.controls.fireFlowSpeed.description')} value={parameters.fireFlowSpeed} minimum={0.25} maximum={3} step={0.05} unit="×" onChange={(value) => update('fireFlowSpeed', value)} />
            <NumberControl label={t('projectile.controls.fireMottleAmount.label')} description={t('projectile.controls.fireMottleAmount.description')} value={parameters.fireMottleAmount} minimum={0} maximum={1} step={0.01} scale={100} unit="%" onChange={(value) => update('fireMottleAmount', value)} />
          </> : null}
          {parameters.kind === 'arrow' && parameters.arrowMaterial === 'solid' ? <>
            <NumberControl label={t('projectile.controls.solidHeadLength.label')} description={t('projectile.controls.solidHeadLength.description')} value={parameters.solidHeadLength} minimum={0.15} maximum={0.55} step={0.01} scale={100} unit="%" onChange={(value) => update('solidHeadLength', value)} />
            <NumberControl label={t('projectile.controls.solidShaftWidth.label')} description={t('projectile.controls.solidShaftWidth.description')} value={parameters.solidShaftWidth} minimum={0.08} maximum={0.4} step={0.01} scale={100} unit="%" onChange={(value) => update('solidShaftWidth', value)} />
            <NumberControl label={t('projectile.controls.solidFletchingSpread.label')} description={t('projectile.controls.solidFletchingSpread.description')} value={parameters.solidFletchingSpread} minimum={0.2} maximum={1} step={0.01} scale={100} unit="%" onChange={(value) => update('solidFletchingSpread', value)} />
          </> : null}
          {parameters.kind === 'arrow' && parameters.arrowMaterial === 'energy' ? <>
            <NumberControl label={t('projectile.controls.energyCoreLength.label')} description={t('projectile.controls.energyCoreLength.description')} value={parameters.energyCoreLength} minimum={0.25} maximum={0.85} step={0.01} scale={100} unit="%" onChange={(value) => update('energyCoreLength', value)} />
            <NumberControl label={t('projectile.controls.energyShellWidth.label')} description={t('projectile.controls.energyShellWidth.description')} value={parameters.energyShellWidth} minimum={0.05} maximum={0.5} step={0.01} scale={100} unit="%" onChange={(value) => update('energyShellWidth', value)} />
            <NumberControl label={t('projectile.controls.energyTipSharpness.label')} description={t('projectile.controls.energyTipSharpness.description')} value={parameters.energyTipSharpness} minimum={0.2} maximum={0.8} step={0.01} scale={100} unit="%" onChange={(value) => update('energyTipSharpness', value)} />
          </> : null}
          {parameters.kind === 'crystal' && parameters.crystalForm === 'spear' ? <>
            <NumberControl label={t('projectile.controls.crystalSpearTaper.label')} description={t('projectile.controls.crystalSpearTaper.description')} value={parameters.crystalSpearTaper} minimum={0.2} maximum={0.8} step={0.01} scale={100} unit="%" onChange={(value) => update('crystalSpearTaper', value)} />
            <NumberControl label={t('projectile.controls.crystalSpearThickness.label')} description={t('projectile.controls.crystalSpearThickness.description')} value={parameters.crystalSpearThickness} minimum={0.5} maximum={1.5} step={0.01} scale={100} unit="%" onChange={(value) => update('crystalSpearThickness', value)} />
            <NumberControl label={t('projectile.controls.crystalRefractionStrength.label')} description={t('projectile.controls.crystalRefractionStrength.description')} value={parameters.crystalRefractionStrength} minimum={0} maximum={1} step={0.01} scale={100} unit="%" onChange={(value) => update('crystalRefractionStrength', value)} />
            <NumberControl label={t('projectile.controls.crystalGlintStrength.label')} description={t('projectile.controls.crystalGlintStrength.description')} value={parameters.crystalGlintStrength} minimum={0} maximum={1} step={0.01} scale={100} unit="%" onChange={(value) => update('crystalGlintStrength', value)} />
            <NumberControl label={t('projectile.controls.crystalGlintSpeed.label')} description={t('projectile.controls.crystalGlintSpeed.description')} value={parameters.crystalGlintSpeed} minimum={0.25} maximum={3} step={0.05} unit="×" onChange={(value) => update('crystalGlintSpeed', value)} />
          </> : null}
          {parameters.kind === 'crystal' && parameters.crystalForm === 'core' ? <>
            <NumberControl label={t('projectile.controls.crystalCoreScale.label')} description={t('projectile.controls.crystalCoreScale.description')} value={parameters.crystalCoreScale} minimum={0.5} maximum={1.5} step={0.01} scale={100} unit="%" onChange={(value) => update('crystalCoreScale', value)} />
            <NumberControl label={t('projectile.controls.crystalOrbitRadius.label')} description={t('projectile.controls.crystalOrbitRadius.description')} value={parameters.crystalOrbitRadius} minimum={0.75} maximum={2.25} step={0.01} scale={100} unit="%" onChange={(value) => update('crystalOrbitRadius', value)} />
            <NumberControl label={t('projectile.controls.crystalOrbitSpeed.label')} description={t('projectile.controls.crystalOrbitSpeed.description')} value={parameters.crystalOrbitSpeed} minimum={0.25} maximum={3} step={0.05} unit="×" onChange={(value) => update('crystalOrbitSpeed', value)} />
            <NumberControl label={t('projectile.controls.crystalGlintStrength.label')} description={t('projectile.controls.crystalGlintStrength.description')} value={parameters.crystalGlintStrength} minimum={0} maximum={1} step={0.01} scale={100} unit="%" onChange={(value) => update('crystalGlintStrength', value)} />
            <NumberControl label={t('projectile.controls.crystalGlintSpeed.label')} description={t('projectile.controls.crystalGlintSpeed.description')} value={parameters.crystalGlintSpeed} minimum={0.25} maximum={3} step={0.05} unit="×" onChange={(value) => update('crystalGlintSpeed', value)} />
          </> : null}
          <NumberControl label={t('projectile.controls.rotation.label')} description={t('projectile.controls.rotation.description')} value={parameters.rotationDegrees} minimum={0} maximum={359} unit="°" onChange={(value) => update('rotationDegrees', value)} />
        </div>
      )
    case 'motion':
      return (
        <div className="control-list">
          <NumberControl label={t('projectile.controls.loopCycles.label')} description={t('projectile.controls.loopCycles.description')} value={parameters.loopCycles} minimum={1} maximum={MAX_LOOP_CYCLES} unit="×" onChange={(value) => update('loopCycles', value)} />
          <NumberControl label={t('projectile.controls.pulseAmount.label')} description={t('projectile.controls.pulseAmount.description')} value={parameters.pulseAmount} minimum={0} maximum={1} step={0.01} scale={100} unit="%" onChange={(value) => update('pulseAmount', value)} />
          <NumberControl label={t('projectile.controls.wobbleAmount.label')} description={t('projectile.controls.wobbleAmount.description')} value={parameters.wobbleAmount} minimum={0} maximum={1} step={0.01} scale={100} unit="%" onChange={(value) => update('wobbleAmount', value)} />
        </div>
      )
    case 'trail':
      return (
        <div className="control-list">
          <SelectControl
            label={t('projectile.controls.trailMode.label')}
            description={t('projectile.controls.trailMode.description')}
            value={parameters.trailMode}
            options={[
              { value: 'off', label: t('projectile.options.trailOff') },
              { value: 'fire', label: t('projectile.options.trailFire') },
              { value: 'energy', label: t('projectile.options.trailEnergy') },
            ]}
            onChange={(value) => update('trailMode', value)}
          />
          {parameters.trailMode !== 'off' ? (
            <>
              <NumberControl label={t('projectile.controls.trailLength.label')} description={t('projectile.controls.trailLength.description')} value={parameters.trailLength} minimum={0} maximum={1} step={0.01} scale={100} unit="%" onChange={(value) => update('trailLength', value)} />
              <NumberControl label={t('projectile.controls.trailWidth.label')} description={t('projectile.controls.trailWidth.description')} value={parameters.trailWidth} minimum={1} maximum={parameters.radius} unit="px" onChange={(value) => update('trailWidth', value)} />
              <NumberControl label={t('projectile.controls.trailWave.label')} description={t('projectile.controls.trailWave.description')} value={parameters.trailWave} minimum={0} maximum={1} step={0.01} scale={100} unit="%" onChange={(value) => update('trailWave', value)} />
              <NumberControl label={t('projectile.controls.trailBreakup.label')} description={t('projectile.controls.trailBreakup.description')} value={parameters.trailBreakup} minimum={0} maximum={1} step={0.01} scale={100} unit="%" onChange={(value) => update('trailBreakup', value)} />
            </>
          ) : null}
        </div>
      )
    case 'effects':
      return (
        <div className="control-list">
          <ToggleControl
            label={t('projectile.controls.sparks.label')}
            description={t('projectile.controls.sparks.description')}
            checked={parameters.sparksEnabled}
            onChange={(value) => update('sparksEnabled', value)}
          />
          {parameters.sparksEnabled ? (
            <>
              <NumberControl label={t('projectile.controls.sparkCount.label')} description={t('projectile.controls.sparkCount.description')} value={parameters.sparkCount} minimum={0} maximum={MAX_SPARK_COUNT} onChange={(value) => update('sparkCount', value)} />
              <NumberControl label={t('projectile.controls.sparkSpread.label')} description={t('projectile.controls.sparkSpread.description')} value={parameters.sparkSpread} minimum={0} maximum={1} step={0.01} scale={100} unit="%" onChange={(value) => update('sparkSpread', value)} />
              <NumberControl label={t('projectile.controls.sparkSpacing.label')} description={t('projectile.controls.sparkSpacing.description')} value={parameters.sparkSpacing} minimum={0} maximum={1} step={0.01} scale={100} unit="%" onChange={(value) => update('sparkSpacing', value)} />
              <NumberControl label={t('projectile.controls.sparkFade.label')} description={t('projectile.controls.sparkFade.description')} value={parameters.sparkFade} minimum={0} maximum={1} step={0.01} scale={100} unit="%" onChange={(value) => update('sparkFade', value)} />
            </>
          ) : null}
          <ToggleControl
            label={t('projectile.controls.afterimages.label')}
            description={t('projectile.controls.afterimages.description')}
            checked={parameters.afterimagesEnabled}
            onChange={(value) => update('afterimagesEnabled', value)}
          />
          {parameters.afterimagesEnabled ? (
            <>
              <NumberControl label={t('projectile.controls.afterimageCount.label')} description={t('projectile.controls.afterimageCount.description')} value={parameters.afterimageCount} minimum={0} maximum={MAX_AFTERIMAGE_COUNT} onChange={(value) => update('afterimageCount', value)} />
              <NumberControl label={t('projectile.controls.afterimageSpacing.label')} description={t('projectile.controls.afterimageSpacing.description')} value={parameters.afterimageSpacing} minimum={0} maximum={1} step={0.01} scale={100} unit="%" onChange={(value) => update('afterimageSpacing', value)} />
              <NumberControl label={t('projectile.controls.afterimageDecay.label')} description={t('projectile.controls.afterimageDecay.description')} value={parameters.afterimageDecay} minimum={0} maximum={1} step={0.01} scale={100} unit="%" onChange={(value) => update('afterimageDecay', value)} />
            </>
          ) : null}
        </div>
      )
    case 'palette':
      return (
        <div className="control-list">
          <PaletteBandEditor
            title={t('projectile.palette.bodyTitle')}
            bandLabel={(index) => t('projectile.palette.bodyBand', { index: index + 1 })}
            removeLabel={(index) => t('projectile.palette.removeBand', { index: index + 1 })}
            addLabel={t('projectile.palette.addBodyColor')}
            alphaLabel={t('projectile.palette.alpha')}
            palette={parameters.bodyPalette}
            minimum={MIN_BODY_PALETTE_SIZE}
            maximum={MAX_BODY_PALETTE_SIZE}
            onChange={(bodyPalette) => update('bodyPalette', bodyPalette)}
          />
          <PaletteBandEditor
            title={t('projectile.palette.energyTitle')}
            bandLabel={(index) => t('projectile.palette.energyBand', { index: index + 1 })}
            removeLabel={(index) => t('projectile.palette.removeBand', { index: index + 1 })}
            addLabel={t('projectile.palette.addEnergyColor')}
            alphaLabel={t('projectile.palette.alpha')}
            palette={parameters.energyPalette}
            minimum={MIN_ENERGY_PALETTE_SIZE}
            maximum={MAX_ENERGY_PALETTE_SIZE}
            onChange={(energyPalette) => update('energyPalette', energyPalette)}
          />
        </div>
      )
  }
}

type ProjectileBodyCard = 'fireball' | 'solidArrow' | 'energyArrow' | 'crystalSpear' | 'crystalCore'

/** Fixed, body-only parameters keep the three animated thumbnails comparable. */
const BODY_THUMBNAIL_BASE: ProjectileParameters = {
  ...DEFAULT_PROJECTILE_PARAMETERS,
  seed: 1337,
  trailMode: 'off',
  sparksEnabled: false,
  afterimagesEnabled: false,
}

const BODY_CARD_OPTIONS: readonly ShapeCardOption<ProjectileParameters>[] = [
  {
    value: 'fireball',
    labelKey: 'projectile.bodyCards.fireball.label',
    descriptionKey: 'projectile.bodyCards.fireball.description',
    buildParameters: () => BODY_THUMBNAIL_BASE,
  },
  {
    value: 'solidArrow',
    labelKey: 'projectile.bodyCards.solidArrow.label',
    descriptionKey: 'projectile.bodyCards.solidArrow.description',
    buildParameters: () => ({ ...BODY_THUMBNAIL_BASE, kind: 'arrow', arrowMaterial: 'solid', radius: 7, bodyLength: 54, trailWidth: 6 }),
  },
  {
    value: 'energyArrow',
    labelKey: 'projectile.bodyCards.energyArrow.label',
    descriptionKey: 'projectile.bodyCards.energyArrow.description',
    buildParameters: () => ({ ...BODY_THUMBNAIL_BASE, kind: 'arrow', arrowMaterial: 'energy', radius: 8, bodyLength: 50, trailWidth: 6 }),
  },
  {
    value: 'crystalSpear',
    labelKey: 'projectile.bodyCards.crystalSpear.label',
    descriptionKey: 'projectile.bodyCards.crystalSpear.description',
    buildParameters: () => ({ ...BODY_THUMBNAIL_BASE, kind: 'crystal', crystalForm: 'spear', radius: 10, bodyLength: 46, trailWidth: 6 }),
  },
  {
    value: 'crystalCore',
    labelKey: 'projectile.bodyCards.crystalCore.label',
    descriptionKey: 'projectile.bodyCards.crystalCore.description',
    buildParameters: () => ({ ...BODY_THUMBNAIL_BASE, kind: 'crystal', crystalForm: 'core', radius: 13, bodyLength: 28, trailWidth: 5 }),
  },
]

/** Maps persisted projectile parameters to exactly one selected body card. */
export function selectedBodyCard(parameters: ProjectileParameters): ProjectileBodyCard {
  if (parameters.kind === 'fireball') return 'fireball'
  if (parameters.kind === 'crystal') return parameters.crystalForm === 'spear' ? 'crystalSpear' : 'crystalCore'
  return parameters.arrowMaterial === 'solid' ? 'solidArrow' : 'energyArrow'
}

/** Applies only the body identity represented by a thumbnail card. */
export function selectBodyCard(parameters: ProjectileParameters, card: ProjectileBodyCard): ProjectileParameters {
  switch (card) {
    case 'fireball':
      return { ...parameters, kind: 'fireball' }
    case 'solidArrow':
      return { ...parameters, kind: 'arrow', arrowMaterial: 'solid' }
    case 'energyArrow':
      return { ...parameters, kind: 'arrow', arrowMaterial: 'energy' }
    case 'crystalSpear':
      return { ...parameters, kind: 'crystal', crystalForm: 'spear', trailMode: 'energy' }
    case 'crystalCore':
      return { ...parameters, kind: 'crystal', crystalForm: 'core', trailMode: 'energy' }
  }
}

/** Renders projectile preview tools: shared canvas sizing plus the seed. */
export function ProjectilePreviewTools({ parameters, onChange, onResize }: Omit<ProjectileControlsProps, 'category'>) {
  const { t } = useI18n()
  return (
    <GeneratorPreviewTools
      canvasSize={{ width: parameters.canvasWidth, height: parameters.canvasHeight }}
      onResize={onResize}
      seedValue={parameters.seed}
      onSeedChange={(seed) => onChange({ ...parameters, seed })}
      minimumSize={MIN_CANVAS_SIZE}
      maximumSize={MAX_CANVAS_SIZE}
      seedLabel={t('projectile.controls.randomSeed.label')}
      seedDescription={t('projectile.controls.randomSeed.description')}
      seedRandomizeLabel={t('projectile.seed.randomize')}
    />
  )
}

/** One compact on/off field with the shared toggle-track markup. */
function ToggleControl({
  label,
  description,
  checked,
  onChange,
}: {
  readonly label: string
  readonly description: string
  readonly checked: boolean
  readonly onChange: (checked: boolean) => void
}) {
  const hintId = useId()
  return (
    <div className="parameter-field">
      <div className="field-copy">
        <span className="field-title">
          <span className="field-label">{label}</span>
          <InfoHint label={label} description={description} hintId={hintId} />
        </span>
      </div>
      <label className="toggle-field" aria-label={label}>
        <input
          type="checkbox"
          aria-label={label}
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span aria-hidden="true" />
      </label>
    </div>
  )
}

/** Edits one ordered palette with stable row identity and alpha support. */
function PaletteBandEditor({
  title,
  bandLabel,
  removeLabel,
  addLabel,
  alphaLabel,
  palette,
  minimum,
  maximum,
  onChange,
}: {
  readonly title: string
  readonly bandLabel: (index: number) => string
  readonly removeLabel: (index: number) => string
  readonly addLabel: string
  readonly alphaLabel: string
  readonly palette: readonly RgbColor[]
  readonly minimum: number
  readonly maximum: number
  readonly onChange: (palette: readonly RgbColor[]) => void
}) {
  const { t } = useI18n()
  const updateColor = (index: number, value: string) => onChange(
    palette.map((color, colorIndex) => (colorIndex === index ? { ...hexToRgb(value), a: color.a } : color)),
  )
  const updateAlpha = (index: number, value: number) => onChange(
    palette.map((color, colorIndex) => (colorIndex === index ? { ...color, a: value } : color)),
  )
  const removeColor = (index: number) => onChange(palette.filter((_, colorIndex) => colorIndex !== index))
  const addColor = () => {
    const last = palette[palette.length - 1]
    const previous = palette[Math.max(0, palette.length - 2)]
    onChange([...palette, {
      r: Math.round((last.r + previous.r) / 2),
      g: Math.round((last.g + previous.g) / 2),
      b: Math.round((last.b + previous.b) / 2),
      a: Math.round((last.a + previous.a) / 2),
    }])
  }
  return (
    <div className="palette-editor">
      <p className="panel-note">{title}</p>
      <div className="palette-list">
        {palette.map((color, index) => (
          // Palette bands are an ordered list that is never reordered, so the
          // positional index is a stable identity; a color-derived key would
          // remount the row on every change and interrupt picker/drag input.
          <div className="palette-row" key={index}>
            <span className="palette-order">{String(index + 1).padStart(2, '0')}</span>
            <input
              aria-label={bandLabel(index)}
              type="color"
              value={rgbaToHex(color).slice(0, 7)}
              onChange={(event) => updateColor(index, event.target.value)}
            />
            <label className="palette-alpha">
              <span>{alphaLabel}</span>
              <input
                aria-label={alphaLabel}
                type="range"
                min={0}
                max={255}
                value={color.a}
                onChange={(event) => updateAlpha(index, Number(event.target.value))}
              />
              <code>{color.a}</code>
            </label>
            <code>{rgbaToHex(color).toUpperCase()}</code>
            <button
              className="remove-button"
              type="button"
              disabled={palette.length <= minimum}
              aria-label={removeLabel(index)}
              onClick={() => removeColor(index)}
            >
              {t('projectile.palette.remove')}
            </button>
          </div>
        ))}
      </div>
      <button
        className="secondary-button"
        type="button"
        disabled={palette.length >= maximum}
        onClick={addColor}
      >
        {addLabel}
      </button>
    </div>
  )
}
