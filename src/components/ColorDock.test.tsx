import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { PaletteSlot } from '../generators/contract'
import { I18nProvider } from '../i18n/I18nProvider'
import type { RgbColor } from '../shared/pixel/color'
import { ColorDockView } from './ColorDock'

const colors: readonly RgbColor[] = [
  { r: 10, g: 20, b: 30, a: 255 },
  { r: 80, g: 90, b: 100, a: 160 },
]

function makeSlot(id: string, max = 4): PaletteSlot<{ palettes: Record<string, readonly RgbColor[]> }> {
  return {
    id,
    labelKey: 'controls.colorDock',
    minimum: 2,
    maximum: max,
    read: (parameters) => parameters.palettes[id],
    write: (parameters, palette) => ({ ...parameters, palettes: { ...parameters.palettes, [id]: palette } }),
  }
}

function markup(slotCount = 1, max = 4, activeColor: { slotId: string; index: number } | null = null, librarySlotId: string | null = null) {
  const slots = Array.from({ length: slotCount }, (_, index) => makeSlot(`slot-${index}`, max))
  const parameters = { palettes: Object.fromEntries(slots.map((slot) => [slot.id, colors])) }
  return renderToStaticMarkup(<I18nProvider><ColorDockView
    slots={slots}
    parameters={parameters}
    activeColor={activeColor}
    onActiveColor={() => undefined}
    librarySlotId={librarySlotId}
    onLibrarySlotChange={() => undefined}
    onParameters={() => undefined}
    updateSlot={() => undefined}
    locked={false}
    onLockedChange={() => undefined}
  /></I18nProvider>)
}

describe('ColorDockView', () => {
  beforeEach(() => vi.stubGlobal('navigator', { language: 'en-US' }))
  afterEach(() => vi.unstubAllGlobals())

  it('renders each palette slot and all its swatches', () => {
    const html = markup(2)
    expect(html.match(/class="color-dock-row"/g)).toHaveLength(2)
    expect(html.match(/class="color-dock-swatch(?: active)?"/g)).toHaveLength(4)
  })

  it('disables adding colors when a slot reaches its maximum', () => {
    const html = markup(1, 2)
    expect(html).toMatch(/class="color-dock-add"[^>]*disabled=""/)
  })

  it('disables moving past either boundary and removing at the minimum', () => {
    const html = markup(1, 4, { slotId: 'slot-0', index: 0 })
    expect(html).toMatch(/aria-label="Move color earlier" disabled=""/)
    expect(html).not.toMatch(/aria-label="Move color later" disabled=""/)
    expect(html).toMatch(/aria-label="Remove" disabled=""/)
  })

  it('disables moving right from the final swatch', () => {
    const html = markup(1, 4, { slotId: 'slot-0', index: 1 })
    expect(html).not.toMatch(/aria-label="Move color earlier" disabled=""/)
    expect(html).toMatch(/aria-label="Move color later" disabled=""/)
  })

  it('gives every slot its own palette menu button and opens only that menu', () => {
    const closed = markup(2)
    expect(closed.match(/class="panel-action color-dock-library"/g)).toHaveLength(2)
    expect(closed).not.toContain('class="palette-menu"')
    const open = markup(2, 4, null, 'slot-1')
    expect(open.match(/class="palette-menu"/g)).toHaveLength(1)
    expect(open.match(/aria-expanded="true"/g)).toHaveLength(1)
    expect(open).toContain('Save current as…')
    expect(open).not.toContain('Apply colors to')
  })

  it('exposes the color lock through aria-pressed', () => {
    const html = markup()
    expect(html).toMatch(/class="color-dock-lock" type="button" aria-pressed="false" aria-label="Lock colors"/)
  })
})
