import type { RgbColor } from '../../shared/pixel/color'
import type { PixelFrame } from '../../shared/pixel/frame'
import { clamp01, createXorshift32, easeOutCubic, hashUnit, lerp, smoothStep } from '../../shared/pixel/rng'
import { assertValidExplosionParameters, type ExplosionParameters } from './model'

interface FragmentDescriptor {
  readonly angle: number
  readonly distanceScale: number
  readonly tangent: number
  readonly size: number
  readonly colorIndex: number
  readonly phase: number
}

interface TrailDescriptor {
  readonly angle: number
  readonly length: number
  readonly width: number
  readonly colorIndex: number
  readonly phase: number
  readonly lifetime: number
  readonly reachShare: number
  readonly fork: number
}

/** Renders a complete deterministic explosion or implosion animation. */
export function renderExplosionFrames(parameters: ExplosionParameters): PixelFrame[] {
  assertValidExplosionParameters(parameters)
  const fragments = generateFragments(parameters)
  const trails = generateTrails(parameters)
  return Array.from({ length: parameters.frameCount }, (_, frameIndex) => (
    renderExplosionFrame(parameters, fragments, trails, frameIndex)
  ))
}

/** Renders one non-looping frame while preserving transparent endpoints. */
function renderExplosionFrame(
  parameters: ExplosionParameters,
  fragments: readonly FragmentDescriptor[],
  trails: readonly TrailDescriptor[],
  frameIndex: number,
): PixelFrame {
  const width = parameters.canvasWidth
  const height = parameters.canvasHeight
  const pixels = new Uint8ClampedArray(width * height * 4)
  if (frameIndex === 0 || frameIndex === parameters.frameCount - 1) {
    return { width, height, pixels }
  }

  const time = frameIndex / (parameters.frameCount - 1)
  const radialProgress = radialProgressAt(parameters, time)
  renderBody(pixels, width, height, parameters, time, radialProgress)
  renderShockwave(pixels, width, height, parameters, time)
  renderCore(pixels, width, height, parameters, time)
  renderTrails(pixels, width, height, parameters, trails, time)
  renderFragments(pixels, width, height, parameters, fragments, time)
  return { width, height, pixels }
}

/** Maps chronological time onto the active mode's radial travel curve. */
function radialProgressAt(parameters: ExplosionParameters, time: number): number {
  const speedExponent = lerp(1.8, 0.42, parameters.expansionSpeed)
  const outward = clamp01(time ** speedExponent)
  return parameters.mode === 'explosion' ? easeOutCubic(outward) : 1 - smoothStep(outward)
}

/** Draws the irregular, palette-banded main body. */
function renderBody(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  parameters: ExplosionParameters,
  time: number,
  radialProgress: number,
): void {
  if (parameters.bodyStyle === 'cleanClusters') {
    renderCleanClusterBody(pixels, width, height, parameters, time, radialProgress)
    return
  }
  renderPixelNoiseBody(pixels, width, height, parameters, time, radialProgress)
}

/** Draws the original dense per-pixel retro body exactly as released. */
function renderPixelNoiseBody(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  parameters: ExplosionParameters,
  time: number,
  radialProgress: number,
): void {
  if (parameters.bodyStrength === 0) {
    return
  }
  const centerX = width / 2
  const centerY = height / 2
  const visibleRadius = Math.max(0.5, parameters.radius * radialProgress)
  const lifecycle = parameters.mode === 'explosion' ? time : 1 - time
  const survival = lifecycle <= parameters.dissolveStart
    ? parameters.bodyStrength
    : parameters.bodyStrength * (1 - (lifecycle - parameters.dissolveStart) / (1 - parameters.dissolveStart))

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const dx = x + 0.5 - centerX
      const dy = y + 0.5 - centerY
      const distance = Math.sqrt(dx * dx + dy * dy)
      const angleBucket = Math.floor((Math.atan2(dy, dx) + Math.PI) * 18)
      const contourNoise = hashUnit(parameters.seed ^ 0x4f1bbcdc, angleBucket, 0) * 2 - 1
      const contourRadius = visibleRadius * (1 + contourNoise * parameters.irregularity * 0.34)
      if (distance > contourRadius || contourRadius <= 0) {
        continue
      }
      const normalizedDistance = distance / Math.max(1, contourRadius)
      const breakup = hashUnit(parameters.seed ^ 0x9e3779b9, x, y)
      const edgeLoss = clamp01((normalizedDistance - 0.45) / 0.55) * parameters.irregularity
      if (breakup > survival - edgeLoss * 0.55) {
        continue
      }
      const colorIndex = Math.min(
        parameters.palette.length - 1,
        Math.floor(normalizedDistance * parameters.palette.length),
      )
      writePixel(pixels, width, height, x, y, parameters.palette[colorIndex])
    }
  }
}

