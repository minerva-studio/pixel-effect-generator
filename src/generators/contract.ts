import type { ComponentType } from 'react'
import type { FrameSize, PixelFrame } from '../shared/pixel/frame'
import type { GeneratorProjectCodec, JsonValue } from '../shared/project/types'
import type { FileOperationController } from '../components/fileOperations'
import type { UnityExportSettingsState } from '../components/unitySettings'

/** Navigation metadata for one registered generator with a literal id. */
export interface GeneratorDefinition<Id extends string> {
  readonly id: Id
  readonly index: number
  readonly name: string
  readonly description: string
}

/** One parameter category shown as a tab inside a generator's controls panel. */
export interface GeneratorCategory<Category extends string> {
  readonly id: Category
  readonly label: string
  readonly description: string
}

/** One read-only built-in effect preset. */
export interface GeneratorPreset {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly payload: JsonValue
}

/** Validation result for one preset payload before it is applied. */
export type PresetValidationResult =
  | { readonly ok: true; readonly payload: JsonValue }
  | { readonly ok: false; readonly error: string }

/**
 * Optional per-generator preset capability. Captures the effect-defining
 * parameters (excluding canvas size and frame count), applies a payload onto
 * the current parameters, and re-validates the result.
 */
export interface GeneratorPresetCapability<Parameters> {
  readonly builtIns: readonly GeneratorPreset[]
  capture(parameters: Parameters): JsonValue
  apply(parameters: Parameters, payload: JsonValue): Parameters
  validate(payload: unknown): PresetValidationResult
}

/** Holds the current rendered frames without exposing large pixel buffers to React state inspection. */
export class RenderedFrameSet {
  readonly #frames: readonly PixelFrame[]

  constructor(frames: readonly PixelFrame[]) {
    this.#frames = frames
  }

  /** Returns the immutable frame-array reference produced by the generator. */
  read(): readonly PixelFrame[] {
    return this.#frames
  }
}

/**
 * Fully typed vertical-slice contract for one generator. Generators keep
 * their own Parameters and Category types; erasure happens only inside
 * `registerGenerator`.
 */
export interface GeneratorModule<Id extends string, Parameters, Category extends string> {
  readonly definition: GeneratorDefinition<Id>
  readonly categories: readonly GeneratorCategory<Category>[]
  readonly defaultParameters: Parameters
  /** Optional project persistence codec; without it the Project tab is hidden. */
  readonly projectCodec?: GeneratorProjectCodec<Parameters>
  /** Optional effect presets; without it the preset toolbar is hidden. */
  readonly presetCapability?: GeneratorPresetCapability<Parameters>
  readonly render: (parameters: Parameters) => readonly PixelFrame[]
  readonly readFrameCount: (parameters: Parameters) => number
  readonly writeFrameCount: (parameters: Parameters, frameCount: number) => Parameters
  readonly minimumFrameCount: number
  readonly maximumFrameCount: number
  readonly previewTitle: string
  readonly readFrameSize: (parameters: Parameters) => FrameSize
  readonly minimumFrameSize?: FrameSize
  readonly maximumFrameSize?: FrameSize
  readonly resize?: (
    parameters: Parameters,
    nextSize: FrameSize,
    scaleEffect: boolean,
  ) => Parameters
  readonly Controls: ComponentType<{
    readonly category: Category
    readonly parameters: Parameters
    readonly onChange: (parameters: Parameters) => void
  }>
  /** Optional generator-specific controls rendered below preview timing. */
  readonly PreviewTools?: ComponentType<{
    readonly parameters: Parameters
    readonly onChange: (parameters: Parameters) => void
    readonly onResize?: (nextSize: FrameSize, scaleEffect: boolean) => void
  }>
}

/** Immutable snapshot of the workspace state for one generator. */
export interface GeneratorSession<Parameters, Category extends string> {
  readonly parameters: Parameters
  readonly frames: RenderedFrameSet
  readonly activeCategory: Category
  readonly frameIndex: number
  readonly isPlaying: boolean
  readonly previewFps: number
}

/** Discriminated session updates dispatched from generic workspace components. */
export type GeneratorSessionAction<Parameters, Category extends string> =
  | { readonly type: 'parameters'; readonly parameters: Parameters; readonly frames: RenderedFrameSet }
  | {
      readonly type: 'importProject'
      readonly parameters: Parameters
      readonly frames: RenderedFrameSet
      readonly previewFps: number
      readonly frameIndex: 0
    }
  | { readonly type: 'category'; readonly category: Category }
  | { readonly type: 'frame'; readonly frameIndex: number }
  | { readonly type: 'play'; readonly isPlaying: boolean }
  | { readonly type: 'fps'; readonly previewFps: number }

