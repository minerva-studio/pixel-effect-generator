import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { GeneratorPreset, GeneratorPresetCapability, PaletteSlot } from '../generators/contract'
import { applyPreservingColors } from '../generators/paletteSlots'
import { runPresetMigration } from '../generators/presetMigration'
import { useI18n } from '../i18n/I18nProvider'
import { presetDisplayKeys, type TranslateFunction } from '../i18n/messages'
import type { FrameSize, PixelFrame } from '../shared/pixel/frame'
import type { JsonValue } from '../shared/project/types'
import { randomGuid } from '../shared/unity/guid'
import { drawFrame } from './export'
import {
  browserPresetStorage,
  createStoredPreset,
  deletePreset,
  normalizePresetName,
  readCustomPresets,
  renamePreset,
  upsertPreset,
  writeCustomPresets,
  type PresetStorage,
  type StoredPreset,
} from '../shared/preset/storage'

/** True when a captured effect differs from the last applied preset payload. */
export function payloadsEqual(left: JsonValue, right: JsonValue): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

/**
 * Applies one preset and returns the captured baseline of the actual result,
 * so clamping on small canvases never looks like a modification.
 */
export function resolveAppliedPresetBaseline<Parameters>(
  capability: GeneratorPresetCapability<Parameters>,
  parameters: Parameters,
  payload: JsonValue,
  paletteSlots: readonly PaletteSlot<Parameters>[] = [],
  preserveColors = false,
): { readonly parameters: Parameters; readonly baseline: JsonValue } {
  const applied = capability.apply(parameters, payload)
  const next = preserveColors ? applyPreservingColors(paletteSlots, parameters, applied) : applied
  return { parameters: next, baseline: capability.capture(next) }
}

/**
 * Renders one preset preview on the active canvas by applying its payload to
 * the current parameters. Throws when the payload cannot be applied.
 */
export function renderPresetFrames<Parameters>(
  capability: GeneratorPresetCapability<Parameters>,
  render: (parameters: Parameters) => readonly PixelFrame[],
  parameters: Parameters,
  payload: JsonValue,
  paletteSlots: readonly PaletteSlot<Parameters>[] = [],
  preserveColors = false,
): readonly PixelFrame[] {
  const applied = capability.apply(parameters, payload)
  return render(preserveColors ? applyPreservingColors(paletteSlots, parameters, applied) : applied)
}

/** Cache of rendered preview frame sets keyed by generator, preset, and canvas. */
const presetFrameCache = new Map<string, readonly PixelFrame[]>()

/** Stable cache key for one preset preview on a specific canvas. */
export function presetPreviewKey(
  generatorId: string,
  presetId: string,
  frameSize: FrameSize,
  frameCount: number,
  colorSignature = '',
): string {
  const base = `${generatorId}:${presetId}:${frameSize.width}x${frameSize.height}x${frameCount}`
  return colorSignature ? `${base}:${colorSignature}` : base
}

/** Drops every cached preview belonging to one generator. */
function clearPresetFrameCache(generatorId: string): void {
  for (const key of presetFrameCache.keys()) {
    if (key.startsWith(`${generatorId}:`)) presetFrameCache.delete(key)
  }
}

/** One normalized preset entry rendered as a preview card. */
export interface PresetPreviewCard {
  readonly id: string
  readonly name: string
  readonly description: string | null
  readonly custom: boolean
  readonly buildFrames: () => readonly PixelFrame[]
}

interface PresetBarProps<Parameters> {
  readonly capability: GeneratorPresetCapability<Parameters>
  readonly paletteSlots: readonly PaletteSlot<Parameters>[]
  readonly preserveColors: boolean
  readonly generatorId: string
  readonly parameters: Parameters
  readonly render: (parameters: Parameters) => readonly PixelFrame[]
  readonly frameSize: FrameSize
  readonly frameCount: number
  readonly onApply: (parameters: Parameters) => void
}