/** Draws a modern body from larger deterministic cluster cells with a clean contour. */
function renderCleanClusterBody(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  parameters: ExplosionParameters,
  time: number,
  radialProgress: number,
): void {
  if (parameters.bodyStrength === 0) {
    return
  }
  const centerX = width / 2
  const centerY = height / 2
  const visibleRadius = Math.max(0.5, parameters.radius * radialProgress)
  const lifecycle = parameters.mode === 'explosion' ? time : 1 - time
  const survival = lifecycle <= parameters.dissolveStart
    ? parameters.bodyStrength
    : parameters.bodyStrength * (1 - (lifecycle - parameters.dissolveStart) / (1 - parameters.dissolveStart))
  const cellSize = 4

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const dx = x + 0.5 - centerX
      const dy = y + 0.5 - centerY
      const distance = Math.sqrt(dx * dx + dy * dy)
      const angleBucket = Math.floor((Math.atan2(dy, dx) + Math.PI) * 10)
      const contourNoise = hashUnit(parameters.seed ^ 0x4f1bbcdc, angleBucket, 0) * 2 - 1
      const contourRadius = visibleRadius * (1 + contourNoise * parameters.irregularity * 0.3)
      if (distance > contourRadius || contourRadius <= 0) {
        continue
      }
      const cluster = hashUnit(parameters.seed ^ 0x9e3779b9, Math.floor(x / cellSize), Math.floor(y / cellSize))
      if (cluster < 0.14 * parameters.irregularity + (1 - survival) * 0.55) {
        continue
      }
      const normalizedDistance = distance / Math.max(1, contourRadius)
      const edgeLoss = clamp01((normalizedDistance - 0.8) / 0.2) * parameters.irregularity
      if (edgeLoss > 0 && hashUnit(parameters.seed ^ 0x85ebca6b, x, y) < edgeLoss * 0.45) {
        continue
      }
      const colorIndex = Math.min(
        parameters.palette.length - 1,
        Math.floor(normalizedDistance * parameters.palette.length),
      )
      writePixel(pixels, width, height, x, y, parameters.palette[colorIndex])
    }
  }
}

/** Draws the short-lived hot core at the active mode's impact end. */
function renderCore(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  parameters: ExplosionParameters,
  time: number,
): void {
  if (parameters.coreRadius === 0) {
    return
  }
  const coreTime = parameters.mode === 'explosion' ? time : 1 - time
  if (coreTime >= parameters.coreDuration) {
    return
  }
  const progress = coreTime / parameters.coreDuration
  const radius = Math.max(0.5, parameters.coreRadius * (1 - smoothStep(progress)))
  fillDisc(pixels, width, height, radius, parameters.palette[0])
}

/** Draws the expanding or contracting discrete-color shockwave ring. */
function renderShockwave(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  parameters: ExplosionParameters,
  time: number,
): void {
  if (parameters.shockwaveStyle === 'segmentedArc') {
    renderSegmentedArc(pixels, width, height, parameters, time)
    return
  }
  renderFullRing(pixels, width, height, parameters, time)
}

/** Draws the original complete retro shockwave ring exactly as released. */
function renderFullRing(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  parameters: ExplosionParameters,
  time: number,
): void {
  if (parameters.shockwaveWidth === 0) {
    return
  }
  const speedExponent = lerp(1.6, 0.5, parameters.shockwaveSpeed)
  const outward = easeOutCubic(clamp01(time ** speedExponent))
  const progress = parameters.mode === 'explosion' ? outward : 1 - smoothStep(outward)
  const radius = parameters.radius * 1.18 * progress
  const halfWidth = parameters.shockwaveWidth / 2
  const centerX = width / 2
  const centerY = height / 2
  const color = parameters.palette[Math.min(1, parameters.palette.length - 1)]
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const dx = x + 0.5 - centerX
      const dy = y + 0.5 - centerY
      const distance = Math.sqrt(dx * dx + dy * dy)
      if (Math.abs(distance - radius) <= halfWidth) {
        writePixel(pixels, width, height, x, y, color)
      }
    }
  }
}

