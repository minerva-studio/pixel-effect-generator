import { memo, useCallback, useEffect, useId, useMemo, useRef, useState, type RefObject } from 'react'
import type { GeneratorPreset, GeneratorPresetCapability } from '../generators/contract'
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
): { readonly parameters: Parameters; readonly baseline: JsonValue } {
  const next = capability.apply(parameters, payload)
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
): readonly PixelFrame[] {
  return render(capability.apply(parameters, payload))
}

/** Cache of rendered preview frame sets keyed by generator, preset, and canvas. */
const presetFrameCache = new Map<string, readonly PixelFrame[]>()

/** Stable cache key for one preset preview on a specific canvas. */
export function presetPreviewKey(
  generatorId: string,
  presetId: string,
  frameSize: FrameSize,
  frameCount: number,
): string {
  return `${generatorId}:${presetId}:${frameSize.width}x${frameSize.height}x${frameCount}`
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
  readonly actionsOpen: boolean
  readonly modified: boolean
  readonly storageUnavailable: boolean
  readonly warning: boolean
  readonly error: string | null
  readonly saveOpen: boolean
  readonly saveName: string
  readonly manageOpen: boolean
  readonly renameId: string | null
  readonly renameName: string
  readonly deleteConfirmId: string | null
  readonly actionsPanelId: string
  readonly actionsRef: RefObject<HTMLDivElement | null>
  readonly actionsButtonRef: RefObject<HTMLButtonElement | null>
  readonly onSelect: (presetId: string) => void
  readonly onPickerOpen: () => void
  readonly onPickerClose: () => void
  readonly onActionsToggle: () => void
  readonly onSaveAsOpen: () => void
  readonly onSaveNameChange: (name: string) => void
  readonly onSaveAsConfirm: () => void
  readonly onSaveAsCancel: () => void
  readonly onUpdate: () => void
  readonly onManageToggle: () => void
  readonly onRenameStart: (presetId: string, name: string) => void
  readonly onRenameChange: (name: string) => void
  readonly onRenameConfirm: (presetId: string) => void
  readonly onRenameCancel: () => void
  readonly onDelete: (presetId: string) => void
}