export interface PresetBarViewProps {
  readonly selectedId: string | null
  readonly builtInCards: readonly PresetPreviewCard[]
  readonly customCards: readonly PresetPreviewCard[]
  readonly pickerOpen: boolean
  readonly modified: boolean
  readonly storageUnavailable: boolean
  readonly warning: boolean
  readonly error: string | null
  readonly saveOpen: boolean
  readonly saveName: string
  readonly renameId: string | null
  readonly renameName: string
  readonly deleteConfirmId: string | null
  readonly onSelect: (presetId: string) => void
  readonly onPickerOpen: () => void
  readonly onPickerClose: () => void
  readonly onSaveAsOpen: () => void
  readonly onSaveNameChange: (name: string) => void
  readonly onSaveAsConfirm: () => void
  readonly onSaveAsCancel: () => void
  readonly onUpdate: (presetId: string) => void
  readonly onRenameStart: (presetId: string, name: string) => void
  readonly onRenameChange: (name: string) => void
  readonly onRenameConfirm: (presetId: string) => void
  readonly onRenameCancel: () => void
  readonly onDelete: (presetId: string) => void
}

/** Preset strip and full preset browser dialog. */
export function PresetBarView({
  selectedId, builtInCards, customCards, pickerOpen, modified, storageUnavailable, warning, error,
  saveOpen, saveName, renameId, renameName, deleteConfirmId,
  onSelect, onPickerOpen, onPickerClose, onSaveAsOpen, onSaveNameChange, onSaveAsConfirm,
  onSaveAsCancel, onUpdate, onRenameStart, onRenameChange, onRenameConfirm, onRenameCancel, onDelete,
}: PresetBarViewProps) {
  const { t } = useI18n()
  const allCards = [...builtInCards, ...customCards]
  return (
    <>
      <PresetStrip
        cards={allCards}
        selectedId={selectedId}
        modified={modified}
        saveOpen={saveOpen}
        saveName={saveName}
        storageUnavailable={storageUnavailable}
        renameId={renameId}
        renameName={renameName}
        deleteConfirmId={deleteConfirmId}
        onSelect={onSelect}
        onSaveAsOpen={onSaveAsOpen}
        onSaveNameChange={onSaveNameChange}
        onSaveAsConfirm={onSaveAsConfirm}
        onSaveAsCancel={onSaveAsCancel}
        onPickerOpen={onPickerOpen}
        onUpdate={onUpdate}
        onRenameStart={onRenameStart}
        onRenameChange={onRenameChange}
        onRenameConfirm={onRenameConfirm}
        onRenameCancel={onRenameCancel}
        onDelete={onDelete}
      />
      {error || warning || storageUnavailable ? <div className="preset-feedback">
        {error ? <p className="preset-error" role="alert">{error}</p> : null}
        {warning ? <p className="preset-warning">{t('presets.warning')}</p> : null}
        {storageUnavailable ? <p className="preset-hint">{t('presets.storageHint')}</p> : null}
      </div> : null}
      {pickerOpen ? (
        <div className="preset-dialog-backdrop" onClick={onPickerClose}>
          <div className="preset-dialog" role="dialog" aria-modal="true" aria-label={t('presets.pickerTitle')} onClick={(event) => event.stopPropagation()}>
            <div className="preset-dialog-header">
              <h2 className="preset-dialog-title">{t('presets.pickerTitle')}</h2>
              <button className="preset-dialog-close" type="button" aria-label={t('presets.pickerClose')} onClick={onPickerClose}>×</button>
            </div>
            <div className="preset-groups" role="group" aria-label={t('presets.selectLabel')}>
              {builtInCards.length > 0 ? <section className="preset-group" aria-label={t('presets.builtInGroup')}>
                <h3 className="preset-group-title">{t('presets.builtInGroup')}</h3>
                <div className="preset-card-grid">{builtInCards.map((card) => <PresetCard key={card.id} card={card} selected={card.id === selectedId} onSelect={onSelect} />)}</div>
              </section> : null}
              {customCards.length > 0 ? <section className="preset-group" aria-label={t('presets.customGroup')}>
                <h3 className="preset-group-title">{t('presets.customGroup')}</h3>
                <div className="preset-card-grid">{customCards.map((card) => <PresetCard key={card.id} card={card} selected={card.id === selectedId} onSelect={onSelect} />)}</div>
              </section> : null}
            </div>
            <div className="preset-dialog-actions"><button className="secondary-button" type="button" onClick={onPickerClose}>{t('presets.pickerCancel')}</button></div>
          </div>
        </div>
      ) : null}
    </>
  )
}

