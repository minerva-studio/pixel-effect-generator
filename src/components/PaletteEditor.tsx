import { hexToRgb, rgbaToHex, type RgbColor } from '../shared/pixel/color'
import { useI18n } from '../i18n/I18nProvider'
import { PaletteLibraryPicker } from './PaletteLibraryPicker'

export interface PaletteEditorProps {
  readonly palette: readonly RgbColor[]
  readonly onChange: (palette: readonly RgbColor[]) => void
  readonly minimum: number
  readonly maximum: number
  readonly opaque?: boolean
  readonly title?: string
  readonly guide?: readonly [string, string]
  readonly bandLabel: (index: number) => string
  readonly fit?: (palette: readonly RgbColor[], length: number) => readonly RgbColor[]
  readonly insert?: (palette: readonly RgbColor[]) => readonly RgbColor[]
}

/** Edits one ordered palette with consistent add/remove and alpha controls. */
export function PaletteEditor({ palette, onChange, minimum, maximum, opaque = false, title, guide, bandLabel, fit, insert }: PaletteEditorProps) {
  const { t } = useI18n()
  const updateColor = (index: number, value: string) => onChange(
    palette.map((color, colorIndex) => colorIndex === index ? { ...hexToRgb(value), a: color.a } : color),
  )
  const updateAlpha = (index: number, value: number) => onChange(
    palette.map((color, colorIndex) => colorIndex === index ? { ...color, a: value } : color),
  )
  const addColor = () => {
    const last = palette[palette.length - 1]
    const previous = palette[Math.max(0, palette.length - 2)]
    const midpoint = {
      r: Math.round((last.r + previous.r) / 2),
      g: Math.round((last.g + previous.g) / 2),
      b: Math.round((last.b + previous.b) / 2),
      a: Math.round((last.a + previous.a) / 2),
    }
    const next = insert ? insert(palette) : [...palette, midpoint]
    onChange(next)
  }
  return (
    <div className="palette-editor">
      {title ? <p className="panel-note">{title}</p> : null}
      <PaletteLibraryPicker palette={palette} onChange={(next) => onChange(fit ? fit(next, palette.length) : next)} minimum={minimum} maximum={maximum} opaque={opaque} />
      {guide ? <div className="palette-guide"><span>{guide[0]}</span><span aria-hidden="true">→</span><span>{guide[1]}</span></div> : null}
      <div className="palette-list">
        {palette.map((color, index) => (
          <div className="palette-row" key={index}>
            <span className="palette-order">{String(index + 1).padStart(2, '0')}</span>
            <input aria-label={bandLabel(index)} type="color" value={rgbaToHex(color).slice(0, 7)} onChange={(event) => updateColor(index, event.target.value)} />
            {!opaque ? <label className="palette-alpha">
              <span>{t('controls.palette.alpha')}</span>
              <input aria-label={t('controls.palette.alpha')} type="range" min={0} max={255} value={color.a} onChange={(event) => updateAlpha(index, Number(event.target.value))} />
              <code>{color.a}</code>
            </label> : null}
            <code>{rgbaToHex(color).toUpperCase()}</code>
            <button className="remove-button" type="button" disabled={palette.length <= minimum} aria-label={t('controls.palette.removeBand', { index: index + 1 })} onClick={() => onChange(palette.filter((_, colorIndex) => colorIndex !== index))}>
              {t('controls.palette.remove')}
            </button>
          </div>
        ))}
      </div>
      <button className="secondary-button" type="button" disabled={palette.length >= maximum} onClick={addColor}>{t('controls.palette.add')}</button>
    </div>
  )
}
