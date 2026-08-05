import type { RgbColor } from '../../shared/pixel/color'

/** Shared effect direction: outward explosion or inward implosion. */
export type EffectMode = 'explosion' | 'implosion'

/** Shared motion curve shaping formation speed and hold behavior. */
export type MotionCurve = 'crisp' | 'balanced' | 'drifting'

/** Shared centered flash-core parameters. */
export interface SharedCoreParameters {
  readonly enabled: boolean
  readonly radius: number
  readonly duration: number
}

/** Shared polar shockwave: complete rings with radial color and squash. */
export interface SharedShockwaveParameters {
  readonly mode: 'none' | 'ring' | 'multiRing'
  readonly colorMode: 'flat' | 'gradient'
  readonly thickness: number
  readonly startRadiusScale: number
  readonly endRadiusScale: number
  readonly startTime: number
  readonly duration: number
  readonly ringCount: number
  readonly ringSpacing: number
  readonly squash: number
  readonly squashAngle: number
}

/** Shared filled tapered tongue (fire jet or energy tongue) parameters. */
export interface SharedTongueParameters {
  readonly enabled: boolean
  readonly count: number
  readonly length: number
  readonly width: number
  readonly curvature: number
  readonly variation: number
}

/** Shared deterministic debris flight parameters. */
export interface SharedFragmentParameters {
  readonly enabled: boolean
  readonly count: number
  readonly minSize: number
  readonly maxSize: number
  readonly travelDistance: number
  readonly tangentialDrift: number
  readonly lifetime: number
}

/** Shared motion-timing group shown in the Motion tab. */
export interface SharedMotionParameters {
  readonly mode: EffectMode
  readonly formationDuration: number
  readonly holdDuration: number
  readonly motionCurve: MotionCurve
  readonly dissolveStart: number
}

/** One resolved shape direction consumed by tongues and directional shockwaves. */
export interface LobeView {
  readonly angle: number
  readonly tipDistance: number
  readonly growth: number
  readonly lengthScale: number
  readonly tongueNoise: number
  readonly curveSign: number
}

/** Depth, axial progress, and owning direction for one sampled pixel. */
export interface SurfaceSample {
  readonly depth: number
  readonly axis: number
  readonly directionIndex: number
}

/** Size-dependent limits shared by both effect families. */
export interface SharedFrameLimits {
  readonly maxRadius: number
  readonly maxFragmentDistance: number
  readonly maxTangentialDrift: number
  readonly maxTongueLength: number
  readonly maxTongueWidth: number
}

/** Common visual material selectors for shared effect layers. */
export type TongueMaterial = 'fire' | 'energy'
export type FragmentMaterial = 'char' | 'shard'

/** Serialized palette value used by deterministic renderers. */
export type Palette = readonly RgbColor[]
