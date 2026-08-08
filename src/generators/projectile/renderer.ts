import type { PixelFrame } from '../../shared/pixel/frame'
import type { RgbColor } from '../../shared/pixel/color'
import { clamp01, hashUnit } from '../../shared/pixel/rng'
import { assertValidProjectileParameters, type ProjectileParameters } from './model'

/** Renders every frame of the in-place flight loop, sampling [0, 1). */
export function renderProjectileFrames(parameters: ProjectileParameters): PixelFrame[] {
  assertValidProjectileParameters(parameters)
  return Array.from(
    { length: parameters.frameCount },
    (_, frameIndex) => renderProjectileFrame(parameters, frameIndex / parameters.frameCount),
  )
}

/** Renders one deterministic frame; integral cycle times resolve exactly to the first frame. */
export function renderProjectileFrame(parameters: ProjectileParameters, cycleTime: number): PixelFrame {
  assertValidProjectileParameters(parameters)
  const width = parameters.canvasWidth
  const height = parameters.canvasHeight
  const pixels = new Uint8ClampedArray(width * height * 4)
  const wrappedTime = ((cycleTime % 1) + 1) % 1
  const phase = Math.PI * 2 * parameters.loopCycles * wrappedTime
  const radians = parameters.rotationDegrees * Math.PI / 180
  const cosine = Math.cos(radians)
  const sine = Math.sin(radians)
  const pulseScale = 1 + parameters.pulseAmount * 0.14 * Math.sin(phase)
  const bodyRadius = Math.max(1, Math.round(parameters.radius * pulseScale))
  const bodyLength = Math.max(4, Math.round(parameters.bodyLength * (1 + parameters.pulseAmount * 0.05 * Math.sin(phase))))
  const bob = parameters.wobbleAmount * parameters.radius * 0.3 * Math.sin(phase + Math.PI / 2)
  const centerX = width / 2
  const centerY = height / 2 + bob
  const rearX = -bodyLength / 2

  drawAfterimages(pixels, width, height, parameters, centerX, centerY, cosine, sine, wrappedTime, phase)
  if (parameters.trailMode !== 'off' && parameters.trailLength > 0) {
    if (parameters.kind === 'fireball' && parameters.trailMode === 'fire') {
      drawFireballCometTrail(pixels, width, height, parameters, centerX, centerY, cosine, sine, phase, bodyRadius, bodyLength)
    } else {
      drawTrail(pixels, width, height, parameters, centerX, centerY, cosine, sine, rearX, phase)
    }
  }
  if (parameters.sparksEnabled && parameters.sparkCount > 0) {
    drawSparks(pixels, width, height, parameters, centerX, centerY, cosine, sine, rearX, wrappedTime, phase)
  }
  drawProjectileBody(
    pixels,
    width,
    height,
    parameters,
    activeBodyPalette(parameters),
    centerX,
    centerY,
    cosine,
    sine,
    bodyRadius,
    bodyLength,
    phase,
  )
  return { width, height, pixels }
}

/**
 * Draws one continuous comet profile for fireballs. The root begins inside
 * the rear body, uses the body's own cross-section, and delays wave/breakup
 * until the profile has visibly left the body.
 */
function drawFireballCometTrail(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  parameters: ProjectileParameters,
  centerX: number,
  centerY: number,
  cosine: number,
  sine: number,
  phase: number,
  radius: number,
  bodyLength: number,
): void {
  const halfLength = Math.max(radius * 0.8, bodyLength / 2)
  const rootX = -halfLength * 0.58
  const length = Math.max(1, parameters.trailLength * radius * 5)
  const rootHalfWidth = fireballHalfWidthAt(rootX, radius, halfLength, parameters, phase)
  const palette = parameters.energyPalette

  for (let localX = Math.floor(rootX - length); localX <= Math.ceil(rootX); localX += 1) {
    const distance = rootX - localX
    const progress = clamp01(distance / length)
    const taper = (1 - progress) ** 0.78
    const waveProgress = smoothStep(0.04, 0.34, progress)
    const wave = parameters.trailWave * radius * 0.42
      * waveProgress
      * (0.72 * Math.sin(phase * 1.15 - progress * Math.PI * 3)
        + 0.28 * Math.sin(phase * 1.9 + progress * Math.PI * 6))
    const halfWidth = Math.max(1, rootHalfWidth * taper)
    for (let offset = Math.floor(wave - halfWidth); offset <= Math.ceil(wave + halfWidth); offset += 1) {
      const cross = Math.abs(offset - wave) / Math.max(1, halfWidth)
      if (cross > 1) continue
      const breakupProgress = smoothStep(0.16, 0.62, progress)
      const breakupSignal = 0.5 + 0.5 * Math.sin(localX * 1.31 + offset * 2.07 - phase * 2.2 + parameters.seed * 0.001)
      const breakupThreshold = parameters.trailBreakup * breakupProgress * (0.35 + 0.65 * cross)
      if (breakupSignal < breakupThreshold) continue
      const colorDepth = clamp01(progress * 0.82 + cross * 0.34)
      writeRotated(
        pixels,
        width,
        height,
        centerX,
        centerY,
        cosine,
        sine,
        localX,
        offset,
        paletteColor(palette, colorDepth),
      )
    }
  }
}

