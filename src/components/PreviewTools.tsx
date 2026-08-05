import { useEffect, useId, useState } from 'react'
import { useI18n } from '../i18n/I18nProvider'
import type { FrameSize } from '../shared/pixel/frame'
import { InfoHint } from './controls'

/** Stable canvas preset identifiers used as select values; labels come from i18n. */
const CANVAS_PRESETS: readonly { readonly id: string; readonly size: FrameSize }[] = [
  { id: 'square32', size: { width: 32, height: 32 } },
  { id: 'square48', size: { width: 48, height: 48 } },
  { id: 'square64', size: { width: 64, height: 64 } },
  { id: 'square96', size: { width: 96, height: 96 } },
  { id: 'square128', size: { width: 128, height: 128 } },
  { id: 'square192', size: { width: 192, height: 192 } },
  { id: 'square256', size: { width: 256, height: 256 } },
  { id: 'horizontal64x32', size: { width: 64, height: 32 } },
  { id: 'horizontal128x64', size: { width: 128, height: 64 } },
  { id: 'horizontal256x128', size: { width: 256, height: 128 } },
  { id: 'custom', size: { width: 0, height: 0 } },
]

interface GeneratorPreviewToolsProps {
  readonly canvasSize: Readonly<{ readonly width: number; readonly height: number }>
  readonly onResize?: (nextSize: FrameSize, scaleEffect: boolean) => void
  readonly seedValue: number
  readonly onSeedChange: (seed: number) => void
  /** Minimum frame edge in pixels; defaults to the shared 16-px floor. */
  readonly minimumSize?: number
  /** Maximum frame edge in pixels; defaults to the shared 512-px ceiling. */
  readonly maximumSize?: number
  readonly seedLabel: string
  readonly seedDescription?: string
  readonly seedRandomizeLabel: string
}

/**
 * Shared preview tools used by every generator: canvas presets, proportional
 * scaling toggle, custom dimensions with validation, and the random seed.
 */
export function GeneratorPreviewTools({
  canvasSize,
  onResize,
  seedValue,
  onSeedChange,
  minimumSize = 16,
  maximumSize = 512,
  seedLabel,
  seedDescription,
  seedRandomizeLabel,
}: GeneratorPreviewToolsProps) {
  return (
    <div className="preview-tools">
      <CanvasSizeControl
        canvasSize={canvasSize}
        onResize={onResize}
        minimumSize={minimumSize}
        maximumSize={maximumSize}
      />
      <SeedControl
        value={seedValue}
        onChange={onSeedChange}
        label={seedLabel}
        description={seedDescription}
        randomizeLabel={seedRandomizeLabel}
      />
    </div>
  )
}

