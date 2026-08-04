import type { ComponentType } from 'react'
import { createGeneratorWorkspace } from '../../components/GeneratorWorkspace'
import { defineGenerator, registerGenerator } from '../registry'

export interface BlipParameters {
  readonly intensity: number
  readonly frameCount: number
}

export type BlipCategory = 'core' | 'pattern'

const BlipControls: ComponentType<{
  readonly category: BlipCategory
  readonly parameters: BlipParameters
  readonly onChange: (parameters: BlipParameters) => void
}> = () => null

/** Minimal heterogeneous fixture used only by tests, never user-visible. */
export const blipModule = defineGenerator({
  definition: {
    id: 'blip',
    index: 2,
    name: 'Blip',
    description: 'Minimal test generator with its own canvas and categories.',
  },
  categories: [
    { id: 'core', label: 'Core', description: 'One test category.' },
    { id: 'pattern', label: 'Pattern', description: 'Another test category.' },
  ],
  defaultParameters: { intensity: 1, frameCount: 5 },
  render: (parameters) => Array.from({ length: parameters.frameCount }, () => ({
    width: 8,
    height: 6,
    pixels: new Uint8ClampedArray(8 * 6 * 4),
  })),
  readFrameCount: (parameters) => parameters.frameCount,
  writeFrameCount: (parameters, frameCount) => ({ ...parameters, frameCount }),
  minimumFrameCount: 3,
  maximumFrameCount: 10,
  previewTitle: 'Blip loop',
  frameWidth: 8,
  frameHeight: 6,
  Controls: BlipControls,
})

export const blipGenerator = registerGenerator(blipModule, createGeneratorWorkspace)