/** Picks the palette that owns the visible body surface. */
function activeBodyPalette(parameters: ProjectileParameters): readonly RgbColor[] {
  return parameters.kind === 'arrow' && parameters.arrowMaterial === 'solid'
    ? parameters.bodyPalette
    : parameters.energyPalette
}

/** Draws evenly phased ghost silhouettes that stream backward instead of remaining fixed. */
function drawAfterimages(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  parameters: ProjectileParameters,
  centerX: number,
  centerY: number,
  cosine: number,
  sine: number,
  cycleTime: number,
  phase: number,
): void {
  if (!parameters.afterimagesEnabled || parameters.afterimageCount <= 0 || parameters.afterimageSpacing <= 0) return
  const count = parameters.afterimageCount
  const travel = Math.max(2, parameters.afterimageSpacing * parameters.radius * 8 * count)
  const ghostPalette = [lastColor(activeBodyPalette(parameters))]
  for (let index = 0; index < count; index += 1) {
    const age = fract(cycleTime * parameters.loopCycles + index / count)
    if (age < 0.08) continue
    const distance = age * travel
    const scale = Math.max(0.28, 0.78 - parameters.afterimageDecay * age * 0.55)
    const ghostX = centerX - distance * cosine
    const ghostY = centerY - distance * sine
    drawEcho(
      pixels,
      width,
      height,
      ghostPalette[0],
      ghostX,
      ghostY,
      cosine,
      sine,
      Math.max(1, Math.round(parameters.radius * scale * 0.55)),
      Math.max(4, Math.round(parameters.bodyLength * scale * 0.65)),
      parameters.seed + index,
    )
  }
}

/** Draws a layered tapered stream whose waves and breakup travel through the loop. */
function drawTrail(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  parameters: ProjectileParameters,
  centerX: number,
  centerY: number,
  cosine: number,
  sine: number,
  rearX: number,
  phase: number,
): void {
  const length = parameters.trailLength * parameters.radius * 5
  if (length < 1) return
  const isFire = parameters.trailMode === 'fire'
  for (let localX = Math.floor(rearX - length); localX <= Math.ceil(rearX); localX += 1) {
    const age = clamp01((rearX - localX) / length)
    const envelope = (1 - age) ** (isFire ? 0.7 : 0.9)
    const edgeFlicker = 0.84 + 0.16 * Math.sin(localX * 0.73 - phase * 1.7 + hashUnit(parameters.seed, localX, 31) * Math.PI)
    const halfWidth = Math.max(1, parameters.trailWidth * envelope * (isFire ? edgeFlicker : 1))
    const wave = parameters.trailWave * parameters.trailWidth * (
      0.55 * Math.sin(phase * 1.2 - age * Math.PI * 3)
      + 0.2 * Math.sin(phase * 2 + age * Math.PI * 7)
    )
    for (let offset = Math.floor(wave - halfWidth); offset <= Math.ceil(wave + halfWidth); offset += 1) {
      const cross = Math.abs(offset - wave) / Math.max(1, halfWidth)
      if (cross > 1) continue
      const breakupSignal = 0.5 + 0.5 * Math.sin(localX * 1.37 + offset * 2.11 - phase * 2.3 + parameters.seed * 0.001)
      const breakupThreshold = parameters.trailBreakup * (0.25 + 0.75 * age) * (0.4 + 0.6 * cross)
      if (breakupSignal < breakupThreshold) continue
      const colorDepth = clamp01(cross * (isFire ? 0.55 : 0.72) + age * (isFire ? 0.82 : 0.34))
      writeRotated(
        pixels,
        width,
        height,
        centerX,
        centerY,
        cosine,
        sine,
        localX,
        offset,
        paletteColor(parameters.energyPalette, colorDepth),
      )
    }
  }
}

