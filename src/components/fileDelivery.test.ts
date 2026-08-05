import { describe, expect, it, vi } from 'vitest'
import type { DesktopFileApi } from '../electron/desktopApi'
import { createFileDelivery } from './fileDelivery'

function desktopApi(overrides: Partial<DesktopFileApi> = {}): DesktopFileApi {
  return {
    isDesktop: true,
    saveFile: vi.fn(async () => ({ status: 'saved' as const })),
    openProject: vi.fn(async () => ({ status: 'cancelled' as const })),
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
      openProject: vi.fn(async () => ({ status: 'opened' as const, name: 'a.json', text: '{}' })),
    })
    const delivery = createFileDelivery(api)
    expect(await delivery.openProjectText()).toEqual({ status: 'opened', name: 'a.json', text: '{}' })
  })
})
