import { memo, useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { drawFrame } from '../../components/export'
import { NumberControl, SelectControl } from '../../components/controls'
import { useI18n } from '../../i18n/I18nProvider'
import type { MessageKey } from '../../i18n/messages'
import { hexToRgb, rgbToHex, type RgbColor } from '../../shared/pixel/color'
import type { PixelFrame } from '../../shared/pixel/frame'
import {
  MAX_FRAGMENT_SIZE,
  MAX_SHOCKWAVE_THICKNESS,
} from './constants'
import type {
  SharedCoreParameters,
  SharedFragmentParameters,
  SharedFrameLimits,
  SharedShockwaveParameters,
  SharedTongueParameters,
} from './types'

/** Family-bound translation helper used by shared effect sections. */
export type FamilyTranslate = (suffix: string, params?: Readonly<Record<string, string | number>>) => string

interface EffectSectionProps {
  readonly family: 'explosion' | 'energyBloom'
  readonly t: FamilyTranslate
  readonly limits: SharedFrameLimits
  readonly shapeCount: number
  readonly values: FamilyEffectValues
  readonly onChange: (values: FamilyEffectValues) => void
}

/** All four toggleable effect layers as one shared value group. */
export interface FamilyEffectValues {
  readonly core: SharedCoreParameters
  readonly shockwave: SharedShockwaveParameters
  readonly tongues: SharedTongueParameters
  readonly fragments: SharedFragmentParameters
}

/**
 * Renders the shared Effects tab: every feature has an explicit toggle;
 * every section starts collapsed to name, status, and a short description, and
 * expanding one reveals its parameters while keeping the switch independent.
 */
export function EffectControls({ family, t, limits, shapeCount, values, onChange }: EffectSectionProps) {
  return (
    <div className="control-list effect-sections">
      <CoreSection family={family} t={t} limits={limits} core={values.core} onChange={(core) => onChange({ ...values, core })} />
      <ShockwaveSection family={family} t={t} limits={limits} shapeCount={shapeCount} shockwave={values.shockwave} onChange={(shockwave) => onChange({ ...values, shockwave })} />
      <TonguesSection family={family} t={t} limits={limits} shapeCount={shapeCount} tongues={values.tongues} onChange={(tongues) => onChange({ ...values, tongues })} />
      <FragmentsSection family={family} t={t} limits={limits} fragments={values.fragments} onChange={(fragments) => onChange({ ...values, fragments })} />
    </div>
  )
}

function CoreSection({
  family, t, limits, core, onChange,
}: { readonly family: string; readonly t: FamilyTranslate; readonly limits: SharedFrameLimits; readonly core: SharedCoreParameters; readonly onChange: (core: SharedCoreParameters) => void }) {
  const label = t(`${family}.controls.core.label`)
  return (
    <FeatureSection
      label={label}
      description={t(`${family}.controls.core.description`)}
      enabled={core.enabled}
      onChangeEnabled={(enabled) => onChange({ ...core, enabled })}
      status={core.enabled ? t(`${family}.effects.enabled`) : t(`${family}.effects.disabled`)}
    >
      <NumberControl label={t(`${family}.controls.coreRadius.label`)} description={t(`${family}.controls.coreRadius.description`)} value={core.radius} minimum={0} maximum={limits.maxRadius} unit="px" onChange={(radius) => onChange({ ...core, radius })} />
      <NumberControl label={t(`${family}.controls.coreDuration.label`)} description={t(`${family}.controls.coreDuration.description`)} value={core.duration} minimum={0.1} maximum={0.9} step={0.01} scale={100} unit="%" onChange={(duration) => onChange({ ...core, duration })} />
    </FeatureSection>
  )
}

function ShockwaveSection({
  family, t, limits, shapeCount, shockwave, onChange,
}: { readonly family: string; readonly t: FamilyTranslate; readonly limits: SharedFrameLimits; readonly shapeCount: number; readonly shockwave: SharedShockwaveParameters; readonly onChange: (shockwave: SharedShockwaveParameters) => void }) {
  const label = t(`${family}.controls.shockwave.label`)
  const enabled = shockwave.mode !== 'none'
  return (
    <FeatureSection
      label={label}
      description={t(`${family}.controls.shockwave.description`)}
      enabled={enabled}
      onChangeEnabled={(nextEnabled) => onChange({ ...shockwave, mode: nextEnabled ? (shockwave.mode === 'none' ? 'multiRing' : shockwave.mode) : 'none' })}
      status={enabled ? t(`${family}.effects.enabled`) : t(`${family}.effects.disabled`)}
    >
      <ShockwaveControls family={family} t={t} shockwave={shockwave} onChange={onChange} />
    </FeatureSection>
  )
}

/** Renders the shockwave parameter fields, exposed for focused control tests. */
export function ShockwaveControls({
  family, t, shockwave, onChange,
}: { readonly family: string; readonly t: FamilyTranslate; readonly shockwave: SharedShockwaveParameters; readonly onChange: (shockwave: SharedShockwaveParameters) => void }) {
  return (
    <>
      <SelectControl label={t(`${family}.controls.shockwaveMode.label`)} description={t(`${family}.controls.shockwaveMode.description`)} value={shockwave.mode} options={[
        { value: 'none', label: t(`${family}.options.shockwaveNone`) },
        { value: 'ring', label: t(`${family}.options.shockwaveRing`) },
        { value: 'multiRing', label: t(`${family}.options.shockwaveMultiRing`) },
      ]} onChange={(mode) => onChange({ ...shockwave, mode })} />
      <SelectControl label={t(`${family}.controls.shockwaveColorMode.label`)} description={t(`${family}.controls.shockwaveColorMode.description`)} value={shockwave.colorMode} options={[
        { value: 'flat', label: t(`${family}.options.shockwaveColorFlat`) },
        { value: 'gradient', label: t(`${family}.options.shockwaveColorGradient`) },
      ]} onChange={(colorMode) => onChange({ ...shockwave, colorMode })} />
      <NumberControl label={t(`${family}.controls.shockwaveThickness.label`)} description={t(`${family}.controls.shockwaveThickness.description`)} value={shockwave.thickness} minimum={1} maximum={MAX_SHOCKWAVE_THICKNESS} unit="px" onChange={(thickness) => onChange({ ...shockwave, thickness })} />
      <NumberControl label={t(`${family}.controls.shockwaveStartRadius.label`)} description={t(`${family}.controls.shockwaveStartRadius.description`)} value={shockwave.startRadiusScale} minimum={0} maximum={2} step={0.01} scale={100} unit="%" onChange={(startRadiusScale) => onChange({ ...shockwave, startRadiusScale: Math.min(startRadiusScale, shockwave.endRadiusScale) })} />
      <NumberControl label={t(`${family}.controls.shockwaveEndRadius.label`)} description={t(`${family}.controls.shockwaveEndRadius.description`)} value={shockwave.endRadiusScale} minimum={0.25} maximum={2.5} step={0.01} scale={100} unit="%" onChange={(endRadiusScale) => onChange({ ...shockwave, endRadiusScale: Math.max(endRadiusScale, shockwave.startRadiusScale) })} />
      <NumberControl label={t(`${family}.controls.shockwaveStartTime.label`)} description={t(`${family}.controls.shockwaveStartTime.description`)} value={shockwave.startTime} minimum={0} maximum={0.8} step={0.01} scale={100} unit="%" onChange={(startTime) => onChange({ ...shockwave, startTime })} />
      <NumberControl label={t(`${family}.controls.shockwaveDuration.label`)} description={t(`${family}.controls.shockwaveDuration.description`)} value={shockwave.duration} minimum={0.1} maximum={1} step={0.01} scale={100} unit="%" onChange={(duration) => onChange({ ...shockwave, duration })} />
      {shockwave.mode === 'multiRing' ? (
        <>
          <NumberControl label={t(`${family}.controls.shockwaveRingCount.label`)} description={t(`${family}.controls.shockwaveRingCount.description`)} value={shockwave.ringCount} minimum={1} maximum={4} onChange={(ringCount) => onChange({ ...shockwave, ringCount })} />
          <NumberControl label={t(`${family}.controls.shockwaveRingSpacing.label`)} description={t(`${family}.controls.shockwaveRingSpacing.description`)} value={shockwave.ringSpacing} minimum={0} maximum={1} step={0.01} scale={100} unit="%" onChange={(ringSpacing) => onChange({ ...shockwave, ringSpacing })} />
        </>
      ) : null}
      {shockwave.mode !== 'none' ? (
        <>
          <NumberControl label={t(`${family}.controls.shockwaveSquash.label`)} description={t(`${family}.controls.shockwaveSquash.description`)} value={shockwave.squash} minimum={0} maximum={1} step={0.01} scale={100} unit="%" onChange={(squash) => onChange({ ...shockwave, squash })} />
          <NumberControl label={t(`${family}.controls.shockwaveSquashAngle.label`)} description={t(`${family}.controls.shockwaveSquashAngle.description`)} value={shockwave.squashAngle} minimum={0} maximum={359} unit="°" onChange={(squashAngle) => onChange({ ...shockwave, squashAngle })} />
        </>
      ) : null}
    </>
  )
}

function TonguesSection({
  family, t, limits, shapeCount, tongues, onChange,
}: { readonly family: string; readonly t: FamilyTranslate; readonly limits: SharedFrameLimits; readonly shapeCount: number; readonly tongues: SharedTongueParameters; readonly onChange: (tongues: SharedTongueParameters) => void }) {
  const label = t(`${family}.controls.tongues.label`)
  return (
    <FeatureSection
      label={label}
      description={t(`${family}.controls.tongues.description`)}
      enabled={tongues.enabled}
      onChangeEnabled={(enabled) => onChange({ ...tongues, enabled })}
      status={tongues.enabled ? t(`${family}.effects.enabled`) : t(`${family}.effects.disabled`)}
    >
      <NumberControl label={t(`${family}.controls.tongueCount.label`)} description={t(`${family}.controls.tongueCount.description`)} value={tongues.count} minimum={1} maximum={shapeCount} onChange={(count) => onChange({ ...tongues, count })} />
      <NumberControl label={t(`${family}.controls.tongueLength.label`)} description={t(`${family}.controls.tongueLength.description`)} value={tongues.length} minimum={0} maximum={limits.maxTongueLength} unit="px" onChange={(length) => onChange({ ...tongues, length })} />
      <NumberControl label={t(`${family}.controls.tongueWidth.label`)} description={t(`${family}.controls.tongueWidth.description`)} value={tongues.width} minimum={1} maximum={limits.maxTongueWidth} unit="px" onChange={(width) => onChange({ ...tongues, width })} />
      <NumberControl label={t(`${family}.controls.tongueCurvature.label`)} description={t(`${family}.controls.tongueCurvature.description`)} value={tongues.curvature} minimum={0} maximum={1} step={0.01} scale={100} unit="%" onChange={(curvature) => onChange({ ...tongues, curvature })} />
      <NumberControl label={t(`${family}.controls.tongueVariation.label`)} description={t(`${family}.controls.tongueVariation.description`)} value={tongues.variation} minimum={0} maximum={1} step={0.01} scale={100} unit="%" onChange={(variation) => onChange({ ...tongues, variation })} />
    </FeatureSection>
  )
}

function FragmentsSection({
  family, t, limits, fragments, onChange,
}: { readonly family: string; readonly t: FamilyTranslate; readonly limits: SharedFrameLimits; readonly fragments: SharedFragmentParameters; readonly onChange: (fragments: SharedFragmentParameters) => void }) {
  const label = t(`${family}.controls.fragments.label`)
  return (
    <FeatureSection
      label={label}
      description={t(`${family}.controls.fragments.description`)}
      enabled={fragments.enabled}
      onChangeEnabled={(enabled) => onChange({ ...fragments, enabled })}
      status={fragments.enabled ? t(`${family}.effects.enabled`) : t(`${family}.effects.disabled`)}
    >
      <NumberControl label={t(`${family}.controls.fragmentCount.label`)} description={t(`${family}.controls.fragmentCount.description`)} value={fragments.count} minimum={1} maximum={72} onChange={(count) => onChange({ ...fragments, count })} />
      <NumberControl label={t(`${family}.controls.fragmentMinSize.label`)} description={t(`${family}.controls.fragmentMinSize.description`)} value={fragments.minSize} minimum={1} maximum={MAX_FRAGMENT_SIZE} unit="px" onChange={(minSize) => onChange({ ...fragments, minSize: Math.min(minSize, fragments.maxSize) })} />
      <NumberControl label={t(`${family}.controls.fragmentMaxSize.label`)} description={t(`${family}.controls.fragmentMaxSize.description`)} value={fragments.maxSize} minimum={1} maximum={MAX_FRAGMENT_SIZE} unit="px" onChange={(maxSize) => onChange({ ...fragments, maxSize: Math.max(maxSize, fragments.minSize) })} />
      <NumberControl label={t(`${family}.controls.fragmentTravelDistance.label`)} description={t(`${family}.controls.fragmentTravelDistance.description`)} value={fragments.travelDistance} minimum={0} maximum={limits.maxFragmentDistance} unit="px" onChange={(travelDistance) => onChange({ ...fragments, travelDistance })} />
      <NumberControl label={t(`${family}.controls.fragmentTangentialDrift.label`)} description={t(`${family}.controls.fragmentTangentialDrift.description`)} value={fragments.tangentialDrift} minimum={0} maximum={limits.maxTangentialDrift} unit="px" onChange={(tangentialDrift) => onChange({ ...fragments, tangentialDrift })} />
      <NumberControl label={t(`${family}.controls.fragmentLifetime.label`)} description={t(`${family}.controls.fragmentLifetime.description`)} value={fragments.lifetime} minimum={0.1} maximum={1} step={0.01} scale={100} unit="%" onChange={(lifetime) => onChange({ ...fragments, lifetime })} />
    </FeatureSection>
  )
}

/**
 * One manually collapsible feature with an explicit compact switch. The
 * heading toggles expansion; the switch only changes the enable state, and
 * parameters appear whenever the section is expanded, even while disabled.
 */
function FeatureSection({
  label,
  description,
  enabled,
  status,
  onChangeEnabled,
  children,
}: {
  readonly label: string
  readonly description: string
  readonly enabled: boolean
  readonly status: string
  readonly onChangeEnabled: (enabled: boolean) => void
  readonly children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const descriptionId = useId()
  return (
    <section className={`effect-section ${enabled ? 'enabled' : ''} ${open ? 'open' : ''}`}>
      <div className="effect-section-heading">
        <button
          type="button"
          className="effect-section-toggle"
          aria-expanded={open}
          aria-label={label}
          onClick={() => setOpen((current) => !current)}
        >
          <span className="effect-section-copy">
            <span className="field-title">{label}</span>
            <small id={descriptionId}>{description}</small>
            <span className="effect-section-status">{status}</span>
          </span>
          <span className="effect-section-chevron" aria-hidden="true" />
        </button>
        <label className="toggle-field" aria-label={label}>
          <input
            type="checkbox"
            aria-label={label}
            aria-describedby={descriptionId}
            checked={enabled}
            onChange={(event) => onChangeEnabled(event.target.checked)}
          />
          <span aria-hidden="true" />
        </label>
      </div>
      {open ? <div className="effect-section-content">{children}</div> : null}
    </section>
  )
}

/** One selectable shape thumbnail card backed by cached looping frames. */
interface ShapeCardProps {
  readonly value: string
  readonly labelKey: string
  readonly descriptionKey: string
  readonly selected: boolean
  readonly frames: readonly PixelFrame[]
  readonly onSelect: (value: string) => void
}

const ShapeCard = memo(function ShapeCard({ value, labelKey, descriptionKey, selected, frames, onSelect }: ShapeCardProps) {
  const { t } = useI18n()
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const frameIndexRef = useRef(0)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined
    drawFrame(canvas, frames[0])
    const interval = window.setInterval(() => {
      frameIndexRef.current = (frameIndexRef.current + 1) % frames.length
      drawFrame(canvas, frames[frameIndexRef.current])
    }, 150)
    return () => window.clearInterval(interval)
  }, [frames])
  return (
    <button
      className={`shape-card ${selected ? 'active' : ''}`}
      type="button"
      aria-pressed={selected}
      onClick={() => onSelect(value)}
    >
      <canvas ref={canvasRef} aria-hidden="true" />
      <span className="shape-card-label">{t(labelKey as MessageKey)}</span>
      <small className="shape-card-description">{t(descriptionKey as MessageKey)}</small>
    </button>
  )
})

