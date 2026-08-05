import { normalizeGuid } from '../unity/guid'
import type {
  EffectProjectV1,
  ExportError,
  ExportManifestV1,
  GeneratorProjectCodec,
  JsonValue,
  ProjectExportSettings,
} from './types'

export const PROJECT_SCHEMA = 'minerva.pixel-effect' as const
export const PROJECT_VERSION = 1 as const
export const MANIFEST_SCHEMA = 'minerva.pixel-effect.manifest' as const
export const MANIFEST_VERSION = 1 as const

/** FPS values supported by the preview timing control and project documents. */
export const SUPPORTED_PREVIEW_FPS = [6, 8, 12, 18, 24] as const
export type SupportedPreviewFps = (typeof SUPPORTED_PREVIEW_FPS)[number]

export const MIN_PIXELS_PER_UNIT = 1
export const MAX_PIXELS_PER_UNIT = 1024

/** Success carrying the fully validated project document contents. */
export interface ParsedProjectDocument {
  readonly project: EffectProjectV1<unknown>
  readonly fps: number
  readonly exportSettings: ProjectExportSettings
}

/** Result of parsing a project document from an arbitrary JSON value. */
export type ProjectParseResult =
  | { readonly ok: true; readonly project: ParsedProjectDocument }
  | { readonly ok: false; readonly error: ExportError }

/**
 * Serializes a project document with stable field order, two-space indent,
 * and a trailing newline. Throws when the inputs violate the v1 contract so
 * invalid documents are never written.
 */
export function serializeProjectDocument(
  codec: GeneratorProjectCodec<unknown>,
  parameters: unknown,
  fps: number,
  exportSettings: ProjectExportSettings,
): string {
  validateFps(fps)
  validatePixelsPerUnit(exportSettings.pixelsPerUnit)
  if (exportSettings.guid !== null && normalizeGuid(exportSettings.guid) === null) {
    throw new RangeError('guid must be null or a valid Unity GUID.')
  }
  const document = buildProjectDocument(codec, parameters, fps, exportSettings)
  return `${JSON.stringify(document, null, 2)}\n`
}

/** Builds the typed v1 project document for manifests and downloads. */
export function buildProjectDocument(
  codec: GeneratorProjectCodec<unknown>,
  parameters: unknown,
  fps: number,
  exportSettings: ProjectExportSettings,
): EffectProjectV1 {
  validateFps(fps)
  validatePixelsPerUnit(exportSettings.pixelsPerUnit)
  if (exportSettings.guid !== null && normalizeGuid(exportSettings.guid) === null) {
    throw new RangeError('guid must be null or a valid Unity GUID.')
  }
  return {
    schema: PROJECT_SCHEMA,
    version: PROJECT_VERSION,
    generator: codec.generatorId,
    parameters: codec.serialize(parameters),
    playback: { fps },
    export: {
      unity: {
        pixelsPerUnit: exportSettings.pixelsPerUnit,
        guid: exportSettings.guid === null ? null : normalizeGuid(exportSettings.guid),
      },
    },
  }
}

/**
 * Parses and strictly validates a project document from an unknown JSON
 * value. Unknown extra fields are ignored for forward compatibility; every
 * required v1 field must be present and valid.
 */