/** Draws a modern shockwave made of short arcs separated by deterministic gaps. */
function renderSegmentedArc(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  parameters: ExplosionParameters,
  time: number,
): void {
  if (parameters.shockwaveWidth === 0) {
    return
  }
  const speedExponent = lerp(1.6, 0.5, parameters.shockwaveSpeed)
  const outward = easeOutCubic(clamp01(time ** speedExponent))
  const progress = parameters.mode === 'explosion' ? outward : 1 - smoothStep(outward)
  const radius = parameters.radius * 1.18 * progress
  const halfWidth = parameters.shockwaveWidth / 2
  const centerX = width / 2
  const centerY = height / 2
  const color = parameters.palette[Math.min(1, parameters.palette.length - 1)]
  const segmentCount = 8
  const gapChance = 0.25 + parameters.irregularity * 0.35
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const dx = x + 0.5 - centerX
      const dy = y + 0.5 - centerY
      const distance = Math.sqrt(dx * dx + dy * dy)
      if (Math.abs(distance - radius) > halfWidth) {
        continue
      }
      const segment = Math.floor(((Math.atan2(dy, dx) + Math.PI) / (Math.PI * 2)) * segmentCount)
      if (hashUnit(parameters.seed ^ 0x5bd1e995, segment, 0) < gapChance) {
        continue
      }
      writePixel(pixels, width, height, x, y, color)
    }
  }
}

/** Creates stable fragment descriptors once per rendered animation. */
function generateFragments(parameters: ExplosionParameters): FragmentDescriptor[] {
  const count = Math.round(parameters.fragmentAmount * 72)
  const random = createXorshift32(parameters.seed ^ 0xa341316c)
  const unit = () => random() / 0x100000000
  return Array.from({ length: count }, () => ({
    angle: unit() * Math.PI * 2,
    distanceScale: 0.55 + unit() * 0.65,
    tangent: unit() * 2 - 1,
    size: parameters.fragmentMinSize
      + Math.floor(unit() * (parameters.fragmentMaxSize - parameters.fragmentMinSize + 1)),
    colorIndex: Math.min(parameters.palette.length - 1, 1 + Math.floor(unit() * (parameters.palette.length - 1))),
    phase: unit() * 0.18,
  }))
}

/** Creates stable trail descriptors once per animation; disabled by zero amount or length. */
function generateTrails(parameters: ExplosionParameters): TrailDescriptor[] {
  if (parameters.trailAmount === 0 || parameters.trailLength === 0) {
    return []
  }
  const count = Math.round(parameters.trailAmount * (parameters.trailMode === 'energyRays' ? 12 : 10))
  const random = createXorshift32(parameters.seed ^ 0xb5297a4d)
  const unit = () => random() / 0x100000000
  return Array.from({ length: count }, () => ({
    angle: unit() * Math.PI * 2,
    length: parameters.trailLength * (1 - parameters.trailLengthRandomness * (0.25 + unit() * 0.55)),
    width: Math.max(1, Math.round(parameters.trailWidth * (0.75 + unit() * 0.5))),
    colorIndex: Math.min(parameters.palette.length - 1, 1 + Math.floor(unit() * Math.min(2, parameters.palette.length - 1))),
    phase: unit() * 0.18,
    lifetime: 0.55 + unit() * 0.15,
    reachShare: 0.45 + unit() * 0.15,
    fork: 0.35 + unit() * 0.45,
  }))
}

/**
 * Draws energy rays or flame strands that extend from the center outward for
 * explosions and contract from the periphery toward the center for implosions.
 */
function renderTrails(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  parameters: ExplosionParameters,
  trails: readonly TrailDescriptor[],
  time: number,
): void {
  if (trails.length === 0) {
    return
  }
  const centerX = width / 2
  const centerY = height / 2
  trails.forEach((trail) => {
    const localTime = clamp01((time - trail.phase) / trail.lifetime)
    const reach = easeOutCubic(clamp01(localTime / trail.reachShare))
    const fade = clamp01((localTime - trail.reachShare) / (1 - trail.reachShare))
    const extent = trail.length * (parameters.mode === 'explosion' ? reach : 1 - reach) * (1 - fade)
    if (extent <= 0) {
      return
    }
    drawTrail(pixels, width, height, centerX, centerY, parameters, trail, extent)
  })
}

