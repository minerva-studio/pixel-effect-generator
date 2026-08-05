import type { ComponentType } from 'react'
import { slashGenerator } from './slash/module'
import type {
  GeneratorDefinition,
  GeneratorModule,
  GeneratorSession,
  GeneratorSessionAction,
  RegisteredGeneratorAction,
  RegisteredGeneratorSession,
  RegisteredGenerator,
} from './contract'
import { createDefaultSession, reduceSession } from './contract'

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
    minimumFrameCount: module.minimumFrameCount,
    maximumFrameCount: module.maximumFrameCount,
    createSession: (previewFps) => ({
      ...createDefaultSession(module, previewFps),
      generatorId: module.definition.id,
    }) as RegisteredGeneratorSession<Id>,
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

/** Central production registry; only Slash is user-visible today. */
export const GENERATOR_REGISTRY = createGeneratorRegistry([slashGenerator])

export type GeneratorId = (typeof GENERATOR_REGISTRY)['registrations'][number]['id']

/** Navigation catalog derived from the registry, kept in registration order. */
export const GENERATOR_CATALOG = GENERATOR_REGISTRY.definitions
