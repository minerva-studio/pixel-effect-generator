import type { ComponentType } from 'react'
import type { FrameSize, PixelFrame } from '../shared/pixel/frame'

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
  readonly minimumFrameCount: number
  readonly maximumFrameCount: number
  createSession(previewFps: number): RegisteredGeneratorSession<Id>
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

/** Validates that an action matches the target session's typed shape. */
export function reduceSession<Parameters, Category extends string>(
  session: GeneratorSession<Parameters, Category>,
  action: GeneratorSessionAction<Parameters, Category>,
): GeneratorSession<Parameters, Category> {
  switch (action.type) {
    case 'parameters':
      return { ...session, parameters: action.parameters, frames: action.frames }
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
