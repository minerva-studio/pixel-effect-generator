import { useState, type CSSProperties } from 'react'
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
    <div className="color-dock-header">
      <div className="color-dock-rows">{slots.map((slot) => {
        const colors = slot.read(parameters)
        const label = t(slot.labelKey)
        const active = activeColor?.slotId === slot.id ? colors[activeColor.index] : undefined
        return <div className="color-dock-row" key={slot.id}>
          <span className="color-dock-label" title={label}>{label}</span>
          <div className="color-dock-swatches">
            {colors.map((color, index) => <button key={index} className={activeColor?.slotId === slot.id && activeColor.index === index ? 'color-dock-swatch active' : 'color-dock-swatch'} type="button" aria-label={`${label} ${index + 1}`} aria-pressed={activeColor?.slotId === slot.id && activeColor.index === index} style={{ backgroundColor: `rgba(${color.r},${color.g},${color.b},${color.a / 255})` }} onClick={() => onActiveColor(activeColor?.slotId === slot.id && activeColor.index === index ? null : { slotId: slot.id, index })} />)}
            {active && activeColor ? <div className="color-dock-popover" style={{ '--swatch-index': activeColor.index } as CSSProperties}>
              <input aria-label={`${label} ${activeColor.index + 1}`} type="color" value={rgbToHex(active)} onChange={(event) => onParameters(slot.write(parameters, colors.map((color, index) => index === activeColor.index ? { ...color, ...hexToColor(event.target.value) } : color)))} />
              {!slot.opaque && <label><span>{t('controls.palette.alpha')}</span><input type="range" min={0} max={255} value={active.a} onChange={(event) => onParameters(slot.write(parameters, colors.map((color, index) => index === activeColor.index ? { ...color, a: Number(event.target.value) } : color)))} /></label>}
            </div> : null}
          </div>
        </div>
      })}</div>
      <div className="color-dock-actions">
        <button className="color-dock-lock" type="button" aria-pressed={locked} aria-label={t('controls.lockColors')} title={t('controls.lockColorsHint')} onClick={() => onLockedChange(!locked)}>
          <LockIcon locked={locked} />
        </button>
        <button className="panel-action color-dock-edit" type="button" aria-expanded={expanded} onClick={onToggleExpanded}>{t('controls.editColors')}</button>
      </div>
    </div>
    {expanded ? <div className="color-dock-editors">{slots.map((slot) => <PaletteEditor key={slot.id} title={slots.length > 1 ? t(slot.labelKey) : undefined} palette={slot.read(parameters)} onChange={(colors) => onParameters(slot.write(parameters, colors))} minimum={slot.minimum} maximum={slot.maximum} opaque={slot.opaque} fit={slot.fit} insert={slot.insert} guide={slot.guideKeys?.map((key) => t(key)) as readonly [string, string] | undefined} />)}</div> : null}
  </section>
}

/** Small padlock glyph; the shackle opens when colors are not locked. */
function LockIcon({ locked }: { readonly locked: boolean }) {
  return <svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
    <rect x="3" y="7" width="10" height="7" rx="1.5" />
    <path d={locked ? 'M5 7V5a3 3 0 0 1 6 0v2' : 'M5 7V5a3 3 0 0 1 5.8-1'} />
  </svg>
}

function hexToColor(value: string): { r: number; g: number; b: number } {
  return { r: Number.parseInt(value.slice(1, 3), 16), g: Number.parseInt(value.slice(3, 5), 16), b: Number.parseInt(value.slice(5, 7), 16) }
}
