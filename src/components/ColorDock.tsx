import { useState } from 'react'
import { PaletteEditor } from './PaletteEditor'
import type { PaletteSlot } from '../generators/contract'
import { useI18n } from '../i18n/I18nProvider'
import { rgbToHex } from '../shared/pixel/color'

/** Persistent compact access to every editable generator color slot. */
export function ColorDock<Parameters>({ slots, parameters, onParameters }: {
  readonly slots: readonly PaletteSlot<Parameters>[]
  readonly parameters: Parameters
  readonly onParameters: (parameters: Parameters) => void
}) {
  const { t } = useI18n()
  const [expanded, setExpanded] = useState(false)
  const [activeColor, setActiveColor] = useState<{ readonly slotId: string; readonly index: number } | null>(null)
  return <section className={`color-dock ${expanded ? 'expanded' : ''}`} aria-label={t('controls.colorDock')}>
    <div className="color-dock-rows">{slots.map((slot) => {
      const colors = slot.read(parameters)
      return <div className="color-dock-row" key={slot.id}>
        <span className="color-dock-label">{t(slot.labelKey)}</span>
        <div className="color-dock-swatches">{colors.map((color, index) => <button key={index} className="color-dock-swatch" type="button" aria-label={`${t(slot.labelKey)} ${index + 1}`} style={{ backgroundColor: `rgba(${color.r},${color.g},${color.b},${color.a / 255})` }} onClick={() => setActiveColor(activeColor?.slotId === slot.id && activeColor.index === index ? null : { slotId: slot.id, index })} />)}</div>
        {activeColor?.slotId === slot.id && colors[activeColor.index] ? <div className="color-dock-popover">
          <input aria-label={`${t(slot.labelKey)} ${activeColor.index + 1}`} type="color" value={rgbToHex(colors[activeColor.index])} onChange={(event) => onParameters(slot.write(parameters, colors.map((color, index) => index === activeColor.index ? { ...color, ...hexToColor(event.target.value) } : color)))} />
          {!slot.opaque && <label>{t('controls.palette.alpha')}<input type="range" min={0} max={255} value={colors[activeColor.index].a} onChange={(event) => onParameters(slot.write(parameters, colors.map((color, index) => index === activeColor.index ? { ...color, a: Number(event.target.value) } : color)))} /></label>}
        </div> : null}
        <button className="text-button color-dock-edit" type="button" aria-expanded={expanded} onClick={() => { setExpanded(!expanded); setActiveColor(null) }}>{t('controls.editColors')}</button>
      </div>
    })}</div>
    {expanded ? <div className="color-dock-editors">{slots.map((slot) => <PaletteEditor key={slot.id} title={t(slot.labelKey)} palette={slot.read(parameters)} onChange={(colors) => onParameters(slot.write(parameters, colors))} minimum={slot.minimum} maximum={slot.maximum} opaque={slot.opaque} fit={slot.fit} insert={slot.insert} guide={slot.guideKeys?.map((key) => t(key)) as readonly [string, string] | undefined} />)}</div> : null}
  </section>
}

function hexToColor(value: string): { r: number; g: number; b: number } {
  return { r: Number.parseInt(value.slice(1, 3), 16), g: Number.parseInt(value.slice(3, 5), 16), b: Number.parseInt(value.slice(5, 7), 16) }
}
