import { createGeneratorWorkspace } from '../../components/GeneratorWorkspace'
import { defineGenerator, registerGenerator } from '../registry'
import { ExplosionControls, ExplosionPreviewTools } from './controls'
import {
  DEFAULT_EXPLOSION_PARAMETERS,
  MAX_CANVAS_SIZE,
  MAX_FRAME_COUNT,
  MIN_CANVAS_SIZE,
  MIN_FRAME_COUNT,
  resizeExplosionCanvas,
} from './model'
import { explosionPresetCapability } from './presets'
import { renderExplosionFrames } from './renderer'

export type ExplosionCategory = 'shape' | 'palette' | 'motion' | 'fragments' | 'trails'

export const EXPLOSION_CATEGORIES = [
  { id: 'shape', label: 'Shape', description: 'Compose the body, flash core, and shockwave.' },
  { id: 'palette', label: 'Palette', description: 'Order discrete colors from the hot core to the dark edge.' },
  { id: 'motion', label: 'Motion', description: 'Control expansion, convergence, timing, and dissolve.' },
  { id: 'fragments', label: 'Fragments', description: 'Scatter or gather deterministic pixel debris.' },
  { id: 'trails', label: 'Trails', description: 'Shape energy rays or flame strands that travel with the burst.' },
] as const satisfies readonly { id: ExplosionCategory; label: string; description: string }[]

/** Experimental layered explosion and implosion generator module. */
export const explosionModule = defineGenerator({
  definition: {
    id: 'explosion',
    index: 2,
    name: 'Explosion',
    description: 'Layered pixel explosions and converging energy effects.',
  },
  categories: EXPLOSION_CATEGORIES,
  defaultParameters: DEFAULT_EXPLOSION_PARAMETERS,
  presetCapability: explosionPresetCapability,
  render: renderExplosionFrames,
  readFrameCount: (parameters) => parameters.frameCount,
  writeFrameCount: (parameters, frameCount) => ({ ...parameters, frameCount }),
  readFrameSize: (parameters) => ({ width: parameters.canvasWidth, height: parameters.canvasHeight }),
  minimumFrameSize: { width: MIN_CANVAS_SIZE, height: MIN_CANVAS_SIZE },
  maximumFrameSize: { width: MAX_CANVAS_SIZE, height: MAX_CANVAS_SIZE },
  resize: (parameters, nextSize, scaleEffect) => resizeExplosionCanvas(parameters, nextSize, scaleEffect),
  minimumFrameCount: MIN_FRAME_COUNT,
  maximumFrameCount: MAX_FRAME_COUNT,
  previewTitle: 'Radial burst study',
  Controls: ExplosionControls,
  PreviewTools: ExplosionPreviewTools,
})

/** Opaque runtime registration consumed by the application registry. */
export const explosionGenerator = registerGenerator(explosionModule, createGeneratorWorkspace)