/** Draws a tapered speed echo without repeating a second readable projectile head. */
function drawEcho(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  color: RgbColor,
  centerX: number,
  centerY: number,
  cosine: number,
  sine: number,
  radius: number,
  bodyLength: number,
  seed: number,
): void {
  const halfLength = bodyLength / 2
  for (let localX = -halfLength; localX <= halfLength; localX += 1) {
    const axial = Math.abs(localX) / Math.max(1, halfLength)
    const halfWidth = Math.max(0, Math.round(radius * (1 - axial) ** 1.4))
    for (let localY = -halfWidth; localY <= halfWidth; localY += 1) {
      if (hashUnit(seed, localX, localY) < 0.28 + axial * 0.35) continue
      writeRotated(pixels, width, height, centerX, centerY, cosine, sine, localX, localY, color)
    }
  }
}

/** Draws deterministic particles that advect backward and wrap through the loop. */
function drawSparks(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  parameters: ProjectileParameters,
  centerX: number,
  centerY: number,
  cosine: number,
  sine: number,
  rearX: number,
  cycleTime: number,
  phase: number,
): void {
  const trailDistance = parameters.trailMode === 'off'
    ? parameters.radius * (2 + parameters.sparkSpacing * 3)
    : Math.max(parameters.radius * 2, parameters.trailLength * parameters.radius * 5)
  for (let index = 0; index < parameters.sparkCount; index += 1) {
    const age = fract(cycleTime * parameters.loopCycles + hashUnit(parameters.seed, index, 41))
    if (age > 1 - parameters.sparkFade * 0.45) continue
    const distance = rearX - age * trailDistance * (0.55 + 0.45 * parameters.sparkSpacing)
    const side = hashUnit(parameters.seed, index, 42) < 0.5 ? -1 : 1
    const spread = side * parameters.sparkSpread * parameters.radius * (0.2 + age * 1.15)
      + Math.sin(phase + index * 2.39) * parameters.sparkSpread * 1.5
    const size = age < 0.28 && hashUnit(parameters.seed, index, 43) > 0.45 ? 2 : 1
    const color = parameters.energyPalette[Math.min(parameters.energyPalette.length - 1, age < 0.45 ? 0 : 1)]
    for (let dx = 0; dx < size; dx += 1) {
      for (let dy = 0; dy < size; dy += 1) {
        writeRotated(pixels, width, height, centerX, centerY, cosine, sine, distance - dx, spread + dy, color)
      }
    }
  }
}

/** Draws the selected directional body and its material treatment. */
function drawProjectileBody(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  parameters: ProjectileParameters,
  palette: readonly RgbColor[],
  centerX: number,
  centerY: number,
  cosine: number,
  sine: number,
  radius: number,
  bodyLength: number,
  phase: number,
): void {
  if (parameters.kind === 'fireball') {
    drawFireball(pixels, width, height, parameters, palette, centerX, centerY, cosine, sine, radius, bodyLength, phase)
    return
  }
  if (parameters.arrowMaterial === 'energy' && palette.length > 1) {
    drawArrow(pixels, width, height, parameters, [lastColor(palette)], centerX, centerY, cosine, sine, radius + 2, bodyLength + 3)
  }
  drawArrow(pixels, width, height, parameters, palette, centerX, centerY, cosine, sine, radius, bodyLength)
}

/** Draws an animated comet-like head with a rounded leading cap and turbulent rear edge. */
function drawFireball(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  parameters: ProjectileParameters,
  palette: readonly RgbColor[],
  centerX: number,
  centerY: number,
  cosine: number,
  sine: number,
  radius: number,
  bodyLength: number,
  phase: number,
): void {
  const halfLength = Math.max(radius * 0.8, bodyLength / 2)
  const rear = -halfLength
  const front = halfLength
  for (let localX = Math.floor(rear - 2); localX <= Math.ceil(front + 2); localX += 1) {
    const normalizedX = localX / halfLength
    if (Math.abs(normalizedX) > 1) continue
    const rearBias = clamp01(-normalizedX)
    const halfWidth = fireballHalfWidthAt(localX, radius, halfLength, parameters, phase)
    for (let localY = Math.floor(-halfWidth); localY <= Math.ceil(halfWidth); localY += 1) {
      const radial = Math.hypot(normalizedX, localY / Math.max(1, radius))
      if (radial > 1) continue
      const swirl = 0.5 + 0.5 * Math.sin(localY * 0.72 - localX * 0.43 + phase * 2.2)
      const flicker = 0.5 + 0.5 * Math.sin(localY * 1.37 + localX * 0.29 - phase * 1.4)
      const depth = clamp01(
        radial * 0.68
        + rearBias * 0.18
        + (swirl * 0.13 + flicker * 0.07) * parameters.silhouetteVariation,
      )
      writeRotated(pixels, width, height, centerX, centerY, cosine, sine, localX, localY, paletteColor(palette, depth))
    }
  }
}

