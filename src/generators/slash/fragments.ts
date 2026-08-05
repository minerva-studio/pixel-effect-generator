import { clamp01, createXorshift32, lerp, smoothStep } from '../../shared/pixel/rng'
import type { SlashParameters } from './model'
import { bayerThreshold } from './breakup'
import type { RgbColor } from '../../shared/pixel/color'

const MAX_FRAGMENT_COUNT = 24

/** Immutable descriptor for one deterministic fragment's full life cycle. */
export interface FragmentDescriptor {
  readonly spawnTime: number
  readonly arcProgress: number
  readonly radius: number
  readonly size: number
  readonly tangentSpeed: number
  readonly outwardSpeed: number
  readonly lifetime: number
  readonly colorIndex: number
  readonly ditherOffsetX: number
  readonly ditherOffsetY: number
}

/** Builds stable fragment descriptors once so their motion remains continuous across frames. */
export function generateFragments(parameters: SlashParameters): readonly FragmentDescriptor[] {
  if (parameters.fragmentMode === 'pixelChunks') {
    return generatePixelChunks(parameters)
  }
  return generateModernFragments(parameters)
}

/** Legacy deterministic square-chunk descriptors with the original stream. */
function generatePixelChunks(parameters: SlashParameters): readonly FragmentDescriptor[] {
  const count = Math.round(parameters.fragmentAmount * MAX_FRAGMENT_COUNT)
  const next = createXorshift32(parameters.seed)
  const random = () => next() / 0x100000000
  const tailStart = trailStartTime(parameters.trailLength)
  const outerPaletteStart = Math.floor(parameters.palette.length / 2)
  const minSize = parameters.fragmentMinSize
  const maxSize = parameters.fragmentMaxSize

  return Array.from({ length: count }, () => {
    const spawnTime = lerp(tailStart, 0.9, random())
    const arcProgress = tailProgressAt(spawnTime, tailStart)
    return {
      spawnTime,
      arcProgress,
      radius: parameters.radius - random() * parameters.thickness * 0.35,
      size: minSize + Math.floor(random() * (maxSize - minSize + 1)),
      tangentSpeed: parameters.fragmentTangentSpeed * lerp(0.7, 1.3, random()),
      outwardSpeed: parameters.fragmentOutwardSpeed * lerp(0.7, 1.3, random()),
      lifetime: parameters.fragmentLifetime * lerp(0.75, 1.25, random()),
      colorIndex: outerPaletteStart + Math.floor(random() * (parameters.palette.length - outerPaletteStart)),
      ditherOffsetX: Math.floor(random() * 4),
      ditherOffsetY: Math.floor(random() * 4),
    }
  })
}

/** Modern fragment descriptors for shard and spark modes with their own stream. */
function generateModernFragments(parameters: SlashParameters): readonly FragmentDescriptor[] {
  const count = Math.round(parameters.fragmentAmount * MAX_FRAGMENT_COUNT)
  const next = createXorshift32(parameters.seed ^ 0x1f123bb5)
  const random = () => next() / 0x100000000
  const tailStart = trailStartTime(parameters.trailLength)
  const outerPaletteStart = Math.floor(parameters.palette.length / 2)
  const minSize = parameters.fragmentMinSize
  const maxSize = parameters.fragmentMaxSize

  return Array.from({ length: count }, () => {
    const spawnTime = lerp(tailStart, 0.9, random())
    const arcProgress = tailProgressAt(spawnTime, tailStart)
    return {
      spawnTime,
      arcProgress,
      radius: parameters.radius - random() * parameters.thickness * 0.35,
      size: minSize + Math.floor(random() * (maxSize - minSize + 1)),
      tangentSpeed: parameters.fragmentTangentSpeed * lerp(0.7, 1.3, random()),
      outwardSpeed: parameters.fragmentOutwardSpeed * lerp(0.7, 1.3, random()),
      lifetime: parameters.fragmentLifetime * lerp(0.75, 1.25, random()),
      colorIndex: outerPaletteStart + Math.floor(random() * (parameters.palette.length - outerPaletteStart)),
      ditherOffsetX: Math.floor(random() * 4),
      ditherOffsetY: Math.floor(random() * 4),
    }
  })
}