/** Presentational preset controls for the parameter panel header. */
export function PresetBarView({
  selectedId,
  builtInCards,
  customCards,
  pickerOpen,
  actionsOpen,
  modified,
  storageUnavailable,
  warning,
  error,
  saveOpen,
  saveName,
  manageOpen,
  renameId,
  renameName,
  deleteConfirmId,
  actionsPanelId,
  actionsRef,
  actionsButtonRef,
  onSelect,
  onPickerOpen,
  onPickerClose,
  onActionsToggle,
  onSaveAsOpen,
  onSaveNameChange,
  onSaveAsConfirm,
  onSaveAsCancel,
  onUpdate,
  onManageToggle,
  onRenameStart,
  onRenameChange,
  onRenameConfirm,
  onRenameCancel,
  onDelete,
}: PresetBarViewProps) {
  const { t } = useI18n()
  const selectedCustom = customCards.find((card) => card.id === selectedId)
  return (
    <>
      <div className="preset-actions" ref={actionsRef}>
        <button
          className="project-menu-button preset-actions-toggle"
          type="button"
          ref={actionsButtonRef}
          aria-expanded={actionsOpen}
          aria-controls={actionsPanelId}
          aria-haspopup="menu"
          onClick={onActionsToggle}
        >
          {t('presets.actionsMenu')}
          <span className="project-menu-chevron" aria-hidden="true">▾</span>
        </button>
        {actionsOpen ? (
          <div className="preset-actions-panel" id={actionsPanelId} role="menu" aria-label={t('presets.actionsMenu')}>
            {modified ? <p className="preset-modified">{t('presets.modified')}</p> : null}
            <button className="project-menu-item" type="button" role="menuitem" onClick={onPickerOpen}>
              {t('presets.pickerOpen')}
            </button>
            <button className="project-menu-item" type="button" role="menuitem" disabled={storageUnavailable} onClick={onSaveAsOpen}>
              {t('presets.saveAs')}
            </button>
            <button className="project-menu-item" type="button" role="menuitem" disabled={selectedCustom === undefined || storageUnavailable} onClick={onUpdate}>
              {t('presets.update')}
            </button>
            <button className="project-menu-item" type="button" role="menuitem" onClick={onManageToggle}>
              {t('presets.manage')}
            </button>
            {saveOpen ? (
              <div className="preset-save-row">
                <input
                  aria-label={t('presets.saveNameLabel')}
                  value={saveName}
                  maxLength={40}
                  placeholder={t('presets.saveNameLabel')}
                  onChange={(event) => onSaveNameChange(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      onSaveAsConfirm()
                    }
                  }}
                />
                <button className="secondary-button" type="button" onClick={onSaveAsConfirm}>{t('presets.saveConfirm')}</button>
                <button className="text-button" type="button" onClick={onSaveAsCancel}>{t('presets.cancel')}</button>
              </div>
            ) : null}
            {manageOpen ? (
              <div className="preset-manage-list">
                {customCards.length === 0 ? (
                  <p className="preset-manage-empty">{t('presets.noCustom')}</p>
                ) : (
                  customCards.map((card) => (
                    <div className="preset-manage-item" key={card.id}>
                      {renameId === card.id ? (
                        <>
                          <input
                            aria-label={t('presets.rename')}
                            value={renameName}
                            maxLength={40}
                            onChange={(event) => onRenameChange(event.target.value)}
                          />
                          <button className="text-button" type="button" onClick={() => onRenameConfirm(card.id)}>{t('presets.confirm')}</button>
                          <button className="text-button" type="button" onClick={onRenameCancel}>{t('presets.cancel')}</button>
                        </>
                      ) : (
                        <>
                          <span className="preset-manage-name">{card.name}</span>
                          <button className="text-button" type="button" onClick={() => onRenameStart(card.id, card.name)}>{t('presets.rename')}</button>
                          <button className="text-button danger" type="button" onClick={() => onDelete(card.id)}>
                            {deleteConfirmId === card.id ? t('presets.confirmDelete') : t('presets.delete')}
                          </button>
                        </>
                      )}
                    </div>
                  ))
                )}
              </div>
            ) : null}
            {error ? <p className="preset-error" role="alert">{error}</p> : null}
            {warning ? <p className="preset-warning">{t('presets.warning')}</p> : null}
            {storageUnavailable ? <p className="preset-hint">{t('presets.storageHint')}</p> : null}
          </div>
        ) : null}
      </div>

      {pickerOpen ? (
        <div className="preset-dialog-backdrop" onClick={onPickerClose}>
          <div
            className="preset-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={t('presets.pickerTitle')}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="preset-dialog-header">
              <h2 className="preset-dialog-title">{t('presets.pickerTitle')}</h2>
              <button
                className="preset-dialog-close"
                type="button"
                aria-label={t('presets.pickerClose')}
                onClick={onPickerClose}
              >
                ×
              </button>
            </div>
            <div className="preset-groups" role="group" aria-label={t('presets.selectLabel')}>
              {builtInCards.length > 0 ? (
                <section className="preset-group" aria-label={t('presets.builtInGroup')}>
                  <h3 className="preset-group-title">{t('presets.builtInGroup')}</h3>
                  <div className="preset-card-grid">
                    {builtInCards.map((card) => (
                      <PresetCard key={card.id} card={card} selected={card.id === selectedId} onSelect={onSelect} />
                    ))}
                  </div>
                </section>
              ) : null}
              {customCards.length > 0 ? (
                <section className="preset-group" aria-label={t('presets.customGroup')}>
                  <h3 className="preset-group-title">{t('presets.customGroup')}</h3>
                  <div className="preset-card-grid">
                    {customCards.map((card) => (
                      <PresetCard key={card.id} card={card} selected={card.id === selectedId} onSelect={onSelect} />
                    ))}
                  </div>
                </section>
              ) : null}
            </div>
            <div className="preset-dialog-actions">
              <button className="secondary-button" type="button" onClick={onPickerClose}>{t('presets.pickerCancel')}</button>
            </div>
            {error ? <p className="preset-error" role="alert">{error}</p> : null}
          </div>
        </div>
      ) : null}
    </>
  )
}

