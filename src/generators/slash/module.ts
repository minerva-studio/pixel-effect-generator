import { createGeneratorWorkspace } from '../../components/GeneratorWorkspace'
import { defineGenerator, registerGenerator } from '../registry'
import { SlashControls, SlashPreviewTools } from './controls'
import { MIN_CANVAS_SIZE, MAX_CANVAS_SIZE, DEFAULT_SLASH_PARAMETERS, MAX_FRAME_COUNT, MIN_FRAME_COUNT, resizeSlashCanvas, type SlashParameters } from './model'
import { renderSlashFrames } from './renderer'
import { slashProjectCodec } from './project'
import { slashPresetCapability } from './presets'

export type SlashCategory = 'shape' | 'palette' | 'motion' | 'breakup' | 'fragments'

export const SLASH_CATEGORIES = [
  { id: 'shape', label: 'Shape', description: 'Define the arc silhouette, orientation, and perspective.' },
  { id: 'palette', label: 'Palette', description: 'Build the radial color bands from the inner edge outward.' },
  { id: 'motion', label: 'Motion', description: 'Control timing, trail length, and the direction of the sweep.' },
  { id: 'fragments', label: 'Fragments', description: 'Shape and animate debris released from the trailing edge.' },
  { id: 'breakup', label: 'Breakup', description: 'Control dissolve and outer-edge damage patterns.' },
] as const satisfies readonly { id: SlashCategory; label: string; description: string }[]

/** Slash generator registered once for navigation, workspace, and exports. */
export const slashModule = defineGenerator({
  definition: {
    id: 'slash',
    index: 1,
    name: 'Slash',
    description: 'Animated weapon trails and sweeping attack arcs.',
  },
  categories: SLASH_CATEGORIES,
  defaultParameters: DEFAULT_SLASH_PARAMETERS,
  projectCodec: slashProjectCodec,
  presetCapability: slashPresetCapability,
  render: renderSlashFrames,
  readFrameCount: (parameters) => parameters.frameCount,
  readFrameSize: (parameters) => ({ width: parameters.canvasWidth, height: parameters.canvasHeight }),
  writeFrameCount: (parameters, frameCount) => ({ ...parameters, frameCount }),
  minimumFrameSize: { width: MIN_CANVAS_SIZE, height: MIN_CANVAS_SIZE },
  maximumFrameSize: { width: MAX_CANVAS_SIZE, height: MAX_CANVAS_SIZE },
  resize: (parameters, nextSize, scaleEffect) => resizeSlashCanvas(parameters, nextSize, scaleEffect),
  minimumFrameCount: MIN_FRAME_COUNT,
  maximumFrameCount: MAX_FRAME_COUNT,
  previewTitle: 'Sweep study',
  Controls: SlashControls,
  PreviewTools: SlashPreviewTools,
})

/** Opaque runtime registration consumed by the App and registry. */
export const slashGenerator = registerGenerator(slashModule, createGeneratorWorkspace)

export { MAX_FRAME_COUNT, MIN_FRAME_COUNT }