/** Cache of rendered thumbnail frame sets; independent of live parameters. */
const shapeThumbnailCache = new Map<string, readonly PixelFrame[]>()

/** Returns one cached thumbnail frame set per family and shape value. */
function cachedShapeFrames<Parameters>(
  familyId: string,
  value: string,
  buildParameters: () => Parameters,
  render: (parameters: Parameters) => readonly PixelFrame[],
): readonly PixelFrame[] {
  const key = `${familyId}:${value}`
  const cached = shapeThumbnailCache.get(key)
  if (cached) return cached
  const frames = render(buildParameters())
  shapeThumbnailCache.set(key, frames)
  return frames
}

export interface ShapeCardOption<Parameters> {
  readonly value: string
  readonly labelKey: string
  readonly descriptionKey: string
  readonly buildParameters: () => Parameters
}

interface ShapeCardGridProps<Parameters> {
  readonly familyId: string
  readonly label: string
  readonly options: readonly ShapeCardOption<Parameters>[]
  readonly selected: string
  readonly render: (parameters: Parameters) => readonly PixelFrame[]
  readonly onSelect: (value: string) => void
}

/**
 * Looping fixed-seed thumbnail cards for the active family's body shapes.
 * Frames are cached per family and shape, so changing live parameters never
 * re-renders the card canvases.
 */
