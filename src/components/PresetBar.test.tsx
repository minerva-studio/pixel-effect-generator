import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { I18nProvider } from '../i18n/I18nProvider'
import { slashPresetCapability } from '../generators/slash/presets'
import { DEFAULT_SLASH_PARAMETERS } from '../generators/slash/model'
import { captureSlashPreset } from '../generators/slash/presets'
import { createStoredPreset, type StoredPreset } from '../shared/preset/storage'
import { payloadsEqual, PresetBar, PresetBarView, resolveAppliedPresetBaseline, type PresetBarViewProps } from './PresetBar'

afterEach(() => {
  vi.unstubAllGlobals()
})

const customPresets: readonly StoredPreset[] = [
  createStoredPreset('My Arc', 'slash', { radius: 44 }, 'custom-1'),
  createStoredPreset('Spark', 'slash', { radius: 40 }, 'custom-2'),
]

function baseViewProps(overrides: Partial<PresetBarViewProps> = {}): PresetBarViewProps {
  return {
    selectedId: null,
    generatorId: 'slash',
    builtIns: slashPresetCapability.builtIns,
    customPresets: [],
    modified: false,
    storageUnavailable: false,
    warning: false,
    error: null,
    description: null,
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
  it('renders grouped built-in and custom options with buttons', () => {
    const markup = viewMarkup(baseViewProps({ customPresets }))
    expect(markup).toContain('aria-label="Effect preset"')
    expect(markup).toContain('Presets…')
    expect(markup).toContain('Clean Arc')
    expect(markup).toContain('My Arc')
    expect(markup).toContain('Save as…')
    expect(markup).toContain('Update')
    expect(markup).toContain('Manage')
  })

  it('renders Simplified Chinese labels', () => {
    const markup = viewMarkup(baseViewProps({ selectedId: 'cleanArc', description: '清晰、低破碎的基础刀光。' }), 'zh-CN')
    expect(markup).toContain('效果预设')
    expect(markup).toContain('干净弧光')
    expect(markup).toContain('另存为…')
    expect(markup).toContain('清晰、低破碎的基础刀光。')
  })

  it('shows the Modified badge only when modified', () => {
    const plain = viewMarkup(baseViewProps())
    expect(plain).not.toContain('>Modified<')
    const modified = viewMarkup(baseViewProps({ modified: true }))
    expect(modified).toContain('>Modified<')
  })

  it('disables custom actions and explains when storage is unavailable', () => {
    const markup = viewMarkup(baseViewProps({ storageUnavailable: true, warning: false }))
    expect(markup).toContain('Custom presets need browser storage; built-in presets still work.')
    expect((markup.match(/disabled=""/g) ?? []).length).toBe(3)
  })

  it('renders the manage menu with rename, delete, and two-step confirm', () => {
    const markup = viewMarkup(baseViewProps({
      manageOpen: true,
      customPresets,
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
  it('renders the toolbar with the five translated built-in presets', () => {
    vi.stubGlobal('navigator', undefined)
    const markup = renderToStaticMarkup(
      <I18nProvider>
        <PresetBar
          capability={slashPresetCapability}
          generatorId="slash"
          parameters={DEFAULT_SLASH_PARAMETERS}
          onApply={vi.fn()}
        />
      </I18nProvider>,
    )
    expect(markup).toContain('class="preset-bar"')
    expect(markup).toContain('Clean Arc')
    expect(markup).toContain('Full Circle')
    expect(markup).toContain('Save as…')
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
