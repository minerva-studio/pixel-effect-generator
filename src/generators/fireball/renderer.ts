import type { PixelFrame } from '../../shared/pixel/frame'
import { renderProjectileFrame } from '../projectile/renderer'
import { renderCanonicalFireballFrame } from './canonical'
import { assertValidFireballParameters, classicProjectileParameters, type FireballParameters } from './model'
import { puffFireball } from './particleField'

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
  const canonical = parameters.form === 'puff'
    ? puffFireball(time, parameters.seed, parameters.puff, palette)
    : renderCanonicalFireballFrame(time, parameters.seed,
      parameters.form === 'wrapped' ? parameters.wrapped : parameters.stream,
      parameters.form === 'wrapped' ? 'plasmaBall' : 'teardrop', palette)
  return positionFireball(canonical, parameters)
}

/** The canonical 128 px image is unchanged at defaults; other sizes use nearest-pixel scaling. */
function positionFireball(source: PixelFrame, parameters: FireballParameters): PixelFrame {
  const { canvasWidth: width, canvasHeight: height, size, rotationDegrees } = parameters
  if (width === 128 && height === 128 && size === 15 && rotationDegrees === 0) return source
  const pixels = new Uint8ClampedArray(width * height * 4)
  const scale = size / 15
  const angle = rotationDegrees * Math.PI / 180
  const cosine = Math.cos(angle), sine = Math.sin(angle)
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const dx = (x + 0.5 - width / 2) / scale
    const dy = (y + 0.5 - height / 2) / scale
    const sourceX = Math.floor(64 + dx * cosine + dy * sine)
    const sourceY = Math.floor(64 - dx * sine + dy * cosine)
    if (sourceX < 0 || sourceX >= 128 || sourceY < 0 || sourceY >= 128) continue
    const sourceIndex = (sourceY * 128 + sourceX) * 4
    const targetIndex = (y * width + x) * 4
    pixels[targetIndex] = source.pixels[sourceIndex]
    pixels[targetIndex + 1] = source.pixels[sourceIndex + 1]
    pixels[targetIndex + 2] = source.pixels[sourceIndex + 2]
    pixels[targetIndex + 3] = source.pixels[sourceIndex + 3]
  }
  return { width, height, pixels }
}
