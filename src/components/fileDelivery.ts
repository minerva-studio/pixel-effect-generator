import type { DesktopAppApi, DesktopSaveKind } from '../electron/desktopApi'
import { downloadBytes, downloadText } from './export'

/** User-facing result of one save operation. */
export type FileSaveResult = 'saved' | 'cancelled' | 'failed'

/** Result of opening a Project JSON file. */
export type FileOpenResult =
  | { readonly status: 'opened'; readonly name: string; readonly text: string }
  | { readonly status: 'cancelled' }

/**
 * Environment-agnostic file delivery: browsers keep the existing download
 * links and hidden file inputs, while the Electron renderer routes every save
 * and Project open through native system dialogs.
 */
export interface FileDelivery {
  readonly isDesktop: boolean
  saveBytes(kind: DesktopSaveKind, suggestedName: string, bytes: ArrayBuffer): Promise<FileSaveResult>
  saveText(kind: DesktopSaveKind, suggestedName: string, text: string): Promise<FileSaveResult>
  openProjectText(): Promise<FileOpenResult>
}

const MIME_BY_KIND: Readonly<Record<DesktopSaveKind, string>> = {
  'project-json': 'application/json',
  'spritesheet-png': 'image/png',
  gif: 'image/gif',
  apng: 'image/png',
  'frame-zip': 'application/zip',
  'unity-zip': 'application/zip',
}

/** Builds the delivery for the current runtime environment. */
export function createFileDelivery(desktopApi: DesktopAppApi | undefined): FileDelivery {
  if (desktopApi !== undefined) {
    return {
      isDesktop: true,
      saveBytes: async (kind, suggestedName, bytes) => {
        const result = await desktopApi.saveFile({ kind, suggestedName, bytes })
        return result.status === 'saved' ? 'saved' : 'cancelled'
      },
      saveText: async (kind, suggestedName, text) => {
        const bytes = new TextEncoder().encode(text).buffer
        const result = await desktopApi.saveFile({ kind, suggestedName, bytes })
        return result.status === 'saved' ? 'saved' : 'cancelled'
      },
      openProjectText: async () => {
        const result = await desktopApi.project.open()
        if (result.status === 'opened') {
          return { status: 'opened', name: result.name, text: result.text }
        }
        return { status: 'cancelled' }
      },
    }
  }
  return {
    isDesktop: false,
    saveBytes: async (kind, suggestedName, bytes) => {
      downloadBytes(new Uint8Array(bytes), suggestedName, MIME_BY_KIND[kind])
      return 'saved'
    },
    saveText: async (kind, suggestedName, text) => {
      downloadText(text, suggestedName, MIME_BY_KIND[kind])
      return 'saved'
    },
    openProjectText: async () => ({ status: 'cancelled' }),
  }
}

/** Reads the desktop bridge safely; undefined in browsers and tests. */
export function getDesktopFileApi(): DesktopAppApi | undefined {
  if (typeof window === 'undefined') {
    return undefined
  }
  return window.pixelEffectDesktop
}