function CanvasSizeControl({
  canvasSize,
  onResize,
  minimumSize,
  maximumSize,
}: {
  readonly canvasSize: Readonly<{ readonly width: number; readonly height: number }>
  readonly onResize?: (nextSize: FrameSize, scaleEffect: boolean) => void
  readonly minimumSize: number
  readonly maximumSize: number
}) {
  const { t } = useI18n()
  const [selectedPreset, setSelectedPreset] = useState(CANVAS_PRESETS[4].id)
  const [draftWidth, setDraftWidth] = useState(String(canvasSize.width))
  const [draftHeight, setDraftHeight] = useState(String(canvasSize.height))
  const [scaleEffect, setScaleEffect] = useState(true)

  const selectedSize = CANVAS_PRESETS.find((option) => option.id === selectedPreset)?.size
  const isCustom = selectedSize?.width === 0 || selectedSize?.height === 0

  useEffect(() => {
    const preset = CANVAS_PRESETS.find(
      (option) => option.size.width === canvasSize.width && option.size.height === canvasSize.height,
    )
    const nextPreset = preset ? preset.id : 'custom'
    setSelectedPreset(nextPreset)
    setDraftWidth(String(canvasSize.width))
    setDraftHeight(String(canvasSize.height))
  }, [canvasSize.width, canvasSize.height])

  const presetLabel = (preset: { readonly id: string; readonly size: FrameSize }): string => {
    if (preset.id === 'custom') {
      return t('previewTools.canvas.presetCustom')
    }
    const { width, height } = preset.size
    return width === height
      ? t('previewTools.canvas.presetSquare', { width, height })
      : t('previewTools.canvas.presetHorizontal', { width, height })
  }

  const parseCanvasValue = (raw: string): number | undefined => {
    const value = Number(raw)
    if (!Number.isInteger(value) || Number.isNaN(value)) {
      return undefined
    }
    return value
  }

  const isValidCanvasValue = (value: number | undefined) => (
    value !== undefined && value >= minimumSize && value <= maximumSize
  )

  const handlePreset = (id: string) => {
    setSelectedPreset(id)
    const preset = CANVAS_PRESETS.find((option) => option.id === id)
    if (!preset || preset.size.width === 0 || preset.size.height === 0) {
      return
    }
    setDraftWidth(String(preset.size.width))
    setDraftHeight(String(preset.size.height))
    onResize?.(preset.size, scaleEffect)
  }

  const applyCustom = () => {
    const width = parseCanvasValue(draftWidth)
    const height = parseCanvasValue(draftHeight)
    if (!isValidCanvasValue(width) || !isValidCanvasValue(height)) {
      return
    }
    onResize?.({ width: width!, height: height! }, scaleEffect)
  }

  const widthValid = isValidCanvasValue(parseCanvasValue(draftWidth))
  const heightValid = isValidCanvasValue(parseCanvasValue(draftHeight))

  return (
    <div className="canvas-size-control">
      <div className="canvas-size-heading">
        <div className="canvas-size-title">
          <span>{t('previewTools.canvas.size')}</span>
          <strong>{canvasSize.width} × {canvasSize.height}</strong>
        </div>
        <label className="scale-toggle">
          <input
            aria-label={t('previewTools.canvas.resizeProportionally')}
            type="checkbox"
            checked={scaleEffect}
            onChange={(event) => setScaleEffect(event.target.checked)}
          />
          <span className="toggle-track" aria-hidden="true"><span /></span>
          <span>{t('previewTools.canvas.scaleEffect')}</span>
        </label>
      </div>

      <div className="canvas-preset-row">
        <label htmlFor="canvas-preset">{t('previewTools.canvas.preset')}</label>
        <select
          id="canvas-preset"
          aria-label={t('previewTools.canvas.presetLabel')}
          value={selectedPreset}
          onChange={(event) => handlePreset(event.target.value)}
        >
          {CANVAS_PRESETS.map((preset) => <option key={preset.id} value={preset.id}>{presetLabel(preset)}</option>)}
        </select>
      </div>

      {isCustom ? (
        <div className="canvas-custom-row">
          <div className="canvas-dimension-inputs">
            <label>
              <span>W</span>
              <input
                aria-label={t('previewTools.canvas.customWidth')}
                type="number"
                min={minimumSize}
                max={maximumSize}
                step={1}
                value={draftWidth}
                onChange={(event) => {
                  setDraftWidth(event.target.value)
                }}
              />
            </label>
            <span className="dimension-separator">×</span>
            <label>
              <span>H</span>
              <input
                aria-label={t('previewTools.canvas.customHeight')}
                type="number"
                min={minimumSize}
                max={maximumSize}
                step={1}
                value={draftHeight}
                onChange={(event) => {
                  setDraftHeight(event.target.value)
                }}
              />
            </label>
          </div>
          <button
            type="button"
            className="secondary-button"
            disabled={!widthValid || !heightValid}
            onClick={applyCustom}
          >
            {t('previewTools.canvas.apply')}
          </button>
          {!widthValid || !heightValid ? (
            <small className="canvas-size-error">{t('previewTools.canvas.sizeError')}</small>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function SeedControl({
  value,
  onChange,
  label,
  description,
  randomizeLabel,
}: {
  readonly value: number
  readonly onChange: (seed: number) => void
  readonly label: string
  readonly description?: string
  readonly randomizeLabel: string
}) {
  const seedId = useId()
  const hintId = useId()
  const randomize = () => {
    const nextSeed = crypto.getRandomValues(new Uint32Array(1))[0]
    onChange(nextSeed)
  }

  return (
    <div className="preview-seed-control">
      <span className="field-title">
        <label htmlFor={seedId}>{label}</label>
        {description ? (
          <InfoHint label={label} description={description} hintId={hintId} />
        ) : null}
      </span>
      <div className="seed-inputs">
        <input
          id={seedId}
          type="number"
          min="0"
          max="4294967295"
          step="1"
          value={value}
          onChange={(event) => onChange(clampSeed(Number(event.target.value)))}
        />
        <button className="secondary-button" type="button" onClick={randomize}>{randomizeLabel}</button>
      </div>
    </div>
  )
}

/** Normalizes a typed seed into the supported unsigned 32-bit range. */
function clampSeed(value: number): number {
  if (!Number.isFinite(value)) {
    return 0
  }
  return Math.min(0xffffffff, Math.max(0, Math.round(value)))
}
