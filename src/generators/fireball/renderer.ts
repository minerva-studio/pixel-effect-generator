import type { PixelFrame } from '../../shared/pixel/frame'
import { renderProjectileFrame } from '../projectile/renderer'
import { renderCanonicalFireballFrame } from './canonical'
import { assertValidFireballParameters, classicProjectileParameters, type FireballParameters } from './model'
import { puffFireball } from './particleField'
import type { FireballView } from './view'

/** Samples a deterministic, seamless flight loop in [0, 1). */
export function renderFireballFrames(parameters: FireballParameters): PixelFrame[] {
  assertValidFireballParameters(parameters)
  return Array.from({ length: parameters.frameCount }, (_, index) =>
    renderFireballFrame(parameters, index / parameters.frameCount))
}

/** Renders one form without compositing legacy trails onto the reviewed studies. */
export function renderFireballFrame(parameters: FireballParameters, cycleTime: number): PixelFrame {
  assertValidFireballParameters(parameters)
  if (parameters.form === 'classic') {
    const classic = classicProjectileParameters(parameters)
    const frontReach = Math.max(classic.radius * 0.8, classic.bodyLength / 2)
    const rearReach = classic.trailMode === 'off' ? frontReach * (1 + classic.fireRearExtension * 0.45)
      : frontReach * (1 + classic.fireRearExtension * 0.45) * 0.58 + classic.trailLength * classic.radius * 5
    const forwardOffset = Math.max(0, (rearReach - frontReach) / 2)
    return renderProjectileFrame(classic, cycleTime, forwardOffset)
  }
  const time = cycleTime * parameters.loopCycles
  const palette = { warm: parameters.warmPalette, smoke: parameters.smokePalette }
  const angle = parameters.rotationDegrees * Math.PI / 180
  const view: FireballView = {
    width: parameters.canvasWidth,
    height: parameters.canvasHeight,
    scale: parameters.size / 15,
    cos: Math.cos(angle),
    sin: Math.sin(angle),
  }
  return parameters.form === 'puff'
    ? puffFireball(time, parameters.seed, parameters.puff, palette, view)
    : renderCanonicalFireballFrame(time, parameters.seed,
      parameters.form === 'wrapped' ? parameters.wrapped : parameters.stream,
      parameters.form === 'wrapped' ? 'plasmaBall' : 'teardrop', palette, 'current', view)
}
