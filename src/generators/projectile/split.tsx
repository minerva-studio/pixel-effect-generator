import { createGeneratorWorkspace } from '../../components/GeneratorWorkspace'
import type { GeneratorPresetCapability } from '../contract'
import { defineGenerator, registerGenerator } from '../registry'
import type { GeneratorProjectCodec, JsonValue } from '../../shared/project/types'
import { ProjectileControls, ProjectilePreviewTools } from './controls'
import {
  DEFAULT_PROJECTILE_PARAMETERS, MAX_BODY_PALETTE_SIZE, MAX_CANVAS_SIZE, MAX_ENERGY_PALETTE_SIZE, MAX_FRAME_COUNT, MIN_BODY_PALETTE_SIZE, MIN_CANVAS_SIZE,
  MIN_ENERGY_PALETTE_SIZE, MIN_FRAME_COUNT, resizeProjectileCanvas, type ProjectileKind, type ProjectileParameters,
} from './model'
import { PROJECTILE_CATEGORIES } from './module'
import {
  applyProjectilePreset, captureProjectilePreset, parseProjectilePresetPayload,
  PROJECTILE_BUILTIN_PRESETS, validateProjectilePreset,
} from './presets'
import { parseProjectileParameters, serializeProjectileParameters } from './project'
import { renderProjectileFrames } from './renderer'

/** Creates one independently persisted arrow or crystal generator from the existing flight renderer. */
export function createSplitProjectileGenerator<Id extends 'arrow' | 'crystal'>(
  id: Id, index: number, name: string, description: string,
) {
  const kind: ProjectileKind = id
  const builtIns = PROJECTILE_BUILTIN_PRESETS.filter((preset) => parseProjectilePresetPayload(preset.payload).kind === kind)
  const defaultParameters = applyProjectilePreset(DEFAULT_PROJECTILE_PARAMETERS, builtIns[0].payload)
  const assertKind = (parameters: ProjectileParameters) => {
    if (parameters.kind !== kind) throw new RangeError(`${id} parameters have the wrong body kind.`)
    return parameters
  }
  const projectCodec: GeneratorProjectCodec<ProjectileParameters> = {
    generatorId: id,
    version: 1,
    serialize: (parameters) => serializeProjectileParameters(assertKind(parameters)),
    parse: (value) => assertKind(parseProjectileParameters(value)),
  }
  const presetCapability: GeneratorPresetCapability<ProjectileParameters> = {
    builtIns,
    capture: (parameters) => captureProjectilePreset(assertKind(parameters)),
    apply: (parameters, payload) => assertKind(applyProjectilePreset(parameters, payload)),
    validate: (payload: unknown) => {
      try {
        const fields = parseProjectilePresetPayload(payload)
        if (fields.kind !== kind) throw new RangeError(`Preset targets ${fields.kind}, not ${kind}.`)
        return validateProjectilePreset(payload)
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : String(error) }
      }
    },
  }
  const module = defineGenerator({
    definition: { id, index, name, description },
    categories: PROJECTILE_CATEGORIES,
    paletteSlots: [
      { id: 'body', labelKey: 'projectile.palette.bodyTitle', minimum: MIN_BODY_PALETTE_SIZE, maximum: MAX_BODY_PALETTE_SIZE, read: (p: ProjectileParameters) => p.bodyPalette, write: (p: ProjectileParameters, bodyPalette) => ({ ...p, bodyPalette }) },
      { id: 'energy', labelKey: 'projectile.palette.energyTitle', minimum: MIN_ENERGY_PALETTE_SIZE, maximum: MAX_ENERGY_PALETTE_SIZE, read: (p: ProjectileParameters) => p.energyPalette, write: (p: ProjectileParameters, energyPalette) => ({ ...p, energyPalette }) },
    ],
    defaultParameters,
    projectCodec,
    presetCapability,
    render: (parameters: ProjectileParameters) => renderProjectileFrames(assertKind(parameters)),
    readFrameCount: (parameters: ProjectileParameters) => parameters.frameCount,
    readFrameSize: (parameters: ProjectileParameters) => ({ width: parameters.canvasWidth, height: parameters.canvasHeight }),
    writeFrameCount: (parameters: ProjectileParameters, frameCount: number) => ({ ...parameters, frameCount }),
    minimumFrameSize: { width: MIN_CANVAS_SIZE, height: MIN_CANVAS_SIZE },
    maximumFrameSize: { width: MAX_CANVAS_SIZE, height: MAX_CANVAS_SIZE },
    resize: (parameters: ProjectileParameters, nextSize: { width: number; height: number }, scaleEffect: boolean) =>
      resizeProjectileCanvas(parameters, nextSize, scaleEffect),
    minimumFrameCount: MIN_FRAME_COUNT,
    maximumFrameCount: MAX_FRAME_COUNT,
    previewTitle: `${name} flight loop`,
    Controls: (props: { category: (typeof PROJECTILE_CATEGORIES)[number]['id']; parameters: ProjectileParameters; onChange: (value: ProjectileParameters) => void }) =>
      <ProjectileControls {...props} allowedKind={kind} />,
    PreviewTools: ProjectilePreviewTools,
  })
  return registerGenerator(module, createGeneratorWorkspace)
}

export const arrowGenerator = createSplitProjectileGenerator('arrow', 5, 'Arrow', 'Solid and energy arrow flight loops.')
export const crystalGenerator = createSplitProjectileGenerator('crystal', 6, 'Crystal', 'Faceted crystal projectile loops.')
