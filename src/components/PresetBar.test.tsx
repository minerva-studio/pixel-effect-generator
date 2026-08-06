import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { I18nProvider } from '../i18n/I18nProvider'
import { slashPresetCapability } from '../generators/slash/presets'
import { DEFAULT_SLASH_PARAMETERS } from '../generators/slash/model'
import { captureSlashPreset } from '../generators/slash/presets'
import { renderSlashFrames } from '../generators/slash/renderer'
import { createStoredPreset } from '../shared/preset/storage'
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
    managePanelId: 'preset-manage-panel',
    manageRef: { current: null },
    manageButtonRef: { current: null },
    onSelect: () => undefined,
    onPickerOpen: () => undefined,
    onPickerClose: () => undefined,
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
  it('renders a compact toolbar with the current preset name and picker button', () => {
    const markup = viewMarkup(baseViewProps({ customCards }))
    expect(markup).not.toContain('<select')
    expect(markup).not.toContain('preset-card')
    expect(markup).toContain('preset-pick-group')
    expect(markup).toContain('preset-action-row')
    expect(markup).toContain('No preset selected')
    expect(markup).toContain('Select preset…')
    expect(markup).toContain('Save as…')
    expect(markup).toContain('Update')
    expect(markup).toContain('Manage')
  })

  it('shows the selected preset name in the toolbar', () => {
    const markup = viewMarkup(baseViewProps({ selectedId: 'cleanArc', builtInCards }))
    expect(markup).toContain('Clean Arc')
    expect(markup).not.toContain('No preset selected')
  })

  it('opens the picker dialog with grouped preview cards', () => {
    const markup = viewMarkup(baseViewProps({ pickerOpen: true, customCards }))
    expect(markup).toContain('preset-dialog')
    expect(markup).toContain('preset-dialog-close')
    expect(markup).toContain('aria-label="Close preset picker"')
    expect(markup).toContain('>×<')
    expect(markup).toContain('aria-label="Presets"')
    expect(markup).toContain('aria-label="Effect presets"')
    expect(markup).toContain('preset-card')
    expect(markup).toContain('Clean Arc')
    expect(markup).toContain('My Arc')
    expect(markup).toContain('Built-in')
    expect(markup).toContain('Custom')
    expect(markup).toContain('Cancel')
  })

  it('does not render the picker dialog when closed', () => {
    const markup = viewMarkup(baseViewProps())
    expect(markup).not.toContain('preset-dialog')
  })

  it('shows built-in descriptions inside cards and keeps custom cards name-only', () => {
    const markup = viewMarkup(baseViewProps({ pickerOpen: true, customCards }))
    expect(markup).toContain('A clean, low-breakup arc.')
    expect(markup).not.toContain('preset-description')
  })

  it('marks the selected card as pressed', () => {
    const markup = viewMarkup(baseViewProps({ pickerOpen: true, selectedId: 'cleanArc' }))
    expect(markup).toContain('aria-pressed="true"')
    expect(markup).toContain('aria-pressed="false"')
  })

  it('renders Simplified Chinese labels', () => {
    const markup = viewMarkup(baseViewProps({
      pickerOpen: true,
      selectedId: 'cleanArc',
      builtInCards: [card('cleanArc', '干净弧光', '清晰、低破碎的基础刀光。')],
    }), 'zh-CN')
    expect(markup).toContain('效果预设')
    expect(markup).toContain('选择预设…')
    expect(markup).toContain('干净弧光')
    expect(markup).toContain('另存为…')
    expect(markup).toContain('清晰、低破碎的基础刀光。')
  })

  it('shows the Modified badge only when modified', () => {
    const plain = viewMarkup(baseViewProps())
    expect(plain).not.toContain('>Modified<')
    const modified = viewMarkup(baseViewProps({ modified: true }))
    expect(modified).toContain('>Modified<')
    expect(modified.indexOf('preset-pick-group')).toBeLessThan(modified.indexOf('preset-modified'))
    expect(modified.indexOf('preset-modified')).toBeLessThan(modified.indexOf('preset-action-row'))
  })

  it('disables custom actions and explains when storage is unavailable', () => {
    const markup = viewMarkup(baseViewProps({ storageUnavailable: true, warning: false }))
    expect(markup).toContain('Custom presets need browser storage; built-in presets still work.')
    expect((markup.match(/disabled=""/g) ?? []).length).toBe(2)
    expect(markup).toContain('Select preset…')
  })

  it('renders the manage menu with rename, delete, and two-step confirm', () => {
    const markup = viewMarkup(baseViewProps({
      manageOpen: true,
      customCards,
      deleteConfirmId: 'custom-1',
      managePanelId: 'preset-manage-panel',
    }))
    expect(markup).toContain('aria-expanded="true"')
    expect(markup).toContain('aria-controls="preset-manage-panel"')
    expect(markup).toContain('aria-haspopup="dialog"')
    expect(markup).toContain('id="preset-manage-panel"')
    expect(markup).toContain('role="dialog"')
    expect(markup).toContain('aria-label="Manage presets"')
    expect(markup).toContain('Rename')
    expect(markup).toContain('Confirm delete?')
  })

  it('shows alerts and warnings', () => {
    const error = viewMarkup(baseViewProps({ error: 'name too long' }))
    expect(error).toContain('role="alert"')
    expect(error).toContain('name too long')
    const warning = viewMarkup(baseViewProps({ warning: true }))
    expect(warning).toContain('Local preset data was unreadable and was ignored.')
  })
})

describe('PresetBar component', () => {
  it('renders the compact toolbar with the preset picker entry', () => {
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
    expect(markup).toContain('class="preset-bar"')
    expect(markup).not.toContain('preset-card')
    expect(markup).not.toContain('<select')
    expect(markup).toContain('No preset selected')
    expect(markup).toContain('Select preset…')
    expect(markup).toContain('Save as…')
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
