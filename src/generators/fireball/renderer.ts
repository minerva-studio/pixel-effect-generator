import type { PixelFrame } from '../../shared/pixel/frame'
import { renderProjectileFrame, sparkParticles } from '../projectile/renderer'
import { renderCanonicalFireballFrame } from './canonical'
import { assertValidFireballParameters, classicProjectileParameters, type FireballParameters } from './model'
import { puffFireball } from './particleField'
import { toReference, toTarget, type FireballView } from './view'

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
    const rearReach = !classic.trailEnabled || classic.trailMode === 'off' ? frontReach * (1 + classic.fireRearExtension * 0.45)
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
  const frame = parameters.form === 'puff'
    ? puffFireball(time, parameters.seed, parameters.puff, palette, view)
    : renderCanonicalFireballFrame(time, parameters.seed,
      parameters.form === 'wrapped' ? parameters.wrapped : parameters.stream,
      parameters.form === 'wrapped' ? 'plasmaBall' : 'teardrop', palette, 'current', view)
  if (parameters.sparks.sparksEnabled) drawSparksBehind(frame, parameters, view, cycleTime)
  return frame
}

/** Head centre (reference x, y = 64) and radius of each studied form in the 128 px reference. */
const HEADS = { stream: { x: 87, radius: 14.5 }, wrapped: { x: 84, radius: 15 }, puff: { x: 94, radius: 14 } } as const

/**
 * Classic's trailing sparks, streaming back from the rear of the head through the wake. As in
 * classic they are drawn over the wake but under the head, and scale with the fireball.
 */
function drawSparksBehind(frame: PixelFrame, parameters: FireballParameters, view: FireballView, cycleTime: number) {
  if (parameters.form === 'classic') return
  const head = HEADS[parameters.form]
  const phase = Math.PI * 2 * parameters.loopCycles * cycleTime
  const sparks = sparkParticles(parameters.sparks, parameters.seed, parameters.loopCycles, head.radius,
    -head.radius * 0.7, head.radius * 3.6, cycleTime, phase)
  const { width, height, pixels } = frame
  for (const spark of sparks) {
    const color = parameters.warmPalette[spark.hot ? 0 : 1]
    const size = Math.max(1, Math.round(spark.size * view.scale))
    const center = toTarget(view, head.x + spark.x, 64 + spark.y)
    const left = Math.round(center.x - size / 2), top = Math.round(center.y - size / 2)
    for (let y = Math.max(1, top); y < Math.min(height - 1, top + size); y++) {
      for (let x = Math.max(1, left); x < Math.min(width - 1, left + size); x++) {
        const offset = (y * width + x) * 4
        const reference = toReference(view, x, y)
        if (pixels[offset + 3] && Math.hypot(reference.x - head.x, reference.y - 64) < head.radius) continue
        pixels.set([color.r, color.g, color.b, color.a], offset)
      }
    }
  }
}
