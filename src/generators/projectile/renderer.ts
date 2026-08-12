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
  const frontHalfLength = Math.max(radius * 0.8, bodyLength / 2)
  const rearHalfLength = frontHalfLength * (1 + parameters.fireRearExtension * 0.45)
  const rootX = -rearHalfLength * 0.58
  const length = Math.max(1, parameters.trailLength * radius * 5)
  const rootHalfWidth = fireballHalfWidthAt(rootX, radius, frontHalfLength, rearHalfLength, parameters, phase)
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
  if (parameters.kind === 'crystal') {
    if (parameters.crystalForm === 'core') {
      drawCrystalCore(pixels, width, height, parameters, centerX, centerY, cosine, sine, radius, phase)
    } else {
      drawCrystalSpear(pixels, width, height, parameters, centerX, centerY, cosine, sine, radius, bodyLength, phase)
    }
    return
  }
  if (parameters.arrowMaterial === 'energy') {
    drawEnergySpear(pixels, width, height, parameters, centerX, centerY, cosine, sine, radius, bodyLength, phase)
    return
  }
  drawSolidArrow(pixels, width, height, parameters, palette, centerX, centerY, cosine, sine, radius, bodyLength)
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
  const frontHalfLength = Math.max(radius * 0.8, bodyLength / 2)
  const rearHalfLength = frontHalfLength * (1 + parameters.fireRearExtension * 0.45)
  const rear = -rearHalfLength
  const front = frontHalfLength
  for (let localX = Math.floor(rear - 2); localX <= Math.ceil(front + 2); localX += 1) {
    const normalizedX = localX / (localX < 0 ? rearHalfLength : frontHalfLength)
    if (Math.abs(normalizedX) > 1) continue
    const rearBias = clamp01(-normalizedX)
    const halfWidth = fireballHalfWidthAt(localX, radius, frontHalfLength, rearHalfLength, parameters, phase)
    for (let localY = Math.floor(-halfWidth); localY <= Math.ceil(halfWidth); localY += 1) {
      // The shared cross-section is the body boundary as well as the tail root.
      // Keeping this normalization here prevents a second ellipse from smoothing
      // away the deliberately turbulent rear contour.
      const crossSection = Math.abs(localY) / Math.max(1, halfWidth)
      if (crossSection > 1) continue
      const radial = Math.hypot(normalizedX, localY / Math.max(1, radius))
      const swirl = 0.5 + 0.5 * Math.sin(localY * 0.72 - localX * 0.43 + phase * 2.2 * parameters.fireFlowSpeed)
      const flicker = 0.5 + 0.5 * Math.sin(localY * 1.37 + localX * 0.29 - phase * 1.4 * parameters.fireFlowSpeed)
      const depth = clamp01(
        radial * 0.68
        + rearBias * 0.18
        + (swirl * 0.13 + flicker * 0.07) * parameters.silhouetteVariation,
      )
      const mottleDepth = fireballMottleDepth(depth, radial, rearBias, localX, localY, parameters, phase, palette.length)
      writeRotated(pixels, width, height, centerX, centerY, cosine, sine, localX, localY, paletteColor(palette, mottleDepth))
    }
  }
}

/** Returns the animated cross-section shared by the body and comet-tail root. */
function fireballHalfWidthAt(
  localX: number,
  radius: number,
  frontHalfLength: number,
  rearHalfLength: number,
  parameters: ProjectileParameters,
  phase: number,
): number {
  const normalizedX = localX / (localX < 0 ? rearHalfLength : frontHalfLength)
  const ellipseHalf = radius * Math.sqrt(Math.max(0, 1 - normalizedX * normalizedX))
  const rearBias = clamp01(-normalizedX)
  const contourWave = 0.25 * Math.sin(localX * 0.18 + phase * 1.5 * parameters.fireFlowSpeed)
    + 0.1 * Math.sin(localX * 0.43 - phase * 2.1 * parameters.fireFlowSpeed + parameters.seed * 0.0007)
  return Math.max(0, ellipseHalf * (1 + parameters.fireRearTurbulence * contourWave * rearBias))
}