/** One looping preview card backed by lazily rendered preset frames. */
const PresetCard = memo(function PresetCard({
  card,
  selected,
  onSelect,
}: {
  readonly card: PresetPreviewCard
  readonly selected: boolean
  readonly onSelect: (presetId: string) => void
}) {
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
  return (
    <button
      className={`preset-card ${selected ? 'active' : ''} ${failed ? 'failed' : ''}`}
      type="button"
      aria-pressed={selected}
      onClick={() => onSelect(card.id)}
    >
      <canvas ref={canvasRef} aria-hidden="true" />
      <span className="preset-card-label">{card.name}</span>
      {card.description ? <small className="preset-card-description">{card.description}</small> : null}
    </button>
  )
})

/**
 * Effect preset toolbar rendered between the parameter header and category
 * tabs. Built-ins come from the module; custom presets live in browser
 * storage. Applying a preset renders exactly once through `onApply` and never
 * touches the generator session or Project JSON.
 */
export function PresetBar<Parameters>({
  capability,
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
  const [actionsOpen, setActionsOpen] = useState(false)
  const [manageOpen, setManageOpen] = useState(false)
  const [renameId, setRenameId] = useState<string | null>(null)
  const [renameName, setRenameName] = useState('')
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const actionsRef = useRef<HTMLDivElement | null>(null)
  const actionsButtonRef = useRef<HTMLButtonElement | null>(null)
  const actionsPanelId = useId()
  const parametersRef = useRef(parameters)
  parametersRef.current = parameters

  useEffect(() => {
    runPresetMigration(generatorId, storage)
    clearPresetFrameCache(generatorId)
    const loaded = readCustomPresets(generatorId, storage, capability.validate)
    setCustomPresets(loaded.presets)
    setWarning(loaded.warning)
  }, [generatorId, storage, capability])

  useEffect(() => {
    if (!actionsOpen) {
      return undefined
    }
    const handlePointerDown = (event: PointerEvent) => {
      if (actionsRef.current && !actionsRef.current.contains(event.target as Node)) {
        setActionsOpen(false)
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setActionsOpen(false)
        setRenameId(null)
        setDeleteConfirmId(null)
        actionsButtonRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [actionsOpen])

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
    const key = presetPreviewKey(generatorId, presetId, frameSize, frameCount)
    return (): readonly PixelFrame[] => {
      const cached = presetFrameCache.get(key)
      if (cached) return cached
      const frames = renderPresetFrames(capability, render, parametersRef.current, payload)
      presetFrameCache.set(key, frames)
      return frames
    }
  }, [capability, render, generatorId, frameSize.width, frameSize.height, frameCount])

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

  const handleSelect = (presetId: string) => {
    const preset = capability.builtIns.find((entry) => entry.id === presetId)
      ?? customPresets.find((entry) => entry.id === presetId)
    if (!preset) {
      return
    }
    try {
      const { parameters: next, baseline } = resolveAppliedPresetBaseline(capability, parameters, preset.payload)
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
    setActionsOpen(false)
  }

  const handleUpdate = () => {
    const selected = customPresets.find((preset) => preset.id === selectedId)
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
      selectedId={selectedId}
      builtInCards={builtInCards}
      customCards={customCards}
      pickerOpen={pickerOpen}
      actionsOpen={actionsOpen}
      modified={modified}
      storageUnavailable={storage === null}
      warning={warning}
      error={error}
      saveOpen={saveOpen}
      saveName={saveName}
      manageOpen={manageOpen}
      renameId={renameId}
      renameName={renameName}
      deleteConfirmId={deleteConfirmId}
      actionsPanelId={actionsPanelId}
      actionsRef={actionsRef}
      actionsButtonRef={actionsButtonRef}
      onSelect={handleSelect}
      onPickerOpen={() => {
        setError(null)
        setActionsOpen(false)
        setPickerOpen(true)
      }}
      onPickerClose={() => setPickerOpen(false)}
      onActionsToggle={() => setActionsOpen((open) => !open)}
      onSaveAsOpen={() => {
        setError(null)
        setSaveOpen((open) => !open)
      }}
      onSaveNameChange={setSaveName}
      onSaveAsConfirm={handleSaveAsConfirm}
      onSaveAsCancel={() => {
        setSaveOpen(false)
        setSaveName('')
      }}
      onUpdate={handleUpdate}
      onManageToggle={() => setManageOpen((open) => !open)}
      onRenameStart={(presetId, name) => {
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