/** Opaque session tagged with the generator that owns its hidden state. */
export type RegisteredGeneratorSession<Id extends string> = GeneratorSession<unknown, string> & {
  readonly generatorId: Id
}

/** Opaque session action tagged to prevent dispatching it to another generator. */
export interface RegisteredGeneratorAction<Id extends string> {
  readonly generatorId: Id
  readonly action: GeneratorSessionAction<unknown, string>
}

/**
 * Opaque runtime registration produced by `registerGenerator`. The App,
 * registry, and generic workspace only see this surface; Parameters, Category,
 * and session internals stay inside the closure.
 */
export interface RegisteredGenerator<Id extends string> {
  readonly id: Id
  readonly index: number
  readonly name: string
  readonly description: string
  readonly previewTitle: string
  /** Opaque project codec; undefined for generators without project support. */
  readonly projectCodec?: GeneratorProjectCodec<unknown>
  readonly minimumFrameCount: number
  readonly maximumFrameCount: number
  createSession(previewFps: number): RegisteredGeneratorSession<Id>
  /** Renders imported parameters exactly once and returns the opaque action. */
  createImportedAction(parameters: unknown, previewFps: number): RegisteredGeneratorAction<Id>
  reduceSession(
    session: RegisteredGeneratorSession<Id>,
    action: RegisteredGeneratorAction<Id>,
  ): RegisteredGeneratorSession<Id>
  readFrameCount(session: RegisteredGeneratorSession<Id>): number
  readFrameSize(session: RegisteredGeneratorSession<Id>): FrameSize
  readonly Workspace: ComponentType<{
    readonly session: RegisteredGeneratorSession<string>
    readonly selectedGeneratorId: string
    readonly onSelectGenerator: (id: string) => void
    readonly onSessionAction: (action: RegisteredGeneratorAction<string>) => void
    readonly onReset: () => void
    readonly unitySettings: UnityExportSettingsState
    readonly onUnitySettingsChange: (settings: UnityExportSettingsState) => void
    readonly fileOperations: FileOperationController
  }>
}

/** Creates a fresh session from a module's defaults. */
export function createDefaultSession<Parameters, Category extends string>(
  module: GeneratorModule<string, Parameters, Category>,
  previewFps: number,
): GeneratorSession<Parameters, Category> {
  return {
    parameters: module.defaultParameters,
    frames: new RenderedFrameSet(module.render(module.defaultParameters)),
    activeCategory: module.categories[0].id,
    frameIndex: 0,
    isPlaying: true,
    previewFps,
  }
}

/** Renders one new parameter snapshot before it enters React state. */
export function createRenderedParametersAction<Parameters, Category extends string>(
  module: GeneratorModule<string, Parameters, Category>,
  parameters: Parameters,
): GeneratorSessionAction<Parameters, Category> {
  return {
    type: 'parameters',
    parameters,
    frames: new RenderedFrameSet(module.render(parameters)),
  }
}

/**
 * Renders an imported parameter snapshot exactly once and builds the atomic
 * session action. Throws when the renderer rejects the parameters so callers
 * can keep the previous session untouched.
 */
export function createImportedProjectAction<Parameters, Category extends string>(
  module: GeneratorModule<string, Parameters, Category>,
  parameters: Parameters,
  previewFps: number,
): GeneratorSessionAction<Parameters, Category> {
  return {
    type: 'importProject',
    parameters,
    frames: new RenderedFrameSet(module.render(parameters)),
    previewFps,
    frameIndex: 0,
  }
}

/** Validates that an action matches the target session's typed shape. */
export function reduceSession<Parameters, Category extends string>(
  session: GeneratorSession<Parameters, Category>,
  action: GeneratorSessionAction<Parameters, Category>,
): GeneratorSession<Parameters, Category> {
  switch (action.type) {
    case 'parameters':
      return { ...session, parameters: action.parameters, frames: action.frames }
    case 'importProject':
      return {
        ...session,
        parameters: action.parameters,
        frames: action.frames,
        previewFps: action.previewFps,
        frameIndex: action.frameIndex,
      }
    case 'category':
      return { ...session, activeCategory: action.category }
    case 'frame':
      return { ...session, frameIndex: action.frameIndex }
    case 'play':
      return { ...session, isPlaying: action.isPlaying }
    case 'fps':
      return { ...session, previewFps: action.previewFps }
  }
}
