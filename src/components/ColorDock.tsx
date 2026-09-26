import { useState } from 'react'
import { PaletteEditor } from './PaletteEditor'
import type { PaletteSlot } from '../generators/contract'
import { useI18n } from '../i18n/I18nProvider'
import { rgbToHex } from '../shared/pixel/color'

/** Persistent compact access to every editable generator color slot. */
export function ColorDock<Parameters>({ slots, parameters, onParameters, locked, onLockedChange }: {
  readonly slots: readonly PaletteSlot<Parameters>[]
  readonly parameters: Parameters
  readonly onParameters: (parameters: Parameters) => void
  readonly locked: boolean
  readonly onLockedChange: (locked: boolean) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [activeColor, setActiveColor] = useState<{ readonly slotId: string; readonly index: number } | null>(null)
  return <ColorDockView slots={slots} parameters={parameters} onParameters={onParameters} expanded={expanded} activeColor={activeColor} onActiveColor={setActiveColor} onToggleExpanded={() => { setExpanded(!expanded); setActiveColor(null) }} locked={locked} onLockedChange={onLockedChange} />
}

/** @internal Presentational dock view so collapsed and expanded layouts stay directly testable. */
export function ColorDockView<Parameters>({ slots, parameters, onParameters, expanded, activeColor, onActiveColor, onToggleExpanded, locked, onLockedChange }: {
  readonly slots: readonly PaletteSlot<Parameters>[]
  readonly parameters: Parameters
  readonly onParameters: (parameters: Parameters) => void
  readonly expanded: boolean
  readonly activeColor: { readonly slotId: string; readonly index: number } | null
  readonly onActiveColor: (active: { readonly slotId: string; readonly index: number } | null) => void
  readonly onToggleExpanded: () => void
  readonly locked: boolean
  readonly onLockedChange: (locked: boolean) => void
}) {
  const { t } = useI18n()
  const className = ['color-dock', expanded && 'expanded', locked && 'locked'].filter(Boolean).join(' ')
  return <section className={className} aria-label={t('controls.colorDock')}>
    <div className="color-dock-header"><div className="color-dock-rows">{slots.map((slot) => {
      const colors = slot.read(parameters)
      return <div className="color-dock-row" key={slot.id}>
        <span className="color-dock-label">{t(slot.labelKey)}</span>
        <div className="color-dock-swatches">{colors.map((color, index) => <button key={index} className="color-dock-swatch" type="button" aria-label={`${t(slot.labelKey)} ${index + 1}`} style={{ backgroundColor: `rgba(${color.r},${color.g},${color.b},${color.a / 255})` }} onClick={() => onActiveColor(activeColor?.slotId === slot.id && activeColor.index === index ? null : { slotId: slot.id, index })} />)}</div>
        {activeColor?.slotId === slot.id && colors[activeColor.index] ? <div className="color-dock-popover">
          <input aria-label={`${t(slot.labelKey)} ${activeColor.index + 1}`} type="color" value={rgbToHex(colors[activeColor.index])} onChange={(event) => onParameters(slot.write(parameters, colors.map((color, index) => index === activeColor.index ? { ...color, ...hexToColor(event.target.value) } : color)))} />
          {!slot.opaque && <label>{t('controls.palette.alpha')}<input type="range" min={0} max={255} value={colors[activeColor.index].a} onChange={(event) => onParameters(slot.write(parameters, colors.map((color, index) => index === activeColor.index ? { ...color, a: Number(event.target.value) } : color)))} /></label>}
        </div> : null}
      </div>
    })}</div>
    <div className="color-dock-actions">
      <button className="text-button color-dock-lock" type="button" aria-pressed={locked} title={t('controls.lockColorsHint')} onClick={() => onLockedChange(!locked)}>
        <span aria-hidden="true">{locked ? '🔒' : '🔓'}</span> {t('controls.lockColors')}
      </button>
      <button className="text-button color-dock-edit" type="button" aria-expanded={expanded} onClick={onToggleExpanded}>{t('controls.editColors')}</button>
    </div></div>
    {expanded ? <div className="color-dock-editors">{slots.map((slot) => <PaletteEditor key={slot.id} title={slots.length > 1 ? t(slot.labelKey) : undefined} palette={slot.read(parameters)} onChange={(colors) => onParameters(slot.write(parameters, colors))} minimum={slot.minimum} maximum={slot.maximum} opaque={slot.opaque} fit={slot.fit} insert={slot.insert} guide={slot.guideKeys?.map((key) => t(key)) as readonly [string, string] | undefined} />)}</div> : null}
  </section>
}

function hexToColor(value: string): { r: number; g: number; b: number } {
  return { r: Number.parseInt(value.slice(1, 3), 16), g: Number.parseInt(value.slice(3, 5), 16), b: Number.parseInt(value.slice(5, 7), 16) }
}