/** Applies sparse, opaque, heat-flowing color-band shifts to the fireball middle and rear. */
function fireballMottleDepth(
  depth: number,
  radial: number,
  rearBias: number,
  localX: number,
  localY: number,
  parameters: ProjectileParameters,
  phase: number,
  paletteLength: number,
): number {
  if (parameters.fireMottleAmount <= 0) return depth
  // Preserve the bright thermal core even when its local coordinates overlap
  // the middle/rear mask during a stretched fireball pose.
  if (depth < 0.5) return depth
  const middleMask = smoothStep(0.38, 0.55, radial) * (1 - smoothStep(0.62, 0.8, radial))
  const rearMask = smoothStep(0.28, 0.75, rearBias)
  const coverage = middleMask * rearMask
  if (coverage <= 0) return depth
  const flowPhase = phase * parameters.fireFlowSpeed
  const field = 0.5 + 0.5 * Math.sin(localX * 0.38 + localY * 0.23 + flowPhase * 0.72 + parameters.seed * 0.0003)
  if (field < 1 - parameters.fireMottleAmount * coverage * 0.35) return depth
  const bandStep = 1 / Math.max(2, paletteLength)
  return clamp01(depth + bandStep)
}

/** Smoothly transitions a normalized value between two endpoints. */
function smoothStep(edge0: number, edge1: number, value: number): number {
  const normalized = clamp01((value - edge0) / (edge1 - edge0))
  return normalized * normalized * (3 - 2 * normalized)
}

