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

export type ExplosionCategory = 'shape' | 'motion' | 'material' | 'effects'

export const EXPLOSION_CATEGORIES = [
  { id: 'shape', label: 'Shape', description: 'Choose the explosion shape and tune its geometry.' },
  { id: 'motion', label: 'Motion', description: 'Set explosion direction, formation, hold, and dissolve timing.' },
  { id: 'material', label: 'Material', description: 'Choose the surface, coverage, volume profile, and surface texture.' },
  { id: 'effects', label: 'Effects', description: 'Configure flash core, shockwave, flame tongues, and fragments.' },
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
  paletteSlots: [{ id: 'explosion', labelKey: 'controls.palette.colors', guideKeys: ['explosion.palette.hotCore', 'explosion.palette.outerEdge'], minimum: 2, maximum: 6, read: (p) => p.palette, write: (p, palette) => ({ ...p, palette }) }],
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
