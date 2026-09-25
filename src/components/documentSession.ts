import type { RegisteredGenerator, RegisteredGeneratorSession } from '../generators/contract'
import { GENERATOR_REGISTRY } from '../generators/registry'
import { parseProjectDocument } from '../shared/project/document'
import { DEFAULT_UNITY_EXPORT_SETTINGS, type UnityExportSettingsState } from './unitySettings'

/** A fully rendered replacement, prepared before the current document is changed. */
export interface PreparedDocument {
  readonly session: RegisteredGeneratorSession<string>
  readonly unitySettings: UnityExportSettingsState
}

/** Looks up only registered IDs, including when an ID originates in a file. */
export function documentGenerator(id: string): RegisteredGenerator<string> {
  const generator = GENERATOR_REGISTRY.registrations.find((entry) => entry.id === id)
  if (!generator) throw new Error(`Unknown generator: ${id}`)
  return generator
}

/** Starts a new document rather than resuming a previous generator session. */
export function prepareNewDocument(id: string): PreparedDocument {
  const generator = documentGenerator(id)
  return {
    session: generator.createSession(generator.defaultPreviewFps),
    unitySettings: { ...DEFAULT_UNITY_EXPORT_SETTINGS },
  }
}

/** Resolves the file's generator and validates/renders it before committing any state. */
export function prepareOpenedDocument(text: string): PreparedDocument {
  const value: unknown = JSON.parse(text)
  if (!value || typeof value !== 'object' || !('generator' in value) || typeof value.generator !== 'string') {
    throw new Error('Missing generator in project document.')
  }
  const generator = documentGenerator(value.generator)
  if (!generator.projectCodec) throw new Error('This generator does not support project files.')
  const result = parseProjectDocument(value, generator.projectCodec)
  if (!result.ok) throw new Error(result.error.code)
  const { project, fps, exportSettings } = result.project
  const action = generator.createImportedAction(project.parameters, fps)
  return {
    session: generator.reduceSession(generator.createSession(fps), action),
    unitySettings: { pixelsPerUnit: exportSettings.pixelsPerUnit, stableGuid: exportSettings.guid ?? '' },
  }
}
