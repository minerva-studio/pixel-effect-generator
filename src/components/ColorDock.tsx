import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { PaletteSlot } from '../generators/contract'
import { useI18n } from '../i18n/I18nProvider'
import { rgbaToHex, type RgbColor } from '../shared/pixel/color'
import { PaletteLibraryPicker } from './PaletteLibraryPicker'
import { SegmentedControl } from './controls'
import { insertColor, moveColor, removeColor, setColorAlpha, setColorHex } from './paletteOps'

interface ActiveColor { readonly slotId: string; readonly index: number }

/** Persistent compact access to every editable generator color slot. */
export function ColorDock<Parameters>({ slots, parameters, onParameters, locked, onLockedChange }: {
  readonly slots: readonly PaletteSlot<Parameters>[]
  readonly parameters: Parameters
  readonly onParameters: (parameters: Parameters) => void
  readonly locked: boolean
  readonly onLockedChange: (locked: boolean) => void
}) {
  const rootRef = useRef<HTMLElement>(null)
  const [activeColor, setActiveColor] = useState<ActiveColor | null>(null)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [librarySlotId, setLibrarySlotId] = useState(slots[0]?.id ?? '')

  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setActiveColor(null)
        setLibraryOpen(false)
      }
    }
    const closeEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setActiveColor(null)
        setLibraryOpen(false)
      }
    }
    document.addEventListener('pointerdown', closeOutside)
    document.addEventListener('keydown', closeEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOutside)
      document.removeEventListener('keydown', closeEscape)
    }
  }, [])

  const updateSlot = (slot: PaletteSlot<Parameters>, colors: readonly RgbColor[]) => onParameters(slot.write(parameters, colors))
  return <ColorDockView
    rootRef={rootRef}
    slots={slots}
    parameters={parameters}
    activeColor={activeColor}
    onActiveColor={setActiveColor}
    libraryOpen={libraryOpen}
    onLibraryOpenChange={setLibraryOpen}
    librarySlotId={librarySlotId}
    onLibrarySlotChange={setLibrarySlotId}
    onParameters={onParameters}
    updateSlot={updateSlot}
    locked={locked}
    onLockedChange={onLockedChange}
  />
}

