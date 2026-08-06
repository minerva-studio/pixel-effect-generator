import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { I18nProvider } from '../i18n/I18nProvider'
import { slashPresetCapability } from '../generators/slash/presets'
import { DEFAULT_SLASH_PARAMETERS } from '../generators/slash/model'
import { captureSlashPreset } from '../generators/slash/presets'
import { renderSlashFrames } from '../generators/slash/renderer'
import {
  payloadsEqual,
  PresetBar,
  PresetBarView,
  presetPreviewKey,
  renderPresetFrames,
  resolveAppliedPresetBaseline,
  type PresetBarViewProps,
  type PresetPreviewCard,
} from './PresetBar'

afterEach(() => {
  vi.unstubAllGlobals()
})

function card(id: string, name: string, description: string | null = null, custom = false): PresetPreviewCard {
  return { id, name, description, custom, buildFrames: () => [] }
}

const builtInCards: readonly PresetPreviewCard[] = [
  card('cleanArc', 'Clean Arc', 'A clean, low-breakup arc.'),
  card('fullCircle', 'Full Circle'),
]

const customCards: readonly PresetPreviewCard[] = [
  card('custom-1', 'My Arc', null, true),
  card('custom-2', 'Spark', null, true),
]

function baseViewProps(overrides: Partial<PresetBarViewProps> = {}): PresetBarViewProps {
  return {
    selectedId: null,
    builtInCards,
    customCards: [],
    pickerOpen: false,
    actionsOpen: false,
    modified: false,
    storageUnavailable: false,
    warning: false,
    error: null,
    saveOpen: false,
    saveName: '',
    manageOpen: false,
    renameId: null,
    renameName: '',
    deleteConfirmId: null,
    actionsPanelId: 'preset-actions-panel',
    actionsRef: { current: null },
    actionsButtonRef: { current: null },
    onSelect: () => undefined,
    onPickerOpen: () => undefined,
    onPickerClose: () => undefined,
    onActionsToggle: () => undefined,
    onSaveAsOpen: () => undefined,
    onSaveNameChange: () => undefined,
    onSaveAsConfirm: () => undefined,
    onSaveAsCancel: () => undefined,
    onUpdate: () => undefined,
    onManageToggle: () => undefined,
    onRenameStart: () => undefined,
    onRenameChange: () => undefined,
    onRenameConfirm: () => undefined,
    onRenameCancel: () => undefined,
    onDelete: () => undefined,
    ...overrides,
  }
}

function viewMarkup(props: PresetBarViewProps, locale: 'en' | 'zh-CN' = 'en'): string {
  vi.stubGlobal('navigator', locale === 'zh-CN' ? { language: 'zh-CN' } : undefined)
  return renderToStaticMarkup(
    <I18nProvider>
      <PresetBarView {...props} />
    </I18nProvider>,
  )
}

describe('payloadsEqual', () => {
  it('compares captured payloads with stable key order', () => {
    expect(payloadsEqual({ radius: 44, direction: 'clockwise' }, { radius: 44, direction: 'clockwise' })).toBe(true)
    expect(payloadsEqual({ radius: 44 }, { radius: 45 })).toBe(false)
  })
})

