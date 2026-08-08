import type { ComponentType } from 'react'
import { slashGenerator } from './slash/module'
import { explosionGenerator } from './explosion/module'
import { bloomGenerator } from './energy-bloom/module'
import { projectileGenerator } from './projectile/module'
import type {
  GeneratorDefinition,
  GeneratorModule,
  GeneratorSession,
  GeneratorSessionAction,
  RegisteredGeneratorAction,
  RegisteredGeneratorSession,
  RegisteredGenerator,
} from './contract'
import type { GeneratorProjectCodec } from '../shared/project/types'
import type { FileOperationController } from '../components/fileOperations'
import type { UnityExportSettingsState } from '../components/unitySettings'
import { createDefaultSession, reduceSession } from './contract'
import { createImportedProjectAction } from './contract'

/** Type-preserving module factory; keeps literal ids like 'slash'. */
export function defineGenerator<Id extends string, Parameters, Category extends string>(
  module: GeneratorModule<Id, Parameters, Category>,
): GeneratorModule<Id, Parameters, Category> {
  return module
}

/**
 * The single type-erasure boundary: binds a module's Parameters, Category, and
 * session inside a closure and exposes a non-generic RegisteredGenerator.
 */
export function registerGenerator<Id extends string, Parameters, Category extends string>(
  module: GeneratorModule<Id, Parameters, Category>,
  createWorkspace: (
    module: GeneratorModule<Id, Parameters, Category>,
    sessionType: GeneratorSession<Parameters, Category>,
  ) => ComponentType<{
    readonly session: RegisteredGeneratorSession<string>
    readonly selectedGeneratorId: string
    readonly onSelectGenerator: (id: string) => void
    readonly onSessionAction: (action: RegisteredGeneratorAction<string>) => void
    readonly onReset: () => void
    readonly unitySettings: UnityExportSettingsState
    readonly onUnitySettingsChange: (settings: UnityExportSettingsState) => void
    readonly fileOperations: FileOperationController
  }>,
): RegisteredGenerator<Id> {
  type Session = GeneratorSession<Parameters, Category>
  type Action = GeneratorSessionAction<Parameters, Category>

  const sessionReducer = (session: RegisteredGeneratorSession<Id>, action: RegisteredGeneratorAction<Id>): RegisteredGeneratorSession<Id> => ({
    ...reduceSession(session as unknown as Session, action.action as Action),
    generatorId: module.definition.id,
  })

  return {
    id: module.definition.id,
    index: module.definition.index,
    name: module.definition.name,
    description: module.definition.description,
    previewTitle: module.previewTitle,
    projectCodec: module.projectCodec as GeneratorProjectCodec<unknown> | undefined,
    minimumFrameCount: module.minimumFrameCount,
    maximumFrameCount: module.maximumFrameCount,
    createSession: (previewFps) => ({
      ...createDefaultSession(module, previewFps),
      generatorId: module.definition.id,
    }) as RegisteredGeneratorSession<Id>,
    createImportedAction: (parameters, previewFps) => {
      const action = createImportedProjectAction(module, parameters as Parameters, previewFps)
      return {
        generatorId: module.definition.id,
        action: action as GeneratorSessionAction<unknown, string>,
      }
    },
    reduceSession: sessionReducer,
    readFrameCount: (session) => module.readFrameCount((session as unknown as Session).parameters),
    readFrameSize: (session) => module.readFrameSize((session as unknown as Session).parameters),
    Workspace: createWorkspace(module, {} as Session),
  }
}

/** One registered runtime entry with its exact literal id preserved. */
export type RegisteredGeneratorById<Registrations extends readonly RegisteredGenerator<string>[]> = {
  readonly [Id in Registrations[number]['id']]: Extract<Registrations[number], { readonly id: Id }>
}

/** Per-generator session record whose keyed types stay precise. */
export type RegisteredSessionRecord<Registrations extends readonly RegisteredGenerator<string>[]> = {
  readonly [Id in Registrations[number]['id']]: RegisteredGeneratorSession<Id>
}

/**
 * Builds a registry from registered generators, validating id and index
 * uniqueness while preserving registration order.
 */
export function createGeneratorRegistry<Registrations extends readonly RegisteredGenerator<string>[]>(
  registrations: Registrations,
): {
  readonly registrations: Registrations
  readonly record: RegisteredGeneratorById<Registrations>
  readonly definitions: readonly GeneratorDefinition<Registrations[number]['id']>[]
  readonly get: <Id extends Registrations[number]['id']>(id: Id) => RegisteredGeneratorById<Registrations>[Id]
  readonly getRegistered: (id: Registrations[number]['id']) => RegisteredGenerator<string>
} {
  const ids = registrations.map((registration) => registration.id)
  const indexes = registrations.map((registration) => registration.index)
  if (new Set(ids).size !== ids.length) {
    throw new Error('Generator ids must be unique.')
  }
  if (new Set(indexes).size !== indexes.length) {
    throw new Error('Generator indexes must be unique.')
  }

  const record = Object.fromEntries(registrations.map((registration) => [registration.id, registration])) as RegisteredGeneratorById<Registrations>
  return {
    registrations,
    record,
    definitions: registrations.map((registration) => ({
      id: registration.id,
      index: registration.index,
      name: registration.name,
      description: registration.description,
    })),
    get: (id) => record[id],
    getRegistered: (id) => record[id] as RegisteredGenerator<string>,
  }
}

/** Seeds one independent session per registered generator. */
export function createDefaultSessionRecord<Registrations extends readonly RegisteredGenerator<string>[]>(
  registry: ReturnType<typeof createGeneratorRegistry<Registrations>>,
  previewFps: number,
): RegisteredSessionRecord<Registrations> {
  return Object.fromEntries(
    registrationsOf(registry).map((registration) => [registration.id, registration.createSession(previewFps)]),
  ) as RegisteredSessionRecord<Registrations>
}

/** Replaces only the target generator's session, preserving every other state. */
export function updateSessionRecord<Registrations extends readonly RegisteredGenerator<string>[]>(
  registrations: RegisteredGeneratorById<Registrations>,
  sessions: RegisteredSessionRecord<Registrations>,
  action: RegisteredGeneratorAction<Registrations[number]['id']>,
): RegisteredSessionRecord<Registrations> {
  const registration = registrations[action.generatorId]
  return {
    ...sessions,
    [action.generatorId]: registration.reduceSession(sessions[action.generatorId], action),
  }
}

function registrationsOf<Registrations extends readonly RegisteredGenerator<string>[]>(
  registry: ReturnType<typeof createGeneratorRegistry<Registrations>>,
): readonly RegisteredGenerator<string>[] {
  return registry.registrations
}

/** Central production registry in navigation order. */
export const GENERATOR_REGISTRY = createGeneratorRegistry([
  slashGenerator,
  explosionGenerator,
  bloomGenerator,
  projectileGenerator,
] as const)

export type GeneratorId = (typeof GENERATOR_REGISTRY)['registrations'][number]['id']

/** Navigation catalog derived from the registry, kept in registration order. */
export const GENERATOR_CATALOG = GENERATOR_REGISTRY.definitions
