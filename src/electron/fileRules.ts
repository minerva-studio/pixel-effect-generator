import type { DesktopSaveKind } from './desktopApi'

/** Project JSON files larger than this are rejected by the open dialog. */
export const PROJECT_MAX_BYTES = 5 * 1024 * 1024

/** One save rule: native filter plus the enforced file extension. */
export interface SaveSpec {
  readonly extension: string
  readonly filter: { readonly name: string; readonly extensions: readonly string[] }
}

/** Per-kind extension and dialog filter; the renderer cannot inject filters. */
export const SAVE_SPECS: Readonly<Record<DesktopSaveKind, SaveSpec>> = {
  'project-json': { extension: '.json', filter: { name: 'Project JSON', extensions: ['json'] } },
  'spritesheet-png': { extension: '.png', filter: { name: 'PNG image', extensions: ['png'] } },
  gif: { extension: '.gif', filter: { name: 'GIF image', extensions: ['gif'] } },
  apng: { extension: '.png', filter: { name: 'APNG image', extensions: ['png'] } },
  'frame-zip': { extension: '.zip', filter: { name: 'ZIP archive', extensions: ['zip'] } },
  'unity-zip': { extension: '.zip', filter: { name: 'ZIP archive', extensions: ['zip'] } },
}

/**
 * Strips directory parts and invalid filename characters from a suggested
 * name so the renderer can never choose where the file is written, and
 * enforces the kind's extension.
 */
export function sanitizeSuggestedName(name: string, extension: string): string {
  const slashNormalized = String(name).replace(/\\/g, '/')
  const base = slashNormalized.slice(slashNormalized.lastIndexOf('/') + 1)
  const cleaned = base.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').trim().slice(0, 160)
  if (cleaned === '') {
    return `pixel-effect${extension}`
  }
  return cleaned.endsWith(extension) ? cleaned : `${cleaned}${extension}`
}

/** Forces the expected extension on a final save path. */
export function enforceExtension(filePath: string, extension: string): string {
  return filePath.toLowerCase().endsWith(extension.toLowerCase()) ? filePath : `${filePath}${extension}`
}

/** Validates one save request; unknown kinds and bad shapes are rejected. */
export function parseSaveRequest(
  request: unknown,
): { readonly kind: DesktopSaveKind; readonly suggestedName: string; readonly bytes: Uint8Array } | null {
  if (typeof request !== 'object' || request === null) {
    return null
  }
  const record = request as Record<string, unknown>
  if (typeof record.kind !== 'string' || !(record.kind in SAVE_SPECS)) {
    return null
  }
  if (typeof record.suggestedName !== 'string' || !(record.bytes instanceof ArrayBuffer)) {
    return null
  }
  return {
    kind: record.kind as DesktopSaveKind,
    suggestedName: record.suggestedName,
    bytes: new Uint8Array(record.bytes),
  }
}