describe('PresetBarView structure', () => {
  it('renders compact header controls without a standalone panel or select', () => {
    const markup = viewMarkup(baseViewProps())
    expect(markup).not.toContain('<select')
    expect(markup).not.toContain('preset-card')
    expect(markup).not.toContain('preset-bar')
    expect(markup).not.toContain('preset-panel')
    expect(markup).not.toContain('Select preset…')
    expect(markup).toContain('preset-actions')
    expect(markup).toContain('>Presets<')
  })

  it('opens the actions menu with save, update, and manage entries', () => {
    const markup = viewMarkup(baseViewProps({ actionsOpen: true, customCards }))
    expect(markup).toContain('preset-actions-panel')
    expect(markup).toContain('aria-label="Presets"')
    expect(markup).toContain('Select preset…')
    expect(markup).toContain('Save as…')
    expect(markup).toContain('Update')
    expect(markup).toContain('Manage')
  })

  it('shows the Modified badge inside the actions menu only when modified', () => {
    const plain = viewMarkup(baseViewProps({ actionsOpen: true }))
    expect(plain).not.toContain('>Modified<')
    const modified = viewMarkup(baseViewProps({ actionsOpen: true, modified: true }))
    expect(modified).toContain('>Modified<')
  })

  it('expands the save row and manage list inside the actions menu', () => {
    const save = viewMarkup(baseViewProps({ actionsOpen: true, saveOpen: true }))
    expect(save).toContain('preset-save-row')
    expect(save).toContain('Save')
    const manage = viewMarkup(baseViewProps({ actionsOpen: true, manageOpen: true, customCards }))
    expect(manage).toContain('preset-manage-list')
    expect(manage).toContain('My Arc')
  })

  it('opens the picker dialog with grouped preview cards', () => {
    const markup = viewMarkup(baseViewProps({ pickerOpen: true, customCards }))
    expect(markup).toContain('preset-dialog')
    expect(markup).toContain('preset-dialog-close')
    expect(markup).toContain('aria-label="Close preset picker"')
    expect(markup).toContain('aria-label="Presets"')
    expect(markup).toContain('preset-card')
    expect(markup).toContain('Clean Arc')
    expect(markup).toContain('My Arc')
    expect(markup).toContain('Cancel')
  })

  it('marks the selected card as pressed', () => {
    const markup = viewMarkup(baseViewProps({ pickerOpen: true, selectedId: 'cleanArc' }))
    expect(markup).toContain('aria-pressed="true"')
    expect(markup).toContain('aria-pressed="false"')
  })

  it('renders Simplified Chinese labels', () => {
    const markup = viewMarkup(baseViewProps({ actionsOpen: true, pickerOpen: true }), 'zh-CN')
    expect(markup).toContain('选择预设…')
    expect(markup).toContain('>预设<')
    expect(markup).toContain('效果预设')
  })

  it('disables custom actions and explains when storage is unavailable', () => {
    const markup = viewMarkup(baseViewProps({ actionsOpen: true, storageUnavailable: true, warning: false }))
    expect(markup).toContain('Custom presets need browser storage; built-in presets still work.')
    expect((markup.match(/disabled=""/g) ?? []).length).toBe(2)
    expect(markup).toContain('Select preset…')
  })

  it('shows alerts and warnings inside the actions menu', () => {
    const error = viewMarkup(baseViewProps({ actionsOpen: true, error: 'name too long' }))
    expect(error).toContain('role="alert"')
    expect(error).toContain('name too long')
    const warning = viewMarkup(baseViewProps({ actionsOpen: true, warning: true }))
    expect(warning).toContain('Local preset data was unreadable and was ignored.')
  })
})

describe('PresetBar component', () => {
  it('renders compact header controls without opening panels by default', () => {
    vi.stubGlobal('navigator', undefined)
    const markup = renderToStaticMarkup(
      <I18nProvider>
        <PresetBar
          capability={slashPresetCapability}
          generatorId="slash"
          parameters={DEFAULT_SLASH_PARAMETERS}
          render={renderSlashFrames}
          frameSize={{ width: DEFAULT_SLASH_PARAMETERS.canvasWidth, height: DEFAULT_SLASH_PARAMETERS.canvasHeight }}
          frameCount={DEFAULT_SLASH_PARAMETERS.frameCount}
          onApply={vi.fn()}
        />
      </I18nProvider>,
    )
    expect(markup).not.toContain('Select preset…')
    expect(markup).toContain('>Presets<')
    expect(markup).not.toContain('preset-card')
    expect(markup).not.toContain('preset-actions-panel')
    expect(markup).not.toContain('<select')
  })
})

