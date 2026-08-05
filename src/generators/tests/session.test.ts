import { describe, expect, it, vi } from 'vitest'
import {
  createDefaultSession,
  createImportedProjectAction,
  createRenderedParametersAction,
  RenderedFrameSet,
  reduceSession,
  type GeneratorModule,
  type GeneratorSession,
  type GeneratorSessionAction,
} from '../contract'
import type { PixelFrame } from '../../shared/pixel/frame'

interface SampleParameters {
  readonly value: number
  readonly frameCount: number
}

type SampleCategory = 'shape' | 'breakup'

const initialFrames = new RenderedFrameSet([sampleFrame(1)])

function sampleSession(): GeneratorSession<SampleParameters, SampleCategory> {
  return {
    parameters: { value: 1, frameCount: 8 },
    frames: initialFrames,
    activeCategory: 'shape',
    frameIndex: 3,
    isPlaying: true,
    previewFps: 12,
  }
}

describe('session reducer', () => {
  it('updates one field without overwriting unrelated session state', () => {
    const nextFrames = new RenderedFrameSet([sampleFrame(9)])
    const updated = reduceSession(sampleSession(), {
      type: 'parameters',
      parameters: { value: 9, frameCount: 8 },
      frames: nextFrames,
    })
    expect(updated.parameters.value).toBe(9)
    expect(updated.frames).toBe(nextFrames)
    expect(updated.activeCategory).toBe('shape')
    expect(updated.frameIndex).toBe(3)
    expect(updated.isPlaying).toBe(true)
    expect(updated.previewFps).toBe(12)
  })

  it('keeps separate generator sessions from overwriting each other', () => {
    const first = reduceSession(sampleSession(), { type: 'category', category: 'breakup' })
    const second = reduceSession({ ...sampleSession(), parameters: { value: 2, frameCount: 5 }, previewFps: 6 }, { type: 'play', isPlaying: false })

    expect(first.parameters.value).toBe(1)
    expect(first.parameters.frameCount).toBe(8)
    expect(first.frameIndex).toBe(3)
    expect(first.isPlaying).toBe(true)
    expect(first.frames).toBe(initialFrames)
    expect(second.parameters.value).toBe(2)
    expect(second.parameters.frameCount).toBe(5)
    expect(second.isPlaying).toBe(false)
    expect(second.previewFps).toBe(6)
    expect(second.frames).toBe(initialFrames)
  })

  it('preserves the rendered frame set for every non-parameter action', () => {
    const session = sampleSession()
    const actions: readonly GeneratorSessionAction<SampleParameters, SampleCategory>[] = [
      { type: 'category', category: 'breakup' },
      { type: 'frame', frameIndex: 5 },
      { type: 'play', isPlaying: false },
      { type: 'fps', previewFps: 18 },
    ]

    for (const action of actions) {
      expect(reduceSession(session, action).frames).toBe(initialFrames)
    }
  })
  it('keeps playback paused when scrubbing to another frame', () => {
    const paused = reduceSession(sampleSession(), { type: 'play', isPlaying: false })
    const scrubbed = reduceSession(paused, { type: 'frame', frameIndex: 6 })

    expect(scrubbed.frameIndex).toBe(6)
    expect(scrubbed.isPlaying).toBe(false)
    expect(scrubbed.frames).toBe(initialFrames)
  })

  it('renders default and changed parameters exactly once before state reduction', () => {
    const render = vi.fn((parameters: SampleParameters) => [sampleFrame(parameters.value)])
    const module = sampleModule(render)

    const session = createDefaultSession(module, 12)
    expect(render).toHaveBeenCalledTimes(1)
    expect(session.frames.read()).toBe(render.mock.results[0].value)

    const action = createRenderedParametersAction(module, { value: 4, frameCount: 6 })
    expect(render).toHaveBeenCalledTimes(2)
    expect(action.type).toBe('parameters')
    if (action.type === 'parameters') {
      expect(action.frames.read()).toBe(render.mock.results[1].value)
    }
  })

  it('does not create a parameter action when rendering fails', () => {
    const failure = new Error('render failed')
    const module = sampleModule(() => { throw failure })

    expect(() => createRenderedParametersAction(module, { value: 2, frameCount: 8 })).toThrow(failure)
  })
})

describe('project import action', () => {
  it('renders imported parameters exactly once and resets the frame index', () => {
    const render = vi.fn((parameters: SampleParameters) => [sampleFrame(parameters.value)])
    const module = sampleModule(render)

    const action = createImportedProjectAction(module, { value: 7, frameCount: 5 }, 18)
    expect(render).toHaveBeenCalledTimes(1)
    expect(action.type).toBe('importProject')
    if (action.type === 'importProject') {
      expect(action.parameters).toEqual({ value: 7, frameCount: 5 })
      expect(action.frames.read()).toBe(render.mock.results[0].value)
      expect(action.previewFps).toBe(18)
      expect(action.frameIndex).toBe(0)
    }
  })

  it('atomically replaces parameters, frames, FPS, and frame index while preserving play and category', () => {
    const nextFrames = new RenderedFrameSet([sampleFrame(7)])
    const updated = reduceSession(sampleSession(), {
      type: 'importProject',
      parameters: { value: 7, frameCount: 5 },
      frames: nextFrames,
      previewFps: 18,
      frameIndex: 0,
    })

    expect(updated.parameters).toEqual({ value: 7, frameCount: 5 })
    expect(updated.frames).toBe(nextFrames)
    expect(updated.previewFps).toBe(18)
    expect(updated.frameIndex).toBe(0)
    expect(updated.isPlaying).toBe(true)
    expect(updated.activeCategory).toBe('shape')
  })

  it('does not return an action when rendering fails', () => {
    const failure = new Error('render failed')
    const module = sampleModule(() => { throw failure })

    expect(() => createImportedProjectAction(module, { value: 2, frameCount: 8 }, 12)).toThrow(failure)
  })
})

function sampleFrame(value: number): PixelFrame {
  const pixels = new Uint8ClampedArray(4)
  pixels[0] = value
  return { width: 1, height: 1, pixels }
}

function sampleModule(
  render: (parameters: SampleParameters) => readonly PixelFrame[],
): GeneratorModule<'sample', SampleParameters, SampleCategory> {
  return {
    definition: { id: 'sample', index: 99, name: 'Sample', description: 'Test generator.' },
    categories: [
      { id: 'shape', label: 'Shape', description: 'Shape controls.' },
      { id: 'breakup', label: 'Breakup', description: 'Breakup controls.' },
    ],
    defaultParameters: { value: 1, frameCount: 8 },
    render,
    readFrameCount: (parameters) => parameters.frameCount,
    readFrameSize: () => ({ width: 1, height: 1 }),
    writeFrameCount: (parameters, frameCount) => ({ ...parameters, frameCount }),
    minimumFrameCount: 1,
    maximumFrameCount: 12,
    previewTitle: 'Sample preview',
    Controls: () => null,
  }
}
