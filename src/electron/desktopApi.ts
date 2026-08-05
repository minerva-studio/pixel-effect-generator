/** Save kinds understood by the desktop file service. */
export type DesktopSaveKind =
  | 'project-json'
  | 'spritesheet-png'
  | 'gif'
  | 'apng'
  | 'frame-zip'
  | 'unity-zip'

/** Result of a native save request. */
export type DesktopSaveResult = { readonly status: 'saved' | 'cancelled' }

/** Result of a native project-open request. */
export type DesktopOpenProjectResult =
  | { readonly status: 'opened'; readonly name: string; readonly text: string }
  | { readonly status: 'cancelled' }

/** Minimal file bridge exposed to the renderer through contextBridge. */
export interface DesktopFileApi {
  readonly isDesktop: true
  saveFile(request: {
    readonly kind: DesktopSaveKind
    readonly suggestedName: string
    readonly bytes: ArrayBuffer
  }): Promise<DesktopSaveResult>
  openProject(): Promise<DesktopOpenProjectResult>
}

declare global {
  interface Window {
    readonly pixelEffectDesktop?: DesktopFileApi
  }
}