describe('renderPresetFrames', () => {
  it('renders a built-in preset on the active canvas', () => {
    const cleanArc = slashPresetCapability.builtIns[0]
    const frames = renderPresetFrames(
      slashPresetCapability,
      renderSlashFrames,
      DEFAULT_SLASH_PARAMETERS,
      cleanArc.payload,
    )
    expect(frames).toHaveLength(DEFAULT_SLASH_PARAMETERS.frameCount)
    expect(frames[0].width).toBe(DEFAULT_SLASH_PARAMETERS.canvasWidth)
    expect(frames[0].height).toBe(DEFAULT_SLASH_PARAMETERS.canvasHeight)
  })

  it('throws for payloads that cannot be applied', () => {
    expect(() => renderPresetFrames(
      slashPresetCapability,
      renderSlashFrames,
      DEFAULT_SLASH_PARAMETERS,
      { radius: 'not-a-number' },
    )).toThrow(RangeError)
  })

  it('renders a captured custom payload on the active canvas', () => {
    const custom = captureSlashPreset(DEFAULT_SLASH_PARAMETERS)
    const frames = renderPresetFrames(
      slashPresetCapability,
      renderSlashFrames,
      { ...DEFAULT_SLASH_PARAMETERS, canvasWidth: 64, canvasHeight: 64 },
      custom,
    )
    expect(frames).toHaveLength(DEFAULT_SLASH_PARAMETERS.frameCount)
    expect(frames[0].width).toBe(64)
  })
})

describe('presetPreviewKey', () => {
  it('varies by generator, preset, canvas size, and frame count', () => {
    const base = { width: 128, height: 128 }
    expect(presetPreviewKey('slash', 'cleanArc', base, 10))
      .toBe('slash:cleanArc:128x128x10')
    expect(presetPreviewKey('slash', 'fullCircle', base, 10))
      .not.toBe(presetPreviewKey('slash', 'cleanArc', base, 10))
    expect(presetPreviewKey('slash', 'cleanArc', { width: 256, height: 256 }, 10))
      .not.toBe(presetPreviewKey('slash', 'cleanArc', base, 10))
    expect(presetPreviewKey('slash', 'cleanArc', base, 16))
      .not.toBe(presetPreviewKey('slash', 'cleanArc', base, 10))
    expect(presetPreviewKey('explosion', 'cleanArc', base, 10))
      .not.toBe(presetPreviewKey('slash', 'cleanArc', base, 10))
  })
})

describe('resolveAppliedPresetBaseline', () => {
  const cleanArc = slashPresetCapability.builtIns[0]

  it('clamps Clean Arc on a 32×32 canvas and bases the comparison on the result', () => {
    const small = { ...DEFAULT_SLASH_PARAMETERS, canvasWidth: 32, canvasHeight: 32 }
    const { parameters: next, baseline } = resolveAppliedPresetBaseline(slashPresetCapability, small, cleanArc.payload)
    expect(next.radius).toBe(16)
    expect(JSON.stringify(baseline)).toBe(JSON.stringify(captureSlashPreset(next)))
    expect(JSON.stringify(baseline)).not.toBe(JSON.stringify(cleanArc.payload))
    expect(payloadsEqual(captureSlashPreset(next), baseline)).toBe(true)
  })

  it('reports Modified only after an effect field changes', () => {
    const { parameters: next, baseline } = resolveAppliedPresetBaseline(
      slashPresetCapability,
      DEFAULT_SLASH_PARAMETERS,
      cleanArc.payload,
    )
    expect(payloadsEqual(captureSlashPreset(next), baseline)).toBe(true)
    const edited = { ...next, radius: 20 }
    expect(payloadsEqual(captureSlashPreset(edited), baseline)).toBe(false)
  })

  it('does not report Modified for canvas size or frame count changes', () => {
    const { parameters: next, baseline } = resolveAppliedPresetBaseline(
      slashPresetCapability,
      DEFAULT_SLASH_PARAMETERS,
      cleanArc.payload,
    )
    const resized = { ...next, canvasWidth: 256, canvasHeight: 256, frameCount: 16 }
    expect(payloadsEqual(captureSlashPreset(resized), baseline)).toBe(true)
  })
})
