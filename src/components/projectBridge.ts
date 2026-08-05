import type {
  EffectProjectV1,
  ExportError,
  GeneratorProjectCodec,
  ProjectExportSettings,
} from '../shared/project/types'

/** Parsed project import handed to the workspace for atomic commit. */
export interface ParsedProjectImport {
  readonly parameters: unknown
  readonly fps: number
  readonly exportSettings: ProjectExportSettings
}

/** Result of asking the workspace to render and commit an import. */
export type ProjectImportResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly error: ExportError }

/** Typed bridge between ProjectMenu and the generator workspace. */
export interface ProjectBridge {
  readonly codec: GeneratorProjectCodec<unknown>
  readonly buildDocument: (settings: ProjectExportSettings) => EffectProjectV1
  readonly importProject: (project: ParsedProjectImport) => ProjectImportResult
}
