import { describe, expect, it, vi } from 'vitest'
import type { DesktopAppApi } from '../electron/desktopApi'
import { createFileDelivery } from './fileDelivery'

function desktopApi(overrides: Partial<DesktopAppApi> = {}): DesktopAppApi {
  return {
    isDesktop: true,
    saveFile: vi.fn(async () => ({ status: 'saved' as const })),
    window: {
      minimize: vi.fn(async () => undefined),
      toggleMaximize: vi.fn(async () => undefined),
      toggleFullScreen: vi.fn(async () => undefined),
      requestClose: vi.fn(async () => undefined),
      isMaximized: vi.fn(async () => false),
      onMaximizedChanged: vi.fn(() => () => undefined),
    },
    project: {
      open: vi.fn(async () => ({ status: 'cancelled' as const })),
      openRecent: vi.fn(async () => ({ status: 'cancelled' as const })),
      confirmOpen: vi.fn(async () => undefined),
      save: vi.fn(async () => ({ status: 'cancelled' as const })),
      saveAs: vi.fn(async () => ({ status: 'cancelled' as const })),
      recent: vi.fn(async () => []),
      clearRecent: vi.fn(async () => undefined),
      setDirty: vi.fn(async () => undefined),
      confirmUnsaved: vi.fn(async () => 'cancel' as const),
      onMenuAction: vi.fn(() => () => undefined),
      onSaveRequested: vi.fn(() => () => undefined),
    },
    ...overrides,
  }
}

describe('createFileDelivery', () => {
  it('selects the browser delivery when no desktop bridge exists', async () => {
    const delivery = createFileDelivery(undefined)
    expect(delivery.isDesktop).toBe(false)
    expect(await delivery.openProjectText()).toEqual({ status: 'cancelled' })
  })

  it('delegates desktop saves with the kind, suggested name, and bytes', async () => {
    const api = desktopApi()
    const delivery = createFileDelivery(api)
    expect(delivery.isDesktop).toBe(true)
    const bytes = new Uint8Array([1, 2, 3]).buffer
    expect(await delivery.saveBytes('spritesheet-png', 'sheet.png', bytes)).toBe('saved')
    expect(api.saveFile).toHaveBeenCalledWith({ kind: 'spritesheet-png', suggestedName: 'sheet.png', bytes })
  })

  it('maps cancelled native dialogs to cancelled results without failing', async () => {
    const api = desktopApi({ saveFile: vi.fn(async () => ({ status: 'cancelled' as const })) })
    const delivery = createFileDelivery(api)
    expect(await delivery.saveText('project-json', 'p.json', '{}')).toBe('cancelled')
    expect(await delivery.saveBytes('gif', 'a.gif', new Uint8Array([1]).buffer)).toBe('cancelled')
  })

  it('passes through desktop project open results', async () => {
    const api = desktopApi({
      project: {
        ...desktopApi().project,
        open: vi.fn(async () => ({ status: 'opened' as const, id: 'token', name: 'a.json', text: '{}' })),
      },
    })
    const delivery = createFileDelivery(api)
    expect(await delivery.openProjectText()).toEqual({ status: 'opened', name: 'a.json', text: '{}' })
  })
})