/** Draws the mode-specific fragment pass into the shared frame buffer. */
export function renderFragments(
  pixels: Uint8ClampedArray,
  frameWidth: number,
  frameHeight: number,
  parameters: SlashParameters,
  fragments: readonly FragmentDescriptor[],
  sampleTime: number,
  arcStart: number,
  rotationCosine: number,
  rotationSine: number,
): void {
  if (parameters.fragmentMode === 'pixelChunks') {
    renderPixelChunks(pixels, frameWidth, frameHeight, parameters, fragments, sampleTime, arcStart, rotationCosine, rotationSine)
    return
  }
  if (parameters.fragmentMode === 'energySparks') {
    renderEnergySparks(pixels, frameWidth, frameHeight, parameters, fragments, sampleTime, arcStart, rotationCosine, rotationSine)
    return
  }
  renderDirectionalShards(pixels, frameWidth, frameHeight, parameters, fragments, sampleTime, arcStart, rotationCosine, rotationSine)
}

/** Legacy square-chunk fragment rendering. */
function renderPixelChunks(
  pixels: Uint8ClampedArray,
  frameWidth: number,
  frameHeight: number,
  parameters: SlashParameters,
  fragments: readonly FragmentDescriptor[],
  sampleTime: number,
  arcStart: number,
  rotationCosine: number,
  rotationSine: number,
): void {
  const tiltScale = Math.max(Math.cos(degreesToRadians(parameters.tiltDegrees)), 1 / parameters.radius)
  const centerX = frameWidth / 2
  const centerY = frameHeight / 2

  for (const fragment of fragments) {
    const age = sampleTime - fragment.spawnTime
    if (age < 0 || age > fragment.lifetime) {
      continue
    }

    const angle = parameters.direction === 'clockwise'
      ? arcStart + fragment.arcProgress * degreesToRadians(parameters.sweepDegrees)
      : arcStart - fragment.arcProgress * degreesToRadians(parameters.sweepDegrees)
    const directionSign = parameters.direction === 'clockwise' ? 1 : -1
    const normalX = Math.cos(angle)
    const normalY = Math.sin(angle)
    const tangentX = -normalY * directionSign
    const tangentY = normalX * directionSign
    const localX = normalX * fragment.radius
      + tangentX * fragment.tangentSpeed * age
      + normalX * fragment.outwardSpeed * age
    const localY = (normalY * fragment.radius
      + tangentY * fragment.tangentSpeed * age
      + normalY * fragment.outwardSpeed * age) * tiltScale
    const screenX = Math.round(centerX + localX * rotationCosine - localY * rotationSine)
    const screenY = Math.round(centerY + localX * rotationSine + localY * rotationCosine)
    const survival = 1 - age / fragment.lifetime
    const color = parameters.palette[fragment.colorIndex]

    for (let offsetY = 0; offsetY < fragment.size; offsetY += 1) {
      for (let offsetX = 0; offsetX < fragment.size; offsetX += 1) {
        if (survival < bayerThreshold(offsetX + fragment.ditherOffsetX, offsetY + fragment.ditherOffsetY)) {
          continue
        }
        writePixel(pixels, frameWidth, frameHeight, screenX + offsetX, screenY + offsetY, color)
      }
    }
  }
}

/** Renders fragments as short integer-pixel lines aligned with the tangent. */
function renderDirectionalShards(
  pixels: Uint8ClampedArray,
  frameWidth: number,
  frameHeight: number,
  parameters: SlashParameters,
  fragments: readonly FragmentDescriptor[],
  sampleTime: number,
  arcStart: number,
  rotationCosine: number,
  rotationSine: number,
): void {
  const tiltScale = Math.max(Math.cos(degreesToRadians(parameters.tiltDegrees)), 1 / parameters.radius)
  const centerX = frameWidth / 2
  const centerY = frameHeight / 2
  const directionSign = parameters.direction === 'clockwise' ? 1 : -1

  for (const fragment of fragments) {
    const age = sampleTime - fragment.spawnTime
    if (age < 0 || age > fragment.lifetime) {
      continue
    }

    const angle = parameters.direction === 'clockwise'
      ? arcStart + fragment.arcProgress * degreesToRadians(parameters.sweepDegrees)
      : arcStart - fragment.arcProgress * degreesToRadians(parameters.sweepDegrees)
    const normalX = Math.cos(angle)
    const normalY = Math.sin(angle)
    const tangentX = -normalY * directionSign
    const tangentY = normalX * directionSign
    const localX = normalX * fragment.radius
      + tangentX * fragment.tangentSpeed * age
      + normalX * fragment.outwardSpeed * age
    const localY = (normalY * fragment.radius
      + tangentY * fragment.tangentSpeed * age
      + normalY * fragment.outwardSpeed * age) * tiltScale
    const screenX = Math.round(centerX + localX * rotationCosine - localY * rotationSine)
    const screenY = Math.round(centerY + localX * rotationSine + localY * rotationCosine)
    const color = parameters.palette[fragment.colorIndex]
    const segmentLength = Math.max(1, fragment.size)
    const stepX = tangentX * rotationCosine - tangentY * tiltScale * rotationSine
    const stepY = tangentX * rotationSine + tangentY * tiltScale * rotationCosine

    const endX = Math.round(screenX + stepX * (segmentLength - 1))
    const endY = Math.round(screenY + stepY * (segmentLength - 1))
    for (const point of integerLinePoints(screenX, screenY, endX, endY)) {
      writePixel(pixels, frameWidth, frameHeight, point.x, point.y, color)
    }
  }
}

