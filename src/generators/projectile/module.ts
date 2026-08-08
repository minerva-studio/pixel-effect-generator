import { createGeneratorWorkspace } from '../../components/GeneratorWorkspace'
import { defineGenerator, registerGenerator } from '../registry'
import { ProjectileControls, ProjectilePreviewTools } from './controls'
import {
  DEFAULT_PROJECTILE_PARAMETERS,
  MAX_CANVAS_SIZE,
  MAX_FRAME_COUNT,
  MIN_CANVAS_SIZE,
  MIN_FRAME_COUNT,
  resizeProjectileCanvas,
  type ProjectileParameters,
} from './model'
import { renderProjectileFrames } from './renderer'
import { projectilePresetCapability } from './presets'
import { projectileProjectCodec } from './project'

export type ProjectileCategory = 'body' | 'motion' | 'trail' | 'effects' | 'palette'

export const PROJECTILE_CATEGORIES = [
  { id: 'body', label: 'Body', description: 'Pick the projectile body, size, and baked facing.' },
  { id: 'motion', label: 'Motion', description: 'Control loop speed, pulsing, and gentle bobbing.' },
  { id: 'trail', label: 'Trail', description: 'Choose a fire or energy band trailing behind the body.' },
  { id: 'effects', label: 'Effects', description: 'Toggle sparks and afterimages and tune their behavior.' },
  { id: 'palette', label: 'Palette', description: 'Color the solid arrow body and every energy surface.' },
] as const satisfies readonly { id: ProjectileCategory; label: string; description: string }[]

/** Projectile generator registered for navigation, workspace, and exports. */
export const projectileModule = defineGenerator({
  definition: {
    id: 'projectile',
    index: 4,
    name: 'Projectile',
    description: 'Seamless flight loops for fireballs and magic arrows.',
  },
  categories: PROJECTILE_CATEGORIES,
  defaultParameters: DEFAULT_PROJECTILE_PARAMETERS,
  projectCodec: projectileProjectCodec,
  presetCapability: projectilePresetCapability,
  render: renderProjectileFrames,
  readFrameCount: (parameters) => parameters.frameCount,
  readFrameSize: (parameters) => ({ width: parameters.canvasWidth, height: parameters.canvasHeight }),
  writeFrameCount: (parameters, frameCount) => ({ ...parameters, frameCount }),
  minimumFrameSize: { width: MIN_CANVAS_SIZE, height: MIN_CANVAS_SIZE },
  maximumFrameSize: { width: MAX_CANVAS_SIZE, height: MAX_CANVAS_SIZE },
  resize: (parameters: ProjectileParameters, nextSize, scaleEffect) => resizeProjectileCanvas(parameters, nextSize, scaleEffect),
  minimumFrameCount: MIN_FRAME_COUNT,
  maximumFrameCount: MAX_FRAME_COUNT,
  previewTitle: 'Flight loop study',
  Controls: ProjectileControls,
  PreviewTools: ProjectilePreviewTools,
})

/** Opaque runtime registration consumed by the App and registry. */
export const projectileGenerator = registerGenerator(projectileModule, createGeneratorWorkspace)

export { MAX_FRAME_COUNT, MIN_FRAME_COUNT }
