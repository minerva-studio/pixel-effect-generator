export { projectileGenerator, projectileModule, PROJECTILE_CATEGORIES } from './module'
export type { ProjectileCategory } from './module'
export {
  DEFAULT_PROJECTILE_PARAMETERS,
  MAX_AFTERIMAGE_COUNT,
  MAX_BODY_PALETTE_SIZE,
  MAX_ENERGY_PALETTE_SIZE,
  MAX_FRAME_COUNT,
  MAX_LOOP_CYCLES,
  MAX_SPARK_COUNT,
  MIN_FRAME_COUNT,
  PROJECTILE_FRAME_SIZE,
  assertValidProjectileParameters,
} from './model'
export type {
  ArrowMaterial,
  ProjectileFrameLimits,
  ProjectileKind,
  ProjectileParameters,
  TrailMode,
} from './model'
export { renderProjectileFrame, renderProjectileFrames } from './renderer'
export {
  parseProjectileParameters,
  projectileProjectCodec,
  serializeProjectileParameters,
} from './project'
export {
  applyProjectilePreset,
  captureProjectilePreset,
  clampProjectilePresetParameters,
  parseProjectilePresetPayload,
  projectilePresetCapability,
  validateProjectilePreset,
} from './presets'