/** Renders fast, short-lived sparks as fixed-length tangential pixel trails. */
function renderEnergySparks(
  pixels: Uint8ClampedArray,
  frameWidth: number,
  frameHeight: number,
  parameters: SlashParameters,
  fragments: readonly FragmentDescriptor[],
  sampleTime: number,
  arcStart: number,
  rotationCosine: number,
  rotationSine: number,
): void {
  const tiltScale = Math.max(Math.cos(degreesToRadians(parameters.tiltDegrees)), 1 / parameters.radius)
  const centerX = frameWidth / 2
  const centerY = frameHeight / 2
  const directionSign = parameters.direction === 'clockwise' ? 1 : -1

  for (const fragment of fragments) {
    const age = sampleTime - fragment.spawnTime
    const effectiveLifetime = fragment.lifetime * 0.55
    if (age < 0 || age > effectiveLifetime) {
      continue
    }

    const angle = parameters.direction === 'clockwise'
      ? arcStart + fragment.arcProgress * degreesToRadians(parameters.sweepDegrees)
      : arcStart - fragment.arcProgress * degreesToRadians(parameters.sweepDegrees)
    const normalX = Math.cos(angle)
    const normalY = Math.sin(angle)
    const tangentX = -normalY * directionSign
    const tangentY = normalX * directionSign
    const localX = normalX * fragment.radius
      + tangentX * fragment.tangentSpeed * 1.7 * age
      + normalX * fragment.outwardSpeed * 1.7 * age
    const localY = (normalY * fragment.radius
      + tangentY * fragment.tangentSpeed * 1.7 * age
      + normalY * fragment.outwardSpeed * 1.7 * age) * tiltScale
    const screenX = Math.round(centerX + localX * rotationCosine - localY * rotationSine)
    const screenY = Math.round(centerY + localX * rotationSine + localY * rotationCosine)
    const color = parameters.palette[fragment.colorIndex]
    const trailX = tangentX * rotationCosine - tangentY * tiltScale * rotationSine
    const trailY = tangentX * rotationSine + tangentY * tiltScale * rotationCosine
    for (let step = 0; step < fragment.size; step += 1) {
      writePixel(
        pixels,
        frameWidth,
        frameHeight,
        Math.round(screenX + trailX * step),
        Math.round(screenY + trailY * step),
        color,
      )
    }
  }
}

/** Rasterizes an inclusive integer line for portable shard drawing. */
export function integerLinePoints(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
): readonly { readonly x: number; readonly y: number }[] {
  const points: { x: number; y: number }[] = []
  let x = Math.round(startX)
  let y = Math.round(startY)
  const targetX = Math.round(endX)
  const targetY = Math.round(endY)
  const deltaX = Math.abs(targetX - x)
  const deltaY = Math.abs(targetY - y)
  const stepX = x < targetX ? 1 : -1
  const stepY = y < targetY ? 1 : -1
  let error = deltaX - deltaY

  while (true) {
    points.push({ x, y })
    if (x === targetX && y === targetY) {
      break
    }
    const doubledError = error * 2
    if (doubledError > -deltaY) {
      error -= deltaY
      x += stepX
    }
    if (doubledError < deltaX) {
      error += deltaX
      y += stepY
    }
  }
  return points
}

/** Writes one fully opaque pixel, silently ignoring out-of-bounds targets. */
export function writePixel(
  pixels: Uint8ClampedArray,
  frameWidth: number,
  frameHeight: number,
  x: number,
  y: number,
  color: RgbColor,
): void {
  if (x < 0 || x >= frameWidth || y < 0 || y >= frameHeight) {
    return
  }
  const pixelIndex = (y * frameWidth + x) * 4
  pixels[pixelIndex] = color.r
  pixels[pixelIndex + 1] = color.g
  pixels[pixelIndex + 2] = color.b
  pixels[pixelIndex + 3] = 255
}

function trailStartTime(trailLength: number): number {
  return lerp(0.05, 0.55, trailLength)
}

function tailProgressAt(time: number, tailStart: number): number {
  return smoothStep(clamp01((time - tailStart) / (1 - tailStart)))
}

function degreesToRadians(degrees: number): number {
  return degrees * Math.PI / 180
}