export function ShapeCardGrid<Parameters>({
  familyId,
  label,
  options,
  selected,
  render,
  onSelect,
}: ShapeCardGridProps<Parameters>) {
  const handleSelect = useCallback((value: string) => onSelect(value), [onSelect])
  return (
    <div className="shape-card-grid" role="group" aria-label={label}>
      {options.map((option) => (
        <ShapeCard
          key={option.value}
          value={option.value}
          labelKey={option.labelKey}
          descriptionKey={option.descriptionKey}
          selected={option.value === selected}
          frames={cachedShapeFrames(familyId, option.value, option.buildParameters, render)}
          onSelect={handleSelect}
        />
      ))}
    </div>
  )
}

/** Renders the ordered hot-core-to-edge palette editor for one family. */
export function FamilyPaletteEditor({
  family,
  t,
  palette,
  onChange,
}: {
  readonly family: string
  readonly t: FamilyTranslate
  readonly palette: readonly RgbColor[]
  readonly onChange: (palette: readonly RgbColor[]) => void
}) {
  const updateColor = (index: number, value: string) => onChange(
    palette.map((color, colorIndex) => (colorIndex === index ? hexToRgb(value) : color)),
  )
  const removeColor = (index: number) => onChange(palette.filter((_, colorIndex) => colorIndex !== index))
  const addColor = () => {
    const last = palette[palette.length - 1]
    const previous = palette[Math.max(0, palette.length - 2)]
    onChange([...palette, {
      r: Math.round((last.r + previous.r) / 2),
      g: Math.round((last.g + previous.g) / 2),
      b: Math.round((last.b + previous.b) / 2),
    }])
  }
  return (
    <div className="palette-editor">
      <div className="palette-guide">
        <span>{t(`${family}.palette.hotCore`)}</span>
        <span>{t(`${family}.palette.outerEdge`)}</span>
      </div>
      <div className="palette-list">
        {palette.map((color, index) => (
          <div className="palette-row" key={`${index}-${rgbToHex(color)}`}>
            <span className="palette-order">{String(index + 1).padStart(2, '0')}</span>
            <input
              aria-label={t(`${family}.palette.band`, { index: index + 1 })}
              type="color"
              value={rgbToHex(color)}
              onChange={(event) => updateColor(index, event.target.value)}
            />
            <code>{rgbToHex(color).toUpperCase()}</code>
            <button
              className="remove-button"
              type="button"
              disabled={palette.length <= 2}
              aria-label={t(`${family}.palette.removeBand`, { index: index + 1 })}
              onClick={() => removeColor(index)}
            >
              {t(`${family}.palette.remove`)}
            </button>
          </div>
        ))}
      </div>
      <button
        className="secondary-button"
        type="button"
        disabled={palette.length >= 6}
        onClick={addColor}
      >
        {t(`${family}.palette.addColorBand`)}
      </button>
    </div>
  )
}