/** @internal Presentational dock view so swatch boundaries stay directly testable. */
export function ColorDockView<Parameters>({ rootRef, slots, parameters, activeColor, onActiveColor, libraryOpen, onLibraryOpenChange, librarySlotId, onLibrarySlotChange, onParameters, updateSlot, locked, onLockedChange }: {
  readonly rootRef?: React.RefObject<HTMLElement | null>
  readonly slots: readonly PaletteSlot<Parameters>[]
  readonly parameters: Parameters
  readonly activeColor: ActiveColor | null
  readonly onActiveColor: (active: ActiveColor | null) => void
  readonly libraryOpen: boolean
  readonly onLibraryOpenChange: (open: boolean) => void
  readonly librarySlotId: string
  readonly onLibrarySlotChange: (slotId: string) => void
  readonly onParameters: (parameters: Parameters) => void
  readonly updateSlot: (slot: PaletteSlot<Parameters>, colors: readonly RgbColor[]) => void
  readonly locked: boolean
  readonly onLockedChange: (locked: boolean) => void
}) {
  const { t } = useI18n()
  const className = ['color-dock', locked && 'locked'].filter(Boolean).join(' ')
  const selectedLibrarySlot = slots.find((slot) => slot.id === librarySlotId) ?? slots[0]
  return <section ref={rootRef} className={className} aria-label={t('controls.colorDock')}>
    <div className="color-dock-header">
      <div className="color-dock-rows">{slots.map((slot) => {
        const colors = slot.read(parameters)
        const label = t(slot.labelKey)
        const active = activeColor?.slotId === slot.id ? colors[activeColor.index] : undefined
        const guide = slot.guideKeys?.map((key) => t(key)).join(' → ')
        return <div className="color-dock-row" key={slot.id}>
          <span className="color-dock-label" title={label}>{label}</span>
          <div className="color-dock-swatches" title={guide}>
            {colors.map((color, index) => <button key={index} className={activeColor?.slotId === slot.id && activeColor.index === index ? 'color-dock-swatch active' : 'color-dock-swatch'} type="button" aria-label={`${label} ${index + 1}`} aria-pressed={activeColor?.slotId === slot.id && activeColor.index === index} style={{ backgroundColor: `rgba(${color.r},${color.g},${color.b},${color.a / 255})` }} onClick={() => onActiveColor(activeColor?.slotId === slot.id && activeColor.index === index ? null : { slotId: slot.id, index })} />)}
            <button className="color-dock-add" type="button" aria-label={t('controls.palette.add')} title={t('controls.palette.add')} disabled={colors.length >= slot.maximum} onClick={() => updateSlot(slot, insertColor(colors, colors.length, slot))}>＋</button>
            {active && activeColor?.slotId === slot.id ? <div className="color-dock-popover" style={{ '--swatch-index': activeColor.index } as CSSProperties}>
              <input aria-label={`${label} ${activeColor.index + 1}`} type="color" value={rgbaToHex(active).slice(0, 7)} onChange={(event) => updateSlot(slot, setColorHex(colors, activeColor.index, event.target.value))} />
              <HexInput color={active} label={t('controls.palette.hex')} onCommit={(hex) => updateSlot(slot, setColorHex(colors, activeColor.index, hex))} />
              {!slot.opaque && <label className="color-dock-alpha"><span>{t('controls.palette.alpha')}</span><input aria-label={t('controls.palette.alpha')} type="range" min={0} max={255} value={active.a} onChange={(event) => updateSlot(slot, setColorAlpha(colors, activeColor.index, Number(event.target.value)))} /><output>{active.a}</output></label>}
              <div className="color-dock-popover-actions">
                <button type="button" aria-label={t('controls.palette.moveEarlier')} disabled={activeColor.index === 0} onClick={() => { updateSlot(slot, moveColor(colors, activeColor.index, activeColor.index - 1)); onActiveColor({ ...activeColor, index: activeColor.index - 1 }) }}>←</button>
                <button type="button" aria-label={t('controls.palette.moveLater')} disabled={activeColor.index === colors.length - 1} onClick={() => { updateSlot(slot, moveColor(colors, activeColor.index, activeColor.index + 1)); onActiveColor({ ...activeColor, index: activeColor.index + 1 }) }}>→</button>
                <button type="button" className="color-dock-delete" aria-label={t('controls.palette.remove')} disabled={colors.length <= slot.minimum} onClick={() => { updateSlot(slot, removeColor(colors, activeColor.index, slot)); onActiveColor(null) }}>{t('controls.palette.remove')}</button>
              </div>
            </div> : null}
          </div>
        </div>
      })}</div>
      <div className="color-dock-actions">
        <button className="color-dock-lock" type="button" aria-pressed={locked} aria-label={t('controls.lockColors')} title={t('controls.lockColorsHint')} onClick={() => onLockedChange(!locked)}><LockIcon locked={locked} /></button>
        <div className="color-dock-library-anchor">
          <button className="panel-action color-dock-library" type="button" aria-expanded={libraryOpen} onClick={() => { onLibraryOpenChange(!libraryOpen); onActiveColor(null) }}>{t('controls.paletteLibraryToggle')}</button>
          {libraryOpen && selectedLibrarySlot ? <div className="color-dock-library-popover">
            {slots.length > 1 && <SegmentedControl label={t('controls.palette.targetSlot')} description={t('controls.palette.targetSlotHint')} value={selectedLibrarySlot.id} options={slots.map((slot) => ({ value: slot.id, label: t(slot.labelKey) }))} onChange={onLibrarySlotChange} />}
            <PaletteLibraryPicker inline palette={selectedLibrarySlot.read(parameters)} onChange={(colors) => updateSlot(selectedLibrarySlot, selectedLibrarySlot.fit ? selectedLibrarySlot.fit(colors, selectedLibrarySlot.read(parameters).length) : colors)} minimum={selectedLibrarySlot.minimum} maximum={selectedLibrarySlot.maximum} opaque={selectedLibrarySlot.opaque} />
          </div> : null}
        </div>
      </div>
    </div>
  </section>
}

function HexInput({ color, label, onCommit }: { readonly color: RgbColor; readonly label: string; readonly onCommit: (hex: string) => void }) {
  const value = rgbaToHex(color).slice(0, 7).toUpperCase()
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])
  const commit = () => {
    if (/^#[0-9a-fA-F]{6}$/.test(draft)) onCommit(draft)
    setDraft(value)
  }
  return <label className="color-dock-hex"><span>{label}</span><input aria-label={label} value={draft} maxLength={7} onChange={(event) => setDraft(event.target.value)} onBlur={commit} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur() }} /></label>
}

function LockIcon({ locked }: { readonly locked: boolean }) {
  return <svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><rect x="3" y="7" width="10" height="7" rx="1.5" /><path d={locked ? 'M5 7V5a3 3 0 0 1 6 0v2' : 'M5 7V5a3 3 0 0 1 5.8-1'} /></svg>
}
