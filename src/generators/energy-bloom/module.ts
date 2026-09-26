import { createGeneratorWorkspace } from '../../components/GeneratorWorkspace'
import { defineGenerator, registerGenerator } from '../registry'
import { BloomControls, BloomPreviewTools } from './controls'
import {
  DEFAULT_BLOOM_PARAMETERS,
  MAX_CANVAS_SIZE,
  MAX_FRAME_COUNT,
  MIN_CANVAS_SIZE,
  MIN_FRAME_COUNT,
  resizeBloomCanvas,
} from './model'
import { bloomPresetCapability } from './presets'
import { renderBloomFrames } from './renderer'

export type BloomCategory = 'shape' | 'motion' | 'material' | 'effects'

export const BLOOM_CATEGORIES = [
  { id: 'shape', label: 'Shape', description: 'Choose the bloom shape and tune its geometry.' },
  { id: 'motion', label: 'Motion', description: 'Set burst direction, formation, hold, and dissolve timing.' },
  { id: 'material', label: 'Material', description: 'Choose the surface, coverage, and surface texture.' },
  { id: 'effects', label: 'Effects', description: 'Toggle and tune flash core, shockwave, energy tongues, and shards.' },
] as const satisfies readonly { id: BloomCategory; label: string; description: string }[]

/** Energy bloom generator registered for navigation, workspace, and exports. */
export const bloomModule = defineGenerator({
  definition: {
    id: 'energyBloom',
    index: 7,
    name: 'Energy Bloom',
    description: 'Petal, star, and corolla energy effects with vivid convergence.',
  },
  categories: BLOOM_CATEGORIES,
  paletteSlots: [{ id: 'energyBloom', labelKey: 'controls.palette.colors', guideKeys: ['energyBloom.palette.hotCore', 'energyBloom.palette.outerEdge'], minimum: 2, maximum: 6, read: (p) => p.palette, write: (p, palette) => ({ ...p, palette }) }],
  defaultParameters: DEFAULT_BLOOM_PARAMETERS,
  presetCapability: bloomPresetCapability,
  render: renderBloomFrames,
  readFrameCount: (parameters) => parameters.frameCount,
  writeFrameCount: (parameters, frameCount) => ({ ...parameters, frameCount }),
  readFrameSize: (parameters) => ({ width: parameters.canvasWidth, height: parameters.canvasHeight }),
  minimumFrameSize: { width: MIN_CANVAS_SIZE, height: MIN_CANVAS_SIZE },
  maximumFrameSize: { width: MAX_CANVAS_SIZE, height: MAX_CANVAS_SIZE },
  resize: (parameters, nextSize, scaleEffect) => resizeBloomCanvas(parameters, nextSize, scaleEffect),
  minimumFrameCount: MIN_FRAME_COUNT,
  maximumFrameCount: MAX_FRAME_COUNT,
  previewTitle: 'Bloom study',
  Controls: BloomControls,
  PreviewTools: BloomPreviewTools,
})

/** Opaque runtime registration consumed by the application registry. */
export const bloomGenerator = registerGenerator(bloomModule, createGeneratorWorkspace)
