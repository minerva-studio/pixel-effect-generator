import { createGeneratorWorkspace } from '../../components/GeneratorWorkspace'
import { defineGenerator, registerGenerator } from '../registry'
import { FireballControls, FireballPreviewTools, type FireballCategory } from './controls'
import { DEFAULT_FIREBALL_PARAMETERS, resizeFireballCanvas, type FireballParameters } from './model'
import { fireballPresetCapability } from './presets'
import { fireballProjectCodec } from './project'
import { renderFireballFrames } from './renderer'
import { MAX_CANVAS_SIZE, MAX_FRAME_COUNT, MIN_CANVAS_SIZE, MIN_FRAME_COUNT } from '../projectile/model'

const categories = [
  { id: 'shape', label: 'Shape', description: 'Choose the fireball form and baked facing.' },
  { id: 'motion', label: 'Motion', description: 'Control the continuous flight loop.' },
  { id: 'trail', label: 'Trail', description: 'Tune wrapped bands and shedding fire.' },
  { id: 'effects', label: 'Material', description: 'Choose the core and smoke treatment.' },
  { id: 'palette', label: 'Palette', description: 'Edit the fire, smoke, and rock colors.' },
] as const satisfies readonly { id: FireballCategory; label: string; description: string }[]

export const fireballModule = defineGenerator({
  definition: { id: 'fireball', index: 4, name: 'Fireball', description: 'Continuous fireball flight loops in four forms.' },
  categories,
  defaultParameters: DEFAULT_FIREBALL_PARAMETERS,
  defaultPreviewFps: 20,
  projectCodec: fireballProjectCodec,
  presetCapability: fireballPresetCapability,
  render: renderFireballFrames,
  readFrameCount: (parameters: FireballParameters) => parameters.frameCount,
  readFrameSize: (parameters: FireballParameters) => ({ width: parameters.canvasWidth, height: parameters.canvasHeight }),
  writeFrameCount: (parameters: FireballParameters, frameCount: number) => ({ ...parameters, frameCount }),
  minimumFrameSize: { width: MIN_CANVAS_SIZE, height: MIN_CANVAS_SIZE },
  maximumFrameSize: { width: MAX_CANVAS_SIZE, height: MAX_CANVAS_SIZE },
  resize: resizeFireballCanvas,
  minimumFrameCount: MIN_FRAME_COUNT,
  maximumFrameCount: MAX_FRAME_COUNT,
  previewTitle: 'Fireball flight loop',
  Controls: FireballControls,
  PreviewTools: FireballPreviewTools,
})

export const fireballGenerator = registerGenerator(fireballModule, createGeneratorWorkspace)
