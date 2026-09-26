import { useState } from 'react'
import { useI18n } from '../i18n/I18nProvider'
import { PALETTE_COLORS, builtinPalette, isPaletteCompatible, type BuiltinPaletteId } from '../shared/palette/library'
import { rgbaToHex, type RgbColor } from '../shared/pixel/color'
import { usePaletteLibrary } from './paletteLibrary'

interface PaletteMenuProps {
  readonly palette: readonly RgbColor[]
  readonly minimum: number
  readonly maximum: number
  readonly opaque?: boolean
  readonly onApply: (palette: readonly RgbColor[]) => void
}

/**
 * Flat dropdown list of built-in and saved palettes for one color slot. Each
 * entry is a single row; saving, renaming, and deleting happen inline in the
 * list instead of in a nested panel.
 */
export function PaletteMenu({ palette, minimum, maximum, opaque = false, onApply }: PaletteMenuProps) {
  const { t } = useI18n()
  const library = usePaletteLibrary()
  const [saving, setSaving] = useState(false)
  const [renameId, setRenameId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const compatible = (colors: readonly RgbColor[]) => isPaletteCompatible(colors, minimum, maximum, opaque)
  const builtins = (Object.keys(PALETTE_COLORS) as BuiltinPaletteId[]).filter((id) => compatible(PALETTE_COLORS[id]))
  const saved = library.palettes.filter((entry) => compatible(entry.colors))

  return <div className="palette-menu" role="menu" aria-label={t('paletteLibrary.title')}>
    <p className="palette-menu-heading">{t('paletteLibrary.builtIn')}</p>
    {builtins.map((id) => <PaletteMenuItem key={id} name={t(`paletteLibrary.names.${id}`)} colors={PALETTE_COLORS[id]} current={sameColors(PALETTE_COLORS[id], palette)} onSelect={() => onApply(builtinPalette(id))} />)}

    <p className="palette-menu-heading">{t('paletteLibrary.custom')}</p>
    {saved.length === 0 && !saving ? <p className="palette-menu-note">{t('paletteLibrary.noCustom')}</p> : null}
    {saved.map((entry) => renameId === entry.id
      ? <PaletteNameInput key={entry.id} initial={entry.name} onCancel={() => setRenameId(null)} onConfirm={(name) => { if (library.rename(entry.id, name)) setRenameId(null) }} />
      : <div className="palette-menu-row" key={entry.id}>
        <PaletteMenuItem name={entry.name} colors={entry.colors} current={sameColors(entry.colors, palette)} onSelect={() => onApply(entry.colors.map((color) => ({ ...color })))} />
        <span className="palette-menu-actions">
          <button className="preset-icon-button" type="button" aria-label={t('paletteLibrary.overwrite')} title={t('paletteLibrary.overwrite')} onClick={() => library.overwrite(entry.id, palette)}>↻</button>
          <button className="preset-icon-button" type="button" aria-label={t('paletteLibrary.rename')} title={t('paletteLibrary.rename')} onClick={() => { setRenameId(entry.id); setDeleteId(null) }}>✎</button>
          <button className="preset-icon-button danger" type="button" aria-label={deleteId === entry.id ? t('paletteLibrary.confirmDelete') : t('paletteLibrary.delete')} title={deleteId === entry.id ? t('paletteLibrary.confirmDelete') : t('paletteLibrary.delete')} onClick={() => {
            if (deleteId === entry.id) { if (library.remove(entry.id)) setDeleteId(null) } else setDeleteId(entry.id)
          }}>{deleteId === entry.id ? '!' : '×'}</button>
        </span>
      </div>)}
    {saving
      ? <PaletteNameInput initial="" onCancel={() => setSaving(false)} onConfirm={(name) => { if (library.save(name, palette)) setSaving(false) }} />
      : <button className="palette-menu-item palette-menu-save" type="button" role="menuitem" disabled={!library.storageAvailable || library.full} title={!library.storageAvailable ? t('paletteLibrary.storageUnavailable') : library.full ? t('paletteLibrary.limitError') : undefined} onClick={() => { setSaving(true); setRenameId(null) }}>
        <span className="palette-menu-plus" aria-hidden="true">＋</span>{t('paletteLibrary.saveAs')}
      </button>}

    {library.error ? <p className="palette-menu-note error" role="alert">{library.error}</p> : null}
    {library.warning ? <p className="palette-menu-note" role="status">{t('paletteLibrary.warning')}</p> : null}
  </div>
}

function PaletteMenuItem({ name, colors, current, onSelect }: { readonly name: string; readonly colors: readonly RgbColor[]; readonly current: boolean; readonly onSelect: () => void }) {
  return <button className={current ? 'palette-menu-item current' : 'palette-menu-item'} type="button" role="menuitemradio" aria-checked={current} title={name} onClick={onSelect}>
    <span className="palette-menu-swatches" aria-hidden="true">{colors.map((color, index) => <span key={index} style={{ backgroundColor: rgbaToHex(color) }} />)}</span>
    <span className="palette-menu-name">{name}</span>
  </button>
}

/** One-line name editor used for both saving and renaming a palette. */
function PaletteNameInput({ initial, onConfirm, onCancel }: { readonly initial: string; readonly onConfirm: (name: string) => void; readonly onCancel: () => void }) {
  const { t } = useI18n()
  const [name, setName] = useState(initial)
  return <div className="palette-menu-edit">
    <input autoFocus aria-label={t('paletteLibrary.name')} placeholder={t('paletteLibrary.name')} maxLength={40} value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => {
      if (event.key === 'Enter') onConfirm(name)
      if (event.key === 'Escape') { event.stopPropagation(); onCancel() }
    }} />
    <button className="preset-icon-button" type="button" aria-label={t('paletteLibrary.confirm')} title={t('paletteLibrary.confirm')} onClick={() => onConfirm(name)}>✓</button>
    <button className="preset-icon-button" type="button" aria-label={t('paletteLibrary.cancel')} title={t('paletteLibrary.cancel')} onClick={onCancel}>×</button>
  </div>
}

function sameColors(left: readonly RgbColor[], right: readonly RgbColor[]): boolean {
  return left.length === right.length && left.every((color, index) => {
    const other = right[index]
    return color.r === other.r && color.g === other.g && color.b === other.b && color.a === other.a
  })
}
