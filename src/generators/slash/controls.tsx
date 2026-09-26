import { PercentControl, NumberControl, SelectControl, SegmentedControl } from '../../components/controls'
import { createPreviewTools } from '../../components/PreviewTools'
import { PaletteEditor as SharedPaletteEditor } from '../../components/PaletteEditor'
import { useI18n } from '../../i18n/I18nProvider'
import {
  MAX_CANVAS_SIZE,
  MAX_FRAGMENT_SIZE,
  MIN_CANVAS_SIZE,
  frameLimits,
  updateFragmentMaxSize,
  updateFragmentMinSize,
} from './model'
import { insertPaletteColor } from './palette'
import { MAX_SWEEP_DEGREES } from './model'
import type { SlashCategory } from './module'
import type { SlashParameters } from './model'
import type { FrameSize } from '../../shared/pixel/frame'

interface SlashControlsProps {
  readonly category: SlashCategory
  readonly parameters: SlashParameters
  readonly onChange: (parameters: SlashParameters) => void
  readonly onResize?: (nextSize: FrameSize, scaleEffect: boolean) => void
}

/** Renders the active Slash parameter category without owning generator state. */
export function SlashControls({ category, parameters, onChange }: SlashControlsProps) {
  const { t } = useI18n()
  const limits = frameLimits({
    width: parameters.canvasWidth,
    height: parameters.canvasHeight,
  })
  const update = <Key extends keyof SlashParameters>(key: Key, value: SlashParameters[Key]) => {
    const next = { ...parameters, [key]: value }
    if (key === 'radius' && next.thickness > Number(value)) {
      next.thickness = Number(value)
    }
    onChange(next)
  }

  switch (category) {
    case 'shape':
      return (
        <div className="control-list">
          <NumberControl label={t('slash.controls.radius.label')} description={t('slash.controls.radius.description')} value={parameters.radius} minimum={2} maximum={limits.maxRadius} unit="px" onChange={(value) => update('radius', value)} />
          <NumberControl label={t('slash.controls.thickness.label')} description={t('slash.controls.thickness.description')} value={parameters.thickness} minimum={1} maximum={parameters.radius} unit="px" onChange={(value) => update('thickness', value)} />
          <PercentControl label={t('slash.controls.tipLength.label')} description={t('slash.controls.tipLength.description')} value={parameters.tipLength} minimum={0} maximum={1} onChange={(value) => update('tipLength', value)} />
          <NumberControl label={t('slash.controls.startAngle.label')} description={t('slash.controls.startAngle.description')} value={parameters.startAngleDegrees} minimum={-180} maximum={180} unit="°" onChange={(value) => update('startAngleDegrees', value)} />
          <NumberControl label={t('slash.controls.sweepAngle.label')} description={t('slash.controls.sweepAngle.description')} value={parameters.sweepDegrees} minimum={30} maximum={MAX_SWEEP_DEGREES} unit="°" onChange={(value) => update('sweepDegrees', value)} />
          <NumberControl label={t('slash.controls.rotation.label')} description={t('slash.controls.rotation.description')} value={parameters.rotationDegrees} minimum={-180} maximum={180} unit="°" onChange={(value) => update('rotationDegrees', value)} />
          <NumberControl label={t('slash.controls.tilt.label')} description={t('slash.controls.tilt.description')} value={parameters.tiltDegrees} minimum={0} maximum={90} unit="°" onChange={(value) => update('tiltDegrees', value)} />
        </div>
      )
    case 'palette':
      return <SlashPaletteEditor parameters={parameters} onChange={onChange} />
    case 'motion':
      return (
        <div className="control-list">
          <SegmentedControl label={t('slash.controls.direction.label')} description={t('slash.controls.direction.description')} value={parameters.direction} options={[
            { value: 'clockwise', label: t('slash.options.clockwise') },
            { value: 'counterClockwise', label: t('slash.options.counterClockwise') },
          ]} onChange={(value) => update('direction', value)} />
          <PercentControl label={t('slash.controls.sweepSpeed.label')} description={t('slash.controls.sweepSpeed.description')} value={parameters.sweepSpeed} minimum={0} maximum={1} onChange={(value) => update('sweepSpeed', value)} />
          <PercentControl label={t('slash.controls.trailLength.label')} description={t('slash.controls.trailLength.description')} value={parameters.trailLength} minimum={0} maximum={1} onChange={(value) => update('trailLength', value)} />
        </div>
      )
    case 'breakup':
      return (
        <div className="control-list">
          <SelectControl
            label={t('slash.controls.dissolveMode.label')}
            description={t('slash.controls.dissolveMode.description')}
            value={parameters.dissolveMode}
            options={[
              { value: 'ordered', label: t('slash.options.ordered') },
              { value: 'clusteredNoise', label: t('slash.options.clusteredNoise') },
              { value: 'directionalStreaks', label: t('slash.options.directionalStreaks') },
            ]}
            onChange={(value) => update('dissolveMode', value)}
          />
          <SelectControl
            label={t('slash.controls.edgeMode.label')}
            description={t('slash.controls.edgeMode.description')}
            value={parameters.edgeBreakupMode}
            options={[
              { value: 'blockChips', label: t('slash.options.blockChips') },
              { value: 'jaggedContour', label: t('slash.options.jaggedContour') },
              { value: 'slashCuts', label: t('slash.options.slashCuts') },
            ]}
            onChange={(value) => update('edgeBreakupMode', value)}
          />
          <PercentControl label={t('slash.controls.dissolve.label')} description={t('slash.controls.dissolve.description')} value={parameters.dissolveLength} minimum={0} maximum={1} onChange={(value) => update('dissolveLength', value)} />
          <PercentControl label={t('slash.controls.edgeBreakup.label')} description={t('slash.controls.edgeBreakup.description')} value={parameters.edgeBreakup} minimum={0} maximum={1} onChange={(value) => update('edgeBreakup', value)} />
          <PercentControl label={t('slash.controls.breakupDepth.label')} description={t('slash.controls.breakupDepth.description')} value={parameters.edgeDepth} minimum={0.05} maximum={0.5} onChange={(value) => update('edgeDepth', value)} />
        </div>
      )
    case 'fragments':
      return (
        <div className="control-list">
          <SelectControl
            label={t('slash.controls.fragmentMode.label')}
            description={t('slash.controls.fragmentMode.description')}
            value={parameters.fragmentMode}
            options={[
              { value: 'pixelChunks', label: t('slash.options.pixelChunks') },
              { value: 'directionalShards', label: t('slash.options.directionalShards') },
              { value: 'energySparks', label: t('slash.options.energySparks') },
            ]}
            onChange={(value) => update('fragmentMode', value)}
          />
          <PercentControl label={t('slash.controls.amount.label')} description={t('slash.controls.amount.description')} value={parameters.fragmentAmount} minimum={0} maximum={1} onChange={(value) => update('fragmentAmount', value)} />
          <NumberControl label={t('slash.controls.minSize.label')} description={t('slash.controls.minSize.description')} value={parameters.fragmentMinSize} minimum={1} maximum={MAX_FRAGMENT_SIZE} unit="px" onChange={(value) => onChange(updateFragmentMinSize(parameters, value))} />
          <NumberControl label={t('slash.controls.maxSize.label')} description={t('slash.controls.maxSize.description')} value={parameters.fragmentMaxSize} minimum={1} maximum={MAX_FRAGMENT_SIZE} unit="px" onChange={(value) => onChange(updateFragmentMaxSize(parameters, value))} />
          <NumberControl label={t('slash.controls.tangentSpeed.label')} description={t('slash.controls.tangentSpeed.description')} value={parameters.fragmentTangentSpeed} minimum={0} maximum={limits.maxFragmentTangentSpeed} unit="px" onChange={(value) => update('fragmentTangentSpeed', value)} />
          <NumberControl label={t('slash.controls.outwardSpeed.label')} description={t('slash.controls.outwardSpeed.description')} value={parameters.fragmentOutwardSpeed} minimum={0} maximum={limits.maxFragmentOutwardSpeed} unit="px" onChange={(value) => update('fragmentOutwardSpeed', value)} />
          <PercentControl label={t('slash.controls.lifetime.label')} description={t('slash.controls.lifetime.description')} value={parameters.fragmentLifetime} minimum={0.1} maximum={1} onChange={(value) => update('fragmentLifetime', value)} />
        </div>
      )
  }
}

export const SlashPreviewTools = createPreviewTools<SlashParameters>({ keyPrefix: 'slash', minimumSize: MIN_CANVAS_SIZE, maximumSize: MAX_CANVAS_SIZE })

/** Supplies Slash palette direction labels and its stable insertion rule. */
function SlashPaletteEditor({ parameters, onChange }: Omit<SlashControlsProps, 'category'>) {
  const { t } = useI18n()
  return <SharedPaletteEditor palette={parameters.palette} onChange={(palette) => onChange({ ...parameters, palette })}
    minimum={2} maximum={6} guide={[t('slash.palette.innerEdge'), t('slash.palette.outerEdge')]}
    bandLabel={(index) => t('slash.palette.band', { index: index + 1 })}
    insert={insertPaletteColor} />
}