/** Horizontally scrolling card strip; the dialog shortcut stays fixed at its end. */
export function PresetStrip({
  cards, selectedId, modified, saveOpen, saveName, storageUnavailable, renameId, renameName, deleteConfirmId,
  onSelect, onSaveAsOpen, onSaveNameChange, onSaveAsConfirm, onSaveAsCancel, onPickerOpen,
  onUpdate, onRenameStart, onRenameChange, onRenameConfirm, onRenameCancel, onDelete,
}: {
  readonly cards: readonly PresetPreviewCard[]
  readonly selectedId: string | null
  readonly modified: boolean
  readonly saveOpen: boolean
  readonly saveName: string
  readonly storageUnavailable: boolean
  readonly renameId: string | null
  readonly renameName: string
  readonly deleteConfirmId: string | null
  readonly onSelect: (presetId: string) => void
  readonly onSaveAsOpen: () => void
  readonly onSaveNameChange: (name: string) => void
  readonly onSaveAsConfirm: () => void
  readonly onSaveAsCancel: () => void
  readonly onPickerOpen: () => void
  readonly onUpdate: (presetId: string) => void
  readonly onRenameStart: (presetId: string, name: string) => void
  readonly onRenameChange: (name: string) => void
  readonly onRenameConfirm: (presetId: string) => void
  readonly onRenameCancel: () => void
  readonly onDelete: (presetId: string) => void
}) {
  const { t } = useI18n()
  return <div className="preset-strip">
    <div className="preset-strip-cards" role="list" aria-label={t('presets.selectLabel')}>
      {cards.map((card) => <PresetCard
        key={card.id}
        card={card}
        selected={card.id === selectedId}
        modified={card.id === selectedId && modified}
        compact
        editing={renameId === card.id}
        renameName={renameName}
        deleteConfirm={deleteConfirmId === card.id}
        storageUnavailable={storageUnavailable}
        onSelect={onSelect}
        onUpdate={onUpdate}
        onRenameStart={onRenameStart}
        onRenameChange={onRenameChange}
        onRenameConfirm={onRenameConfirm}
        onRenameCancel={onRenameCancel}
        onDelete={onDelete}
      />)}
      {saveOpen ? <div className="preset-save-card editing" role="listitem">
        <input autoFocus aria-label={t('presets.saveNameLabel')} value={saveName} maxLength={40} placeholder={t('presets.saveNameLabel')} onChange={(event) => onSaveNameChange(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') onSaveAsConfirm() }} />
        <button className="secondary-button" type="button" onClick={onSaveAsConfirm}>{t('presets.saveConfirm')}</button>
        <button className="text-button" type="button" onClick={onSaveAsCancel}>{t('presets.cancel')}</button>
      </div> : <div className="preset-save-card" role="listitem">
        <button type="button" disabled={storageUnavailable} title={storageUnavailable ? t('presets.storageHint') : undefined} onClick={onSaveAsOpen}>
          <span aria-hidden="true">＋</span> {t('presets.saveCurrent')}
        </button>
      </div>}
    </div>
    <button className="text-button preset-view-all" type="button" onClick={onPickerOpen}>{t('presets.allPresets')}</button>
  </div>
}

/** One looping preview card backed by lazily rendered preset frames. */
const PresetCard = memo(function PresetCard({
  card, selected, modified = false, compact = false, editing = false, renameName = '', deleteConfirm = false,
  storageUnavailable = false, onSelect, onUpdate, onRenameStart, onRenameChange, onRenameConfirm, onRenameCancel, onDelete,
}: {
  readonly card: PresetPreviewCard
  readonly selected: boolean
  readonly modified?: boolean
  readonly compact?: boolean
  readonly editing?: boolean
  readonly renameName?: string
  readonly deleteConfirm?: boolean
  readonly storageUnavailable?: boolean
  readonly onSelect: (presetId: string) => void
  readonly onUpdate?: (presetId: string) => void
  readonly onRenameStart?: (presetId: string, name: string) => void
  readonly onRenameChange?: (name: string) => void
  readonly onRenameConfirm?: (presetId: string) => void
  readonly onRenameCancel?: () => void
  readonly onDelete?: (presetId: string) => void
}) {
  const { t } = useI18n()
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const frameIndexRef = useRef(0)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined
    setFailed(false)
    let disposed = false
    let frames: readonly PixelFrame[] | undefined
    let interval = 0
    // Deferred rendering keeps dozens of preset cards from blocking first paint.
    const timer = window.setTimeout(() => {
      if (disposed) return
      try {
        frames = card.buildFrames()
      } catch {
        if (!disposed) setFailed(true)
        return
      }
      if (disposed || frames.length === 0) return
      drawFrame(canvas, frames[0])
      frameIndexRef.current = 0
      interval = window.setInterval(() => {
        frameIndexRef.current = (frameIndexRef.current + 1) % frames!.length
        drawFrame(canvas, frames![frameIndexRef.current])
      }, 150)
    }, 0)
    return () => {
      disposed = true
      window.clearTimeout(timer)
      window.clearInterval(interval)
    }
  }, [card.buildFrames])
  const deleteLabel = deleteConfirm ? t('presets.confirmDelete') : t('presets.deleteCard', { name: card.name })
  return <div className={`preset-card ${compact ? 'compact' : ''} ${selected ? 'active' : ''} ${failed ? 'failed' : ''} ${editing ? 'editing' : ''}`} role={compact ? 'listitem' : undefined}>
    {editing ? <div className="preset-inline-edit">
      <input autoFocus aria-label={t('presets.saveNameLabel')} value={renameName} maxLength={40} onChange={(event) => onRenameChange?.(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') onRenameConfirm?.(card.id); if (event.key === 'Escape') onRenameCancel?.() }} />
      <button className="preset-icon-button" type="button" aria-label={t('presets.confirm')} title={t('presets.confirm')} onClick={() => onRenameConfirm?.(card.id)}>✓</button>
      <button className="preset-icon-button" type="button" aria-label={t('presets.cancel')} title={t('presets.cancel')} onClick={onRenameCancel}>×</button>
    </div> : <button className="preset-card-select" type="button" aria-pressed={selected} onClick={() => onSelect(card.id)}>
      <canvas ref={canvasRef} aria-hidden="true" />
      <span className="preset-card-label">{card.name}</span>
      {modified ? <small className="preset-card-modified">{t('presets.modified')}</small> : null}
      {card.description && !compact ? <small className="preset-card-description">{card.description}</small> : null}
    </button>}
    {card.custom && compact && !editing ? <div className="preset-card-actions">
      <button className="preset-icon-button" type="button" aria-label={t('presets.updateCard', { name: card.name })} title={t('presets.updateCard', { name: card.name })} disabled={storageUnavailable} onClick={() => onUpdate?.(card.id)}>↻</button>
      <button className="preset-icon-button" type="button" aria-label={t('presets.renameCard', { name: card.name })} title={t('presets.renameCard', { name: card.name })} disabled={storageUnavailable} onClick={() => onRenameStart?.(card.id, card.name)}>✎</button>
      <button className="preset-icon-button danger" type="button" aria-label={deleteLabel} title={deleteLabel} disabled={storageUnavailable} onClick={() => onDelete?.(card.id)}>{deleteConfirm ? '!' : '×'}</button>
    </div> : null}
  </div>
})

/**
 * Effect preset toolbar rendered between the parameter header and category
 * tabs. Built-ins come from the module; custom presets live in browser
 * storage. Applying a preset renders exactly once through `onApply` and never
 * touches the generator session or Project JSON.
 */
export function PresetBar<Parameters>({
  capability,
  paletteSlots,
  preserveColors,
  generatorId,
  parameters,
  render,
  frameSize,
  frameCount,
  onApply,
}: PresetBarProps<Parameters>) {
  const { t } = useI18n()
  const [storage] = useState<PresetStorage | null>(() => browserPresetStorage())
  const [customPresets, setCustomPresets] = useState<readonly StoredPreset[]>([])
  const [warning, setWarning] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [appliedPayload, setAppliedPayload] = useState<JsonValue | undefined>(undefined)
  const [saveOpen, setSaveOpen] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [renameId, setRenameId] = useState<string | null>(null)
  const [renameName, setRenameName] = useState('')
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const parametersRef = useRef(parameters)
  parametersRef.current = parameters
  const colorSignature = preserveColors ? JSON.stringify(paletteSlots.map((slot) => slot.read(parameters))) : ''

  useEffect(() => {
    runPresetMigration(generatorId, storage)
    clearPresetFrameCache(generatorId)
    const loaded = readCustomPresets(generatorId, storage, capability.validate)
    setCustomPresets(loaded.presets)
    setWarning(loaded.warning)
  }, [generatorId, storage, capability])

  useEffect(() => {
    if (!pickerOpen) {
      return undefined
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPickerOpen(false)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [pickerOpen])

  const capture = useMemo(() => capability.capture(parameters), [capability, parameters])
  const modified = appliedPayload !== undefined && !payloadsEqual(capture, appliedPayload)

  /**
   * Stable preview builder per preset. It reads the latest parameters through
   * a ref so slider drags never re-create card props; only canvas size, frame
   * count, or the generator identity invalidate the previews.
   */
  const buildFrames = useCallback((presetId: string, payload: JsonValue) => {
    const key = presetPreviewKey(generatorId, presetId, frameSize, frameCount, colorSignature)
    return (): readonly PixelFrame[] => {
      const cached = presetFrameCache.get(key)
      if (cached) return cached
      const frames = renderPresetFrames(capability, render, parametersRef.current, payload, paletteSlots, preserveColors)
      presetFrameCache.set(key, frames)
      return frames
    }
  }, [capability, render, generatorId, frameSize.width, frameSize.height, frameCount, paletteSlots, preserveColors, colorSignature])

  const builtInCards = useMemo(() => capability.builtIns.map((preset) => ({
    id: preset.id,
    name: presetName(generatorId, preset, t),
    description: presetDescription(generatorId, preset, t),
    custom: false,
    buildFrames: buildFrames(preset.id, preset.payload),
  })), [capability.builtIns, generatorId, t, buildFrames])

  const customCards = useMemo(() => customPresets.map((preset) => ({
    id: preset.id,
    name: preset.name,
    description: null,
    custom: true,
    buildFrames: buildFrames(preset.id, preset.payload),
  })), [customPresets, buildFrames])

  // Until the user picks a card, highlight whichever preset the current
  // parameters already match (for example the defaults or an opened project).
  const matchingPresetId = useMemo(() => {
    if (selectedId !== null) return null
    const match = [...capability.builtIns, ...customPresets].find((preset) => {
      try {
        return payloadsEqual(capture, capability.capture(capability.apply(parameters, preset.payload)))
      } catch {
        return false
      }
    })
    return match?.id ?? null
  }, [selectedId, capability, customPresets, capture, parameters])

  const handleSelect = (presetId: string) => {
    const preset = capability.builtIns.find((entry) => entry.id === presetId)
      ?? customPresets.find((entry) => entry.id === presetId)
    if (!preset) {
      return
    }
    try {
      const { parameters: next, baseline } = resolveAppliedPresetBaseline(capability, parameters, preset.payload, paletteSlots, preserveColors)
      onApply(next)
      setSelectedId(presetId)
      setAppliedPayload(baseline)
      setPickerOpen(false)
      setError(null)
    } catch {
      setError(t('presets.errors.invalidPreset'))
    }
  }

  const writeLibrary = (presets: readonly StoredPreset[]): boolean => {
    if (storage === null) {
      setError(t('presets.errors.storageUnavailable'))
      return false
    }
    if (!writeCustomPresets(generatorId, presets, storage)) {
      setError(t('presets.errors.storageUnavailable'))
      return false
    }
    clearPresetFrameCache(generatorId)
    setCustomPresets(presets)
    setWarning(false)
    setError(null)
    return true
  }

  const handleSaveAsConfirm = () => {
    const name = normalizePresetName(saveName)
    if (name === null) {
      setError(t('presets.errors.nameLength'))
      return
    }
    const payload = capability.capture(parameters)
    const preset = createStoredPreset(name, generatorId, payload, randomGuid())
    const next = upsertPreset(customPresets, preset)
    if (!next.ok) {
      setError(t('presets.errors.limit'))
      return
    }
    if (!writeLibrary(next.presets)) {
      return
    }
    setSelectedId(preset.id)
    setAppliedPayload(payload)
    setSaveOpen(false)
    setSaveName('')
  }

  const handleUpdate = (presetId: string) => {
    const selected = customPresets.find((preset) => preset.id === presetId)
    if (!selected) {
      return
    }
    const payload = capability.capture(parameters)
    const updated = createStoredPreset(selected.name, generatorId, payload, selected.id)
    const next = upsertPreset(customPresets, updated)
    if (!next.ok) {
      setError(t('presets.errors.limit'))
      return
    }
    if (!writeLibrary(next.presets)) {
      return
    }
    setSelectedId(selected.id)
    setAppliedPayload(payload)
  }

  const handleRenameConfirm = (presetId: string) => {
    const name = normalizePresetName(renameName)
    if (name === null) {
      setError(t('presets.errors.nameLength'))
      return
    }
    const next = renamePreset(customPresets, presetId, name)
    if (!writeLibrary(next)) {
      return
    }
    setRenameId(null)
    setRenameName('')
  }

  const handleDelete = (presetId: string) => {
    if (deleteConfirmId !== presetId) {
      setDeleteConfirmId(presetId)
      return
    }
    const next = deletePreset(customPresets, presetId)
    if (!writeLibrary(next)) {
      return
    }
    if (selectedId === presetId) {
      setSelectedId(null)
      setAppliedPayload(undefined)
    }
    setDeleteConfirmId(null)
  }

  return (
    <PresetBarView
      selectedId={selectedId ?? matchingPresetId}
      builtInCards={builtInCards}
      customCards={customCards}
      pickerOpen={pickerOpen}
      modified={modified}
      storageUnavailable={storage === null}
      warning={warning}
      error={error}
      saveOpen={saveOpen}
      saveName={saveName}
      renameId={renameId}
      renameName={renameName}
      deleteConfirmId={deleteConfirmId}
      onSelect={handleSelect}
      onPickerOpen={() => {
        setError(null)
        setPickerOpen(true)
      }}
      onPickerClose={() => setPickerOpen(false)}
      onSaveAsOpen={() => {
        setError(null)
        setSaveName('')
        setSaveOpen(true)
      }}
      onSaveNameChange={setSaveName}
      onSaveAsConfirm={handleSaveAsConfirm}
      onSaveAsCancel={() => {
        setSaveOpen(false)
        setSaveName('')
      }}
      onUpdate={handleUpdate}
      onRenameStart={(presetId, name) => {
        setError(null)
        setRenameId(presetId)
        setRenameName(name)
      }}
      onRenameChange={setRenameName}
      onRenameConfirm={handleRenameConfirm}
      onRenameCancel={() => {
        setRenameId(null)
        setRenameName('')
      }}
      onDelete={handleDelete}
    />
  )
}

/** Returns the translated preset name, falling back to the raw name. */
function presetName(
  generatorId: string,
  preset: GeneratorPreset,
  t: TranslateFunction,
): string {
  const keys = presetDisplayKeys(generatorId, preset.id)
  return keys ? t(keys.name) : preset.name
}

/** Returns the translated preset description, or null for custom presets. */
function presetDescription(
  generatorId: string,
  preset: GeneratorPreset,
  t: TranslateFunction,
): string | null {
  const keys = presetDisplayKeys(generatorId, preset.id)
  return keys ? t(keys.description) : preset.description
}
