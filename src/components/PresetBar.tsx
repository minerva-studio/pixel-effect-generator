import { useEffect, useId, useMemo, useRef, useState, type RefObject } from 'react'
import type { GeneratorPreset, GeneratorPresetCapability } from '../generators/contract'
import { runPresetMigration } from '../generators/presetMigration'
import { useI18n } from '../i18n/I18nProvider'
import { presetDisplayKeys, type TranslateFunction } from '../i18n/messages'
import type { JsonValue } from '../shared/project/types'
import { randomGuid } from '../shared/unity/guid'
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
 * Applies one preset and returns the applied parameters together with the
 * captured baseline of the actual result, so clamping on small canvases never
 * looks like a modification.
 */
export function resolveAppliedPresetBaseline<Parameters>(
  capability: GeneratorPresetCapability<Parameters>,
  parameters: Parameters,
  payload: JsonValue,
): { readonly parameters: Parameters; readonly baseline: JsonValue } {
  const next = capability.apply(parameters, payload)
  return { parameters: next, baseline: capability.capture(next) }
}

interface PresetBarProps<Parameters> {
  readonly capability: GeneratorPresetCapability<Parameters>
  readonly generatorId: string
  readonly parameters: Parameters
  readonly onApply: (parameters: Parameters) => void
}