/** Draws one tapered stepped trail spoke up to the current visible extent. */
function drawTrail(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  centerX: number,
  centerY: number,
  parameters: ExplosionParameters,
  trail: TrailDescriptor,
  extent: number,
): void {
  const directionX = Math.cos(trail.angle)
  const directionY = Math.sin(trail.angle)
  const perpendicularX = -directionY
  const perpendicularY = directionX
  const isFlame = parameters.trailMode === 'flameStrands'
  const widthScale = isFlame ? 1.45 : 1
  const forkDistance = trail.length * 0.68

  for (let distance = 0; distance <= extent; distance += 1) {
    const taper = Math.max(0.2, 1 - 0.72 * (distance / Math.max(1, trail.length)))
    const size = Math.max(1, Math.round(trail.width * widthScale * taper))
    const baseX = Math.round(centerX + directionX * distance)
    const baseY = Math.round(centerY + directionY * distance)
    fillSquare(pixels, width, height, baseX, baseY, size, parameters.palette[trail.colorIndex])
    if (isFlame && distance >= forkDistance && trail.fork > 0.5) {
      const offset = Math.max(1, Math.round(size / 2))
      fillSquare(pixels, width, height, Math.round(baseX + perpendicularX * offset), Math.round(baseY + perpendicularY * offset), Math.max(1, size - 1), parameters.palette[trail.colorIndex])
      fillSquare(pixels, width, height, Math.round(baseX - perpendicularX * offset), Math.round(baseY - perpendicularY * offset), Math.max(1, size - 1), parameters.palette[trail.colorIndex])
    }
  }
}

/** Draws fragments along outward or inward radial paths. */
function renderFragments(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  parameters: ExplosionParameters,
  fragments: readonly FragmentDescriptor[],
  time: number,
): void {
  if (fragments.length === 0) {
    return
  }
  const centerX = width / 2
  const centerY = height / 2
  fragments.forEach((fragment, index) => {
    const localTime = clamp01((time - fragment.phase) / parameters.fragmentLifetime)
    const motion = parameters.mode === 'explosion' ? easeOutCubic(localTime) : 1 - smoothStep(localTime)
    const distance = (
      parameters.radius * 0.22
      + parameters.fragmentRadialSpeed * fragment.distanceScale
    ) * motion
    const tangentOffset = parameters.fragmentTangentialJitter * fragment.tangent * Math.sin(localTime * Math.PI)
    const tangentX = -Math.sin(fragment.angle) * tangentOffset
    const tangentY = Math.cos(fragment.angle) * tangentOffset
    const x = Math.round(centerX + Math.cos(fragment.angle) * distance + tangentX)
    const y = Math.round(centerY + Math.sin(fragment.angle) * distance + tangentY)
    const visible = parameters.mode === 'explosion'
      ? localTime < 1 && hashUnit(parameters.seed, index, Math.floor(localTime * 8)) > localTime * 0.38
      : localTime > 0 && hashUnit(parameters.seed, index, Math.floor(localTime * 8)) > (1 - localTime) * 0.2
    if (visible) {
      fillSquare(pixels, width, height, x, y, fragment.size, parameters.palette[fragment.colorIndex])
    }
  })
}

/** Fills a centered disc while clipping writes to the frame. */
function fillDisc(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  radius: number,
  color: RgbColor,
): void {
  const centerX = width / 2
  const centerY = height / 2
  const minimumX = Math.floor(centerX - radius)
  const maximumX = Math.ceil(centerX + radius)
  const minimumY = Math.floor(centerY - radius)
  const maximumY = Math.ceil(centerY + radius)
  for (let y = minimumY; y <= maximumY; y += 1) {
    for (let x = minimumX; x <= maximumX; x += 1) {
      const dx = x + 0.5 - centerX
      const dy = y + 0.5 - centerY
      if (dx * dx + dy * dy <= radius * radius) {
        writePixel(pixels, width, height, x, y, color)
      }
    }
  }
}

/** Fills one square fragment around its resolved center. */
function fillSquare(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  centerX: number,
  centerY: number,
  size: number,
  color: RgbColor,
): void {
  const offset = Math.floor(size / 2)
  for (let y = centerY - offset; y < centerY - offset + size; y += 1) {
    for (let x = centerX - offset; x < centerX - offset + size; x += 1) {
      writePixel(pixels, width, height, x, y, color)
    }
  }
}

/** Writes one opaque palette color when the coordinate is inside the frame. */
function writePixel(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
  color: RgbColor,
): void {
  if (x < 0 || y < 0 || x >= width || y >= height) {
    return
  }
  const offset = (y * width + x) * 4
  pixels[offset] = color.r
  pixels[offset + 1] = color.g
  pixels[offset + 2] = color.b
  pixels[offset + 3] = 255
}