export function parseProjectDocument(
  value: unknown,
  codec: GeneratorProjectCodec<unknown>,
): ProjectParseResult {
  const root = readRecord(value, 'INVALID_JSON', 'Project root must be an object.')
  if (!root.ok) {
    return root
  }
  const record = root.value

  const schema = readString(record, 'schema')
  if (schema === undefined) {
    return failure('INVALID_JSON', 'Missing schema field.')
  }
  if (schema !== PROJECT_SCHEMA) {
    return failure('UNSUPPORTED_SCHEMA', `Unexpected schema: ${schema}`)
  }

  const version = readNumber(record, 'version')
  if (version === undefined) {
    return failure('UNSUPPORTED_VERSION', 'Missing version field.')
  }
  if (version !== PROJECT_VERSION) {
    return failure('UNSUPPORTED_VERSION', `Unsupported project version: ${version}`)
  }

  const generator = readString(record, 'generator')
  if (generator !== codec.generatorId) {
    return failure('WRONG_GENERATOR', `Project targets generator: ${generator ?? 'missing'}`)
  }

  if (!('parameters' in record)) {
    return failure('INVALID_PARAMETERS', 'Missing parameters field.')
  }
  let parameters: unknown
  try {
    parameters = codec.parse(record.parameters)
  } catch (error) {
    return failure('INVALID_PARAMETERS', describeError(error))
  }

  const playback = readRecord(record.playback, 'INVALID_FPS', 'playback must be an object.')
  if (!playback.ok) {
    return playback
  }
  const fps = readNumber(playback.value, 'fps')
  if (fps === undefined || !SUPPORTED_PREVIEW_FPS.includes(fps as SupportedPreviewFps)) {
    return failure('INVALID_FPS', `Unsupported FPS: ${String(fps)}`)
  }

  const exportSection = readRecord(record.export, 'INVALID_PPU', 'export must be an object.')
  if (!exportSection.ok) {
    return exportSection
  }
  const unity = readRecord(exportSection.value.unity, 'INVALID_PPU', 'export.unity must be an object.')
  if (!unity.ok) {
    return unity
  }
  const pixelsPerUnit = readNumber(unity.value, 'pixelsPerUnit')
  if (pixelsPerUnit === undefined || !isValidPixelsPerUnit(pixelsPerUnit)) {
    return failure('INVALID_PPU', `Invalid pixelsPerUnit: ${String(pixelsPerUnit)}`)
  }
  const guid = readStringOrNull(unity.value, 'guid')
  if (guid === undefined) {
    return failure('INVALID_GUID', 'Missing guid field.')
  }
  const normalizedGuid = guid === null ? null : normalizeGuid(guid)
  if (guid !== null && normalizedGuid === null) {
    return failure('INVALID_GUID', `Invalid Unity GUID: ${guid}`)
  }

  return {
    ok: true,
    project: {
      project: {
        schema: PROJECT_SCHEMA,
        version: PROJECT_VERSION,
        generator,
        parameters,
        playback: { fps },
        export: { unity: { pixelsPerUnit, guid: normalizedGuid } },
      },
      fps,
      exportSettings: { pixelsPerUnit, guid: normalizedGuid },
    },
  }
}

/** Serializes a manifest with the same stable JSON formatting as projects. */
export function serializeManifestDocument(manifest: ExportManifestV1): string {
  return `${JSON.stringify(manifest, null, 2)}\n`
}

/** Serializes any JSON value with stable formatting for tests and downloads. */
export function serializeJsonValue(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`
}

function validateFps(fps: number): void {
  if (!SUPPORTED_PREVIEW_FPS.includes(fps as SupportedPreviewFps)) {
    throw new RangeError(`Unsupported FPS: ${fps}`)
  }
}

function validatePixelsPerUnit(pixelsPerUnit: number): void {
  if (!isValidPixelsPerUnit(pixelsPerUnit)) {
    throw new RangeError(`pixelsPerUnit must be an integer from ${MIN_PIXELS_PER_UNIT} to ${MAX_PIXELS_PER_UNIT}.`)
  }
}

function isValidPixelsPerUnit(value: number): boolean {
  return Number.isInteger(value) && value >= MIN_PIXELS_PER_UNIT && value <= MAX_PIXELS_PER_UNIT
}

type RecordReadResult =
  | { readonly ok: true; readonly value: Readonly<Record<string, unknown>> }
  | { readonly ok: false; readonly error: ExportError }

function readRecord(value: unknown, code: ExportError['code'], detail: string): RecordReadResult {
  if (!isPlainRecord(value)) {
    return { ok: false, error: { code, detail } }
  }
  return { ok: true, value }
}

function readString(record: Readonly<Record<string, unknown>>, key: string): string | undefined {
  const value = record[key]
  return typeof value === 'string' ? value : undefined
}

function readStringOrNull(record: Readonly<Record<string, unknown>>, key: string): string | null | undefined {
  const value = record[key]
  if (value === null) {
    return null
  }
  return typeof value === 'string' ? value : undefined
}

function readNumber(record: Readonly<Record<string, unknown>>, key: string): number | undefined {
  const value = record[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

/** True for plain objects produced by JSON.parse (no arrays, null, or classes). */
export function isPlainRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function failure(code: ExportError['code'], detail: string): { readonly ok: false; readonly error: ExportError } {
  return { ok: false, error: { code, detail } }
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