export interface PresetBarViewProps {
  readonly selectedId: string | null
  readonly generatorId: string
  readonly builtIns: readonly GeneratorPreset[]
  readonly customPresets: readonly StoredPreset[]
  readonly modified: boolean
  readonly storageUnavailable: boolean
  readonly warning: boolean
  readonly error: string | null
  readonly description: string | null
  readonly saveOpen: boolean
  readonly saveName: string
  readonly manageOpen: boolean
  readonly renameId: string | null
  readonly renameName: string
  readonly deleteConfirmId: string | null
  readonly managePanelId: string
  readonly manageRef: RefObject<HTMLDivElement | null>
  readonly manageButtonRef: RefObject<HTMLButtonElement | null>
  readonly onSelect: (presetId: string) => void
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

/** Presentational preset toolbar; rendering depends only on state and props. */
export function PresetBarView({
  selectedId,
  generatorId,
  builtIns,
  customPresets,
  modified,
  storageUnavailable,
  warning,
  error,
  description,
  saveOpen,
  saveName,
  manageOpen,
  renameId,
  renameName,
  deleteConfirmId,
  managePanelId,
  manageRef,
  manageButtonRef,
  onSelect,
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
  const selectedCustom = customPresets.find((preset) => preset.id === selectedId)
  return (
    <div className="preset-bar">
      <div className="preset-bar-row">
        <select
          className="preset-select"
          aria-label={t('presets.selectLabel')}
          value={selectedId ?? ''}
          onChange={(event) => onSelect(event.target.value)}
        >
          <option value="" disabled>{t('presets.placeholder')}</option>
          <optgroup label={t('presets.builtInGroup')}>
            {builtIns.map((preset) => {
              const keys = presetDisplayKeys(generatorId, preset.id)
              return <option value={preset.id} key={preset.id}>{keys ? t(keys.name) : preset.name}</option>
            })}
          </optgroup>
          {customPresets.length > 0 ? (
            <optgroup label={t('presets.customGroup')}>
              {customPresets.map((preset) => <option value={preset.id} key={preset.id}>{preset.name}</option>)}
            </optgroup>
          ) : null}
        </select>
        {modified ? <span className="preset-modified">{t('presets.modified')}</span> : null}
        <button className="secondary-button" type="button" disabled={storageUnavailable} onClick={onSaveAsOpen}>
          {t('presets.saveAs')}
        </button>
        <button className="secondary-button" type="button" disabled={selectedCustom === undefined || storageUnavailable} onClick={onUpdate}>
          {t('presets.update')}
        </button>
        <div className="preset-manage" ref={manageRef}>
          <button
            className="secondary-button"
            type="button"
            ref={manageButtonRef}
            aria-expanded={manageOpen}
            aria-controls={managePanelId}
            aria-haspopup="dialog"
            onClick={onManageToggle}
          >
            {t('presets.manage')}
          </button>
          {manageOpen ? (
            <div className="preset-manage-panel" id={managePanelId} role="dialog" aria-label={t('presets.manageDialogLabel')}>
              {customPresets.length === 0 ? (
                <p className="preset-manage-empty">{t('presets.noCustom')}</p>
              ) : (
                customPresets.map((preset) => (
                  <div className="preset-manage-item" key={preset.id}>
                    {renameId === preset.id ? (
                      <>
                        <input
                          aria-label={t('presets.rename')}
                          value={renameName}
                          maxLength={40}
                          onChange={(event) => onRenameChange(event.target.value)}
                        />
                        <button className="text-button" type="button" onClick={() => onRenameConfirm(preset.id)}>{t('presets.confirm')}</button>
                        <button className="text-button" type="button" onClick={onRenameCancel}>{t('presets.cancel')}</button>
                      </>
                    ) : (
                      <>
                        <span className="preset-manage-name">{preset.name}</span>
                        <button className="text-button" type="button" onClick={() => onRenameStart(preset.id, preset.name)}>{t('presets.rename')}</button>
                        <button className="text-button danger" type="button" onClick={() => onDelete(preset.id)}>
                          {deleteConfirmId === preset.id ? t('presets.confirmDelete') : t('presets.delete')}
                        </button>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
          ) : null}
        </div>
      </div>

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

      {description ? <p className="preset-description">{description}</p> : null}
      {error ? <p className="preset-error" role="alert">{error}</p> : null}
      {warning ? <p className="preset-warning">{t('presets.warning')}</p> : null}
      {storageUnavailable ? <p className="preset-hint">{t('presets.storageHint')}</p> : null}
    </div>
  )
}

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
  const [manageOpen, setManageOpen] = useState(false)
  const [renameId, setRenameId] = useState<string | null>(null)
  const [renameName, setRenameName] = useState('')
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const manageRef = useRef<HTMLDivElement | null>(null)
  const manageButtonRef = useRef<HTMLButtonElement | null>(null)
  const managePanelId = useId()

  useEffect(() => {
    runPresetMigration(generatorId, storage)
    const loaded = readCustomPresets(generatorId, storage, capability.validate)
    setCustomPresets(loaded.presets)
    setWarning(loaded.warning)
  }, [generatorId, storage, capability])

  useEffect(() => {
    if (!manageOpen) {
      return undefined
    }
    const handlePointerDown = (event: PointerEvent) => {
      if (manageRef.current && !manageRef.current.contains(event.target as Node)) {
        setManageOpen(false)
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setManageOpen(false)
        setRenameId(null)
        setDeleteConfirmId(null)
        manageButtonRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [manageOpen])

  const capture = useMemo(() => capability.capture(parameters), [capability, parameters])
  const modified = appliedPayload !== undefined && !payloadsEqual(capture, appliedPayload)
  const selectedBuiltIn = capability.builtIns.find((preset) => preset.id === selectedId)
  const description = selectedBuiltIn ? presetDescription(generatorId, selectedBuiltIn, t) : null

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
      generatorId={generatorId}
      builtIns={capability.builtIns}
      customPresets={customPresets}
      modified={modified}
      storageUnavailable={storage === null}
      warning={warning}
      error={error}
      description={description}
      saveOpen={saveOpen}
      saveName={saveName}
      manageOpen={manageOpen}
      renameId={renameId}
      renameName={renameName}
      deleteConfirmId={deleteConfirmId}
      managePanelId={managePanelId}
      manageRef={manageRef}
      manageButtonRef={manageButtonRef}
      onSelect={handleSelect}
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

/** Returns the translated preset description, or null for custom presets. */
function presetDescription(
  generatorId: string,
  preset: GeneratorPreset,
  t: TranslateFunction,
): string | null {
  const keys = presetDisplayKeys(generatorId, preset.id)
  return keys ? t(keys.description) : preset.description
}