/** Draws an arrow with separately readable fletching, shaft, and head geometry. */
function drawSolidArrow(
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
  const headStart = tip - bodyLength * parameters.solidHeadLength
  const shaftHalf = Math.max(1, Math.round(radius * parameters.solidShaftWidth))
  const fletchHalf = Math.max(shaftHalf + 1, Math.round(radius * parameters.solidFletchingSpread))
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

/** Draws a self-contained non-physical energy spear without trailing fragments. */
function drawEnergySpear(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  parameters: ProjectileParameters,
  centerX: number,
  centerY: number,
  cosine: number,
  sine: number,
  radius: number,
  bodyLength: number,
  _phase: number,
): void {
  const palette = parameters.energyPalette
  drawEnergySpearLayer(pixels, width, height, centerX, centerY, cosine, sine, radius * (1 + parameters.energyShellWidth), bodyLength + 5, parameters.energyTipSharpness, lastColor(palette))
  drawEnergySpearLayer(pixels, width, height, centerX, centerY, cosine, sine, radius, bodyLength, parameters.energyTipSharpness, palette[1] ?? palette[0])
  const coreLength = Math.max(6, bodyLength * parameters.energyCoreLength)
  drawEnergySpearLayer(pixels, width, height, centerX + cosine * bodyLength * 0.08, centerY + sine * bodyLength * 0.08, cosine, sine, Math.max(1, radius * 0.38), coreLength, parameters.energyTipSharpness, palette[0])
}

/** Rasterizes one sharp diamond spear layer without physical arrow fletching. */
function drawEnergySpearLayer(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  centerX: number,
  centerY: number,
  cosine: number,
  sine: number,
  radius: number,
  bodyLength: number,
  tipSharpness: number,
  color: RgbColor,
): void {
  const tail = -bodyLength * 0.48
  const tip = bodyLength * 0.52
  const widestX = tail + bodyLength * (1 - tipSharpness)
  for (let localX = Math.floor(tail); localX <= Math.ceil(tip); localX += 1) {
    const slope = localX <= widestX
      ? (localX - tail) / Math.max(1, widestX - tail)
      : (tip - localX) / Math.max(1, tip - widestX)
    const halfWidth = Math.max(0, Math.round(radius * clamp01(slope)))
    for (let localY = -halfWidth; localY <= halfWidth; localY += 1) {
      writeRotated(pixels, width, height, centerX, centerY, cosine, sine, localX, localY, color)
    }
  }
}

/** Draws an elongated faceted crystal body without a second trailing effect. */
function drawCrystalSpear(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  parameters: ProjectileParameters,
  centerX: number,
  centerY: number,
  cosine: number,
  sine: number,
  radius: number,
  bodyLength: number,
  phase: number,
): void {
  const palette = parameters.energyPalette
  drawFacetedCrystal(
    pixels, width, height, centerX, centerY, cosine, sine,
    radius * parameters.crystalSpearThickness, bodyLength, parameters.crystalSpearTaper,
    parameters.crystalRefractionStrength, parameters.crystalGlintStrength, parameters.crystalGlintSpeed, phase, palette,
  )
}

/** Draws a crystal nucleus with orbiting facets that visibly progress through the loop. */
function drawCrystalCore(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  parameters: ProjectileParameters,
  centerX: number,
  centerY: number,
  cosine: number,
  sine: number,
  radius: number,
  phase: number,
): void {
  const palette = parameters.energyPalette
  const coreRadius = radius * parameters.crystalCoreScale
  drawFacetedCrystal(
    pixels, width, height, centerX, centerY, cosine, sine,
    coreRadius, Math.max(8, coreRadius * 1.45), 0.5,
    parameters.crystalRefractionStrength, parameters.crystalGlintStrength, parameters.crystalGlintSpeed, phase, palette,
  )
  const orbitRadius = coreRadius * parameters.crystalOrbitRadius
  for (let index = 0; index < 3; index += 1) {
    const angle = phase * parameters.crystalOrbitSpeed + index * Math.PI * 2 / 3
    drawCrystalShard(
      pixels,
      width,
      height,
      centerX,
      centerY,
      cosine,
      sine,
      Math.cos(angle) * orbitRadius,
      Math.sin(angle) * orbitRadius * 0.72,
      Math.max(1, Math.round(radius * 0.26)),
      palette,
      parameters.crystalRefractionStrength,
    )
  }
}

/** Draws a bordered, multi-plane pixel crystal with an optional axial surface glint. */
function drawFacetedCrystal(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  centerX: number,
  centerY: number,
  cosine: number,
  sine: number,
  radius: number,
  bodyLength: number,
  taper: number,
  refractionStrength: number,
  glintStrength: number,
  glintSpeed: number,
  phase: number,
  palette: readonly RgbColor[],
): void {
  const halfLength = bodyLength / 2
  const dark = lastColor(palette)
  const bright = palette[0]
  for (let localX = Math.floor(-halfLength); localX <= Math.ceil(halfLength); localX += 1) {
    const profile = Math.max(0, 1 - Math.abs(localX) / Math.max(1, halfLength))
    const halfWidth = Math.max(0, Math.round(radius * profile ** (0.6 + taper)))
    for (let localY = -halfWidth; localY <= halfWidth; localY += 1) {
      const edgeDistance = halfWidth - Math.abs(localY)
      const isOutline = edgeDistance === 0 || Math.abs(localX) >= Math.ceil(halfLength) - 1
      if (isOutline) {
        const upperLitEdge = localY < 0 && localX > -halfLength * 0.72 && localX < halfLength * 0.45
        writeRotated(pixels, width, height, centerX, centerY, cosine, sine, localX, localY, upperLitEdge && refractionStrength > 0.12 ? bright : dark)
        continue
      }
      const leading = clamp01((localX + halfLength) / Math.max(1, bodyLength))
      const cross = localY / Math.max(1, halfWidth)
      const ridge = 1 - Math.abs(cross)
      const planeDepth = clamp01(
        0.18
        + leading * 0.28
        + (cross > 0 ? 0.34 : 0.08) * refractionStrength
        + (1 - ridge) * 0.16,
      )
      const glintWidth = Math.max(1, bodyLength * (0.06 + glintStrength * 0.04))
      const glintCenter = -halfLength + fract(phase * glintSpeed / (Math.PI * 2)) * (bodyLength + glintWidth * 2) - glintWidth
      const glintDistance = Math.abs(localX - glintCenter)
      const glint = glintStrength > 0 && glintDistance <= glintWidth && ridge > 0.18
      const glintEdge = glintStrength > 0 && glintDistance <= glintWidth + 1 && ridge > 0.18
      const color = glint
        ? bright
        : glintEdge
          ? palette[1] ?? bright
          : paletteColor(palette, planeDepth)
      writeRotated(pixels, width, height, centerX, centerY, cosine, sine, localX, localY, color)
    }
  }
}

/** Draws a compact bordered satellite with one bright crystal plane. */
function drawCrystalShard(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  centerX: number,
  centerY: number,
  cosine: number,
  sine: number,
  localCenterX: number,
  localCenterY: number,
  radius: number,
  palette: readonly RgbColor[],
  refractionStrength: number,
): void {
  const dark = lastColor(palette)
  const bright = palette[0]
  for (let localX = -radius; localX <= radius; localX += 1) {
    const halfWidth = Math.max(0, radius - Math.abs(localX))
    for (let localY = -halfWidth; localY <= halfWidth; localY += 1) {
      const isOutline = halfWidth - Math.abs(localY) === 0 || Math.abs(localX) === radius
      const color = isOutline
        ? (localY < 0 && refractionStrength > 0.12 ? bright : dark)
        : localY < 0
          ? palette[1] ?? bright
          : paletteColor(palette, 0.55 + refractionStrength * 0.2)
      writeRotated(pixels, width, height, centerX, centerY, cosine, sine, localCenterX + localX, localCenterY + localY, color)
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
