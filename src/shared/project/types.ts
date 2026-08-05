/** Serializable JSON value used by project documents and manifests. */
export type JsonValue =
  | null
  | boolean
  | number
  | string
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue }

/**
 * v1 project document persisted for one generator session. Parameters are
 * opaque JSON data; the owning generator codec converts them to typed state.
 */
export interface EffectProjectV1<Parameters = JsonValue> {
  readonly schema: 'minerva.pixel-effect'
  readonly version: 1
  readonly generator: string
  readonly parameters: Parameters
  readonly playback: {
    readonly fps: number
  }
  readonly export: {
    readonly unity: {
      readonly pixelsPerUnit: number
      readonly guid: string | null
    }
  }
}

/** Unity export settings persisted inside a project document. */
export interface ProjectExportSettings {
  readonly pixelsPerUnit: number
  readonly guid: string | null
}

/** User-distinguishable export/import failures; details stay in logs. */
export type ExportErrorCode =
  | 'PROJECT_FILE_UNREADABLE'
  | 'INVALID_JSON'
  | 'UNSUPPORTED_SCHEMA'
  | 'UNSUPPORTED_VERSION'
  | 'WRONG_GENERATOR'
  | 'INVALID_PARAMETERS'
  | 'INVALID_FPS'
  | 'INVALID_PPU'
  | 'INVALID_GUID'
  | 'UNITY_ATLAS_TOO_LARGE'
  | 'RENDER_FAILED'
  | 'PNG_ENCODING_FAILED'
  | 'ZIP_ENCODING_FAILED'
  | 'ANIMATION_ENCODING_FAILED'
  | 'DOWNLOAD_FAILED'

/** A user-visible export/import failure with a machine-readable code. */
export interface ExportError {
  readonly code: ExportErrorCode
  readonly detail: string
}

/** One sprite rectangle in a packed atlas; coordinates use top-left origin. */
export interface SpriteRect {
  readonly index: number
  readonly name: string
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/** Per-frame output listed inside a manifest for frame-sequence packages. */
export interface FrameSequenceOutput {
  readonly type: 'frame-sequence'
  readonly frameWidth: number
  readonly frameHeight: number
  readonly frameCount: number
  readonly fps: number
  readonly frames: readonly {
    readonly index: number
    readonly name: string
    readonly file: string
  }[]
}

/** Atlas output listed inside a manifest for sprite-sheet packages. */
export interface SpriteSheetOutput {
  readonly type: 'sprite-sheet'
  readonly layout: 'horizontal' | 'compact'
  readonly image: string
  readonly width: number
  readonly height: number
  readonly columns: number
  readonly rows: number
  readonly coordinateOrigin: 'top-left'
  readonly sprites: readonly SpriteRect[]
}

/** Shared envelope for every exported package's manifest.json. */
export interface ExportManifestV1 {
  readonly schema: 'minerva.pixel-effect.manifest'
  readonly version: 1
  readonly generator: string
  readonly project: EffectProjectV1
  readonly output: FrameSequenceOutput | SpriteSheetOutput
}

/**
 * Optional per-generator project codec. Serialize returns plain JSON data
 * without shared references; parse builds a fresh parameter object and must
 * validate it through the generator's own assertion helpers.
 */
export interface GeneratorProjectCodec<Parameters> {
  readonly generatorId: string
  readonly version: number
  serialize(parameters: Parameters): JsonValue
  parse(value: unknown): Parameters
}
