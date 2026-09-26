import { useEffect, useState } from 'react'
import { useI18n } from '../i18n/I18nProvider'
import { PALETTE_COLORS, builtinPalette, isPaletteCompatible, type BuiltinPaletteId } from '../shared/palette/library'
import { browserPaletteStorage, MAX_CUSTOM_PALETTES, normalizePaletteName, readCustomPalettes, writeCustomPalettes, type StoredPalette } from '../shared/palette/storage'
import { rgbaToHex, type RgbColor } from '../shared/pixel/color'
import { randomGuid } from '../shared/unity/guid'

const CHANGE_EVENT = 'pixel-effect-generator:palettes-changed'

interface PaletteLibraryPickerProps {
  readonly palette: readonly RgbColor[]
  readonly onChange: (palette: readonly RgbColor[]) => void
  readonly minimum: number
  readonly maximum: number
  readonly opaque?: boolean
  readonly inline?: boolean
}

/** Shared, locally persisted color library for every generator palette slot. */
export function PaletteLibraryPicker({ palette, onChange, minimum, maximum, opaque = false, inline = false }: PaletteLibraryPickerProps) {
  const { t } = useI18n()
  const [custom, setCustom] = useState<StoredPalette[]>([])
  const [warning, setWarning] = useState(false)
  const [storageAvailable, setStorageAvailable] = useState(true)
  const [name, setName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = () => {
    const storage = browserPaletteStorage()
    setStorageAvailable(storage !== null)
    const result = readCustomPalettes(storage)
    setCustom(result.palettes)
    setWarning(result.warning)
  }

  useEffect(() => {
    refresh()
    window.addEventListener(CHANGE_EVENT, refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener(CHANGE_EVENT, refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [])

  const persist = (next: StoredPalette[]) => {
    if (!writeCustomPalettes(next, browserPaletteStorage())) {
      setError(t('paletteLibrary.storageFailed'))
      return false
    }
    setCustom(next)
    setError(null)
    setWarning(false)
    window.dispatchEvent(new Event(CHANGE_EVENT))
    return true
  }

  const save = () => {
    const normalized = normalizePaletteName(name)
    if (normalized === null) {
      setError(t('paletteLibrary.nameError'))
      return
    }
    if (custom.length >= MAX_CUSTOM_PALETTES) {
      setError(t('paletteLibrary.limitError'))
      return
    }
    if (persist([...custom, { id: randomGuid(), name: normalized, colors: palette.map((color) => ({ ...color })) }])) setName('')
  }

  const rename = (id: string) => {
    const normalized = normalizePaletteName(editingName)
    if (normalized === null) {
      setError(t('paletteLibrary.nameError'))
      return
    }
    if (persist(custom.map((entry) => entry.id === id ? { ...entry, name: normalized } : entry))) setEditingId(null)
  }

  const compatible = (colors: readonly RgbColor[]) => isPaletteCompatible(colors, minimum, maximum, opaque)
  const builtins = (Object.keys(PALETTE_COLORS) as BuiltinPaletteId[]).filter((id) => compatible(PALETTE_COLORS[id]))
  const saved = custom.filter((entry) => compatible(entry.colors))

  const content = <div className="palette-library-content">
        <p className="panel-note">{t('paletteLibrary.applyHint')}</p>
        <div className="palette-library-group">
          <span className="palette-library-heading">{t('paletteLibrary.builtIn')}</span>
          <div className="palette-library-grid">
            {builtins.map((id) => <button className="palette-library-card" key={id} type="button" onClick={() => onChange(builtinPalette(id))}>
              <PaletteSwatches colors={PALETTE_COLORS[id]} />
              <span>{t(`paletteLibrary.names.${id}`)}</span>
            </button>)}
          </div>
        </div>
        <div className="palette-library-group">
          <span className="palette-library-heading">{t('paletteLibrary.custom')}</span>
          {saved.length === 0 && <p className="panel-note">{t('paletteLibrary.noCustom')}</p>}
          {saved.map((entry) => <div className="palette-library-saved" key={entry.id}>
            <button className="palette-library-card" type="button" onClick={() => onChange(entry.colors.map((color) => ({ ...color })))}>
              <PaletteSwatches colors={entry.colors} /><span>{entry.name}</span>
            </button>
            <div className="palette-library-actions">
              <button type="button" onClick={() => persist(custom.map((item) => item.id === entry.id ? { ...item, colors: palette.map((color) => ({ ...color })) } : item))}>{t('paletteLibrary.update')}</button>
              <button type="button" onClick={() => { setEditingId(entry.id); setEditingName(entry.name); setDeleteId(null) }}>{t('paletteLibrary.rename')}</button>
              <button type="button" onClick={() => {
                if (deleteId === entry.id) { if (persist(custom.filter((item) => item.id !== entry.id))) setDeleteId(null) }
                else { setDeleteId(entry.id); setEditingId(null) }
              }}>{deleteId === entry.id ? t('paletteLibrary.confirmDelete') : t('paletteLibrary.delete')}</button>
            </div>
            {editingId === entry.id && <div className="palette-library-form">
              <input aria-label={t('paletteLibrary.name')} maxLength={40} value={editingName} onChange={(event) => setEditingName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') rename(entry.id) }} />
              <button type="button" onClick={() => rename(entry.id)}>{t('paletteLibrary.confirm')}</button>
              <button type="button" onClick={() => setEditingId(null)}>{t('paletteLibrary.cancel')}</button>
            </div>}
          </div>)}
        </div>
        <div className="palette-library-form">
          <input aria-label={t('paletteLibrary.name')} placeholder={t('paletteLibrary.name')} maxLength={40} value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') save() }} />
          <button className="secondary-button" type="button" disabled={!storageAvailable || custom.length >= MAX_CUSTOM_PALETTES} onClick={save}>{t('paletteLibrary.save')}</button>
        </div>
        {!storageAvailable && <p className="panel-note" role="status">{t('paletteLibrary.storageUnavailable')}</p>}
        {warning && <p className="panel-note" role="status">{t('paletteLibrary.warning')}</p>}
        {error && <p className="palette-library-error" role="alert">{error}</p>}
      </div>
  return inline
    ? <div className="palette-library inline">{content}</div>
    : <details className="palette-library" onToggle={(event) => { if (event.currentTarget.open) refresh() }}><summary>{t('paletteLibrary.title')}</summary>{content}</details>
}

function PaletteSwatches({ colors }: { readonly colors: readonly RgbColor[] }) {
  return <span className="palette-library-swatches" aria-hidden="true">{colors.map((color, index) =>
    <span key={index} style={{ backgroundColor: rgbaToHex(color) }} />
  )}</span>
}