/** Returns the animated cross-section shared by the body and comet-tail root. */
function fireballHalfWidthAt(
  localX: number,
  radius: number,
  halfLength: number,
  parameters: ProjectileParameters,
  phase: number,
): number {
  const normalizedX = localX / halfLength
  const ellipseHalf = radius * Math.sqrt(Math.max(0, 1 - normalizedX * normalizedX))
  const rearBias = clamp01(-normalizedX)
  const contourWave = Math.sin(localX * 0.55 + phase * 1.5)
    + 0.55 * Math.sin(localX * 1.17 - phase * 2.1 + parameters.seed * 0.0007)
  return Math.max(0, ellipseHalf * (1 + parameters.silhouetteVariation * 0.16 * contourWave * (0.35 + rearBias)))
}

/** Smoothly transitions a normalized value between two endpoints. */
function smoothStep(edge0: number, edge1: number, value: number): number {
  const normalized = clamp01((value - edge0) / (edge1 - edge0))
  return normalized * normalized * (3 - 2 * normalized)
}

/** Draws an arrow with separately readable fletching, shaft, and head geometry. */
function drawArrow(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  parameters: ProjectileParameters,
  palette: readonly RgbColor[],
  centerX: number,
  centerY: number,
  cosine: number,
  sine: number,
  radius: number,
  bodyLength: number,
): void {
  const tail = -bodyLength / 2
  const tip = bodyLength / 2
  const fletchEnd = tail + bodyLength * 0.26
  const headStart = tip - bodyLength * 0.3
  const shaftHalf = Math.max(1, Math.round(radius * 0.16))
  const fletchHalf = Math.max(shaftHalf + 1, Math.round(radius * 0.58))
  const headHalf = Math.max(shaftHalf + 2, Math.round(radius * 0.82))
  for (let localX = Math.floor(tail); localX <= Math.ceil(tip); localX += 1) {
    let half = shaftHalf
    if (localX <= fletchEnd) {
      const progress = clamp01((localX - tail) / Math.max(1, fletchEnd - tail))
      half = Math.max(shaftHalf, Math.round(shaftHalf + fletchHalf * Math.sin(progress * Math.PI)))
    } else if (localX >= headStart) {
      const progress = clamp01((tip - localX) / Math.max(1, tip - headStart))
      half = Math.max(0, Math.round(headHalf * progress))
    }
    const edgeVariation = 1 - parameters.silhouetteVariation * 0.12 * hashUnit(parameters.seed, localX, 53)
    half = Math.max(0, Math.round(half * edgeVariation))
    for (let offset = -half; offset <= half; offset += 1) {
      const depth = half === 0 ? 0 : Math.abs(offset) / half
      writeRotated(pixels, width, height, centerX, centerY, cosine, sine, localX, offset, paletteColor(palette, depth))
    }
  }
}

/** Maps a normalized surface depth into an ordered bright-to-dark palette. */
function paletteColor(palette: readonly RgbColor[], normalized: number): RgbColor {
  const index = Math.min(palette.length - 1, Math.floor(clamp01(normalized) * palette.length))
  return palette[index]
}

/** Returns the darkest color used for silhouettes behind the primary body. */
function lastColor(palette: readonly RgbColor[]): RgbColor {
  return palette[palette.length - 1]
}

/** Returns a positive fractional component. */
function fract(value: number): number {
  return value - Math.floor(value)
}

/** Writes one fully opaque pixel after rotating the local coordinate. */
function writeRotated(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  centerX: number,
  centerY: number,
  cosine: number,
  sine: number,
  localX: number,
  localY: number,
  color: RgbColor,
): void {
  const screenX = Math.round(centerX + localX * cosine - localY * sine)
  const screenY = Math.round(centerY + localX * sine + localY * cosine)
  if (screenX < 0 || screenY < 0 || screenX >= width || screenY >= height) return
  const offset = (screenY * width + screenX) * 4
  pixels[offset] = color.r
  pixels[offset + 1] = color.g
  pixels[offset + 2] = color.b
  pixels[offset + 3] = 255
}
