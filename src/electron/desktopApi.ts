/** Save kinds understood by the desktop file service. */
export type DesktopSaveKind =
  | 'project-json'
  | 'spritesheet-png'
  | 'gif'
  | 'apng'
  | 'frame-zip'
  | 'unity-zip'

/** Result of a native save request; only a user-cancelled dialog is cancelled. */
export type DesktopSaveResult =
  | { readonly status: 'saved' }
  | { readonly status: 'cancelled' }
  | { readonly status: 'failed'; readonly error: string }

/** One opaque recent-project entry; paths never leave the main process. */
export interface RecentProject {
  readonly id: string
  readonly name: string
}

/** Result of saving a project through the native file service. */
export type ProjectSaveResult =
  | { readonly status: 'saved'; readonly name: string }
  | { readonly status: 'cancelled' }
  | { readonly status: 'failed'; readonly error: string }

/** Result of opening a project through the native file service. */
export type ProjectOpenResult =
  | { readonly status: 'opened'; readonly id: string; readonly name: string; readonly text: string }
  | { readonly status: 'cancelled' }
  | { readonly status: 'failed'; readonly error: string }

/** Three-way native unsaved-changes choice. */
export type UnsavedChoice = 'save' | 'discard' | 'cancel'

/** Actions triggered by native menu accelerators and routed to the renderer. */
export type DesktopMenuAction = 'new' | 'open' | 'save' | 'saveAs' | 'exit'

/** Localized labels supplied by the renderer for native dialogs. */
export interface UnsavedDialogLabels {
  readonly title: string
  readonly message: string
  readonly save: string
  readonly discard: string
  readonly cancel: string
}

/** Narrow desktop bridge exposed to the renderer through contextBridge. */
export interface DesktopAppApi {
  readonly isDesktop: true
  /** Generic asset save with a fixed per-kind filter and extension. */
  saveFile(request: {
    readonly kind: DesktopSaveKind
    readonly suggestedName: string
    readonly bytes: ArrayBuffer
  }): Promise<DesktopSaveResult>
  readonly window: {
    minimize(): Promise<void>
    toggleMaximize(): Promise<void>
    toggleFullScreen(): Promise<void>
    requestClose(): Promise<void>
    completeCloseSave(saved: boolean): Promise<void>
    isMaximized(): Promise<boolean>
    onMaximizedChanged(listener: (maximized: boolean) => void): () => void
  }
  readonly project: {
    open(): Promise<ProjectOpenResult>
    openRecent(id: string): Promise<ProjectOpenResult>
    confirmOpen(id: string): Promise<void>
    save(bytes: ArrayBuffer): Promise<ProjectSaveResult>
    saveAs(suggestedName: string, bytes: ArrayBuffer): Promise<ProjectSaveResult>
    recent(): Promise<readonly RecentProject[]>
    clearRecent(): Promise<void>
    setDirty(dirty: boolean, labels: UnsavedDialogLabels): Promise<void>
    confirmUnsaved(labels: UnsavedDialogLabels): Promise<UnsavedChoice>
    onMenuAction(listener: (action: DesktopMenuAction) => void): () => void
    onSaveRequested(listener: () => void): () => void
  }
}

declare global {
  interface Window {
    readonly pixelEffectDesktop?: DesktopAppApi
  }
}
