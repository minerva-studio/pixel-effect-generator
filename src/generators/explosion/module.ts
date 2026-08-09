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
import { explosionProjectCodec } from './project'
import { renderExplosionFrames } from './renderer'

export type ExplosionCategory = 'body' | 'motion' | 'material' | 'effects' | 'palette'

export const EXPLOSION_CATEGORIES = [
  { id: 'body', label: 'Body', description: 'Pick the fire shape and tune its size, outline, and surface material.' },
  { id: 'motion', label: 'Motion', description: 'Control direction, formation, hold, dissolve, and the motion curve.' },
  { id: 'material', label: 'Material', description: 'Choose the surface material and tune how it dissolves.' },
  { id: 'effects', label: 'Effects', description: 'Toggle and tune flash core, shockwave, fire jets, and fragments.' },
  { id: 'palette', label: 'Palette', description: 'Order discrete colors from the hot core to the dark edge.' },
] as const satisfies readonly { id: ExplosionCategory; label: string; description: string }[]

/** Experimental layered explosion and implosion generator module. */
export const explosionModule = defineGenerator({
  definition: {
    id: 'explosion',
    index: 2,
    name: 'Explosion',
    description: 'Physical fire, pressure release, rolling fireballs, and retro blasts.',
  },
  categories: EXPLOSION_CATEGORIES,
  defaultParameters: DEFAULT_EXPLOSION_PARAMETERS,
  projectCodec: explosionProjectCodec,
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
