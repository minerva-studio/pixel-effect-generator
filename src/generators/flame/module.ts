import { createGeneratorWorkspace } from '../../components/GeneratorWorkspace'
import { defineGenerator, registerGenerator } from '../registry'
import { FlameControls, FlamePreviewTools } from './controls'
import { DEFAULT_FLAME_PARAMETERS, resizeFlameCanvas } from './model'
import { flameProjectCodec } from './project'
import { flamePresetCapability } from './presets'
import { renderFlameFrames } from './renderer'

export type FlameCategory = 'shape' | 'motion' | 'details'
export const flameModule = defineGenerator({
  definition: { id: 'flame', index: 4, name: 'Flame', description: 'Seamless candle, torch, and campfire loops.' },
  categories: [
    { id: 'shape', label: 'Shape', description: 'Shape and size the flame.' },
    { id: 'motion', label: 'Motion', description: 'Control periodic burning and flow.' },
    { id: 'details', label: 'Details', description: 'Tune the core, bands, and sparks.' },
  ] as const,
  paletteSlots: [{ id: 'flame', labelKey: 'flame.palette.hotCore', minimum: 3, maximum: 6, opaque: true, read: (p) => p.palette, write: (p, palette) => ({ ...p, palette }) }],
  defaultParameters: DEFAULT_FLAME_PARAMETERS,
  projectCodec: flameProjectCodec, presetCapability: flamePresetCapability,
  render: renderFlameFrames,
  readFrameCount: (p) => p.frameCount,
  writeFrameCount: (p, frameCount) => ({ ...p, frameCount }),
  minimumFrameCount: 5, maximumFrameCount: 24,
  readFrameSize: (p) => ({ width: p.canvasWidth, height: p.canvasHeight }),
  minimumFrameSize: { width: 16, height: 16 }, maximumFrameSize: { width: 512, height: 512 },
  resize: resizeFlameCanvas, previewTitle: 'Continuous flame', Controls: FlameControls, PreviewTools: FlamePreviewTools,
})
export const flameGenerator = registerGenerator(flameModule, createGeneratorWorkspace)
