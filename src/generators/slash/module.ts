import { createGeneratorWorkspace } from '../../components/GeneratorWorkspace'
import { defineGenerator, registerGenerator } from '../registry'
import { SlashControls } from './controls'
import { DEFAULT_SLASH_PARAMETERS, MAX_FRAME_COUNT, MIN_FRAME_COUNT, type SlashParameters } from './model'
import { renderSlashFrames } from './renderer'

export type SlashCategory = 'shape' | 'palette' | 'motion' | 'breakup'

export const SLASH_CATEGORIES = [
  { id: 'shape', label: 'Shape', description: 'Define the arc silhouette, orientation, and perspective.' },
  { id: 'palette', label: 'Palette', description: 'Build the radial color bands from the inner edge outward.' },
  { id: 'motion', label: 'Motion', description: 'Control timing, trail length, and the direction of the sweep.' },
  { id: 'breakup', label: 'Breakup', description: 'Compose dissolve, edge, and fragment modes with deterministic patterns.' },
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
  render: renderSlashFrames,
  readFrameCount: (parameters) => parameters.frameCount,
  writeFrameCount: (parameters, frameCount) => ({ ...parameters, frameCount }),
  minimumFrameCount: MIN_FRAME_COUNT,
  maximumFrameCount: MAX_FRAME_COUNT,
  previewTitle: 'Sweep study',
  frameWidth: 128,
  frameHeight: 128,
  Controls: SlashControls,
})

/** Opaque runtime registration consumed by the App and registry. */
export const slashGenerator = registerGenerator(slashModule, createGeneratorWorkspace)

export { MAX_FRAME_COUNT, MIN_FRAME_COUNT }
