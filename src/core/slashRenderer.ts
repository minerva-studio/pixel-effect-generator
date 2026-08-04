export const FRAME_SIZE = 128

const FULL_CIRCLE_RADIANS = Math.PI * 2
const MIN_FRAME_COUNT = 5
const MAX_FRAME_COUNT = 24
export const MAX_SWEEP_DEGREES = 720
const MAX_FRAGMENT_COUNT = 24
const BAYER_4X4 = [
  0, 8, 2, 10,
  12, 4, 14, 6,
  3, 11, 1, 9,
  15, 7, 13, 5,
] as const

export interface RgbColor {
  readonly r: number
  readonly g: number
  readonly b: number
}

export type SlashDirection = 'clockwise' | 'counterClockwise'
export type DissolveMode = 'ordered' | 'clusteredNoise' | 'directionalStreaks'
export type EdgeBreakupMode = 'blockChips' | 'jaggedContour' | 'slashCuts'
export type FragmentMode = 'pixelChunks' | 'directionalShards' | 'energySparks'

export interface SlashParameters {
  readonly palette: readonly RgbColor[]
  readonly radius: number
  readonly thickness: number
  readonly startAngleDegrees: number
  readonly sweepDegrees: number
  readonly rotationDegrees: number
  readonly tiltDegrees: number
  readonly frameCount: number
  readonly direction: SlashDirection
  readonly sweepSpeed: number
  readonly trailLength: number
  readonly dissolveLength: number
  readonly edgeBreakup: number
  readonly dissolveMode: DissolveMode
  readonly edgeBreakupMode: EdgeBreakupMode
  readonly fragmentMode: FragmentMode
  readonly fragmentAmount: number
  readonly seed: number
  readonly edgeDepth: number
  readonly fragmentSize: number
  readonly fragmentTangentSpeed: number
  readonly fragmentOutwardSpeed: number
  readonly fragmentLifetime: number
}

export interface SlashFrame {
  readonly width: number
  readonly height: number
  readonly pixels: Uint8ClampedArray
}

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

export const DEFAULT_SLASH_PARAMETERS: SlashParameters = {
  palette: [
    { r: 255, g: 255, b: 255 },
    { r: 154, g: 198, b: 255 },
    { r: 52, g: 140, b: 255 },
  ],
  radius: 44,
  thickness: 12,
  startAngleDegrees: -90,
  sweepDegrees: 180,
  rotationDegrees: 0,
  tiltDegrees: 0,
  frameCount: 8,
  direction: 'clockwise',
  sweepSpeed: 0.5,
  trailLength: 0.25,
  dissolveLength: 0.25,
  edgeBreakup: 0.08,
  dissolveMode: 'clusteredNoise',
  edgeBreakupMode: 'slashCuts',
  fragmentMode: 'directionalShards',
  fragmentAmount: 0.2,
  seed: 1337,
  edgeDepth: 0.24,
  fragmentSize: 1,
  fragmentTangentSpeed: 14,
  fragmentOutwardSpeed: 7,
  fragmentLifetime: 0.38,
}

/** Renders every animation frame into deterministic RGBA pixel buffers. */
export function renderSlashFrames(parameters: SlashParameters): SlashFrame[] {
  assertValidParameters(parameters)
  const fragments = generateFragments(parameters)
  return Array.from(
    { length: parameters.frameCount },
    (_, frameIndex) => renderSlashFrame(parameters, fragments, frameIndex),
  )
}

/** Packs equal-sized frames from left to right into one RGBA sprite sheet. */
export function packHorizontalSheet(frames: readonly SlashFrame[]): SlashFrame {
  if (frames.length === 0) {
    throw new RangeError('At least one frame is required.')
  }

  const { width, height } = frames[0]
  const sheetWidth = width * frames.length
  const pixels = new Uint8ClampedArray(sheetWidth * height * 4)

  for (let frameIndex = 0; frameIndex < frames.length; frameIndex += 1) {
    const frame = frames[frameIndex]
    if (frame.width !== width || frame.height !== height) {
      throw new RangeError('All frames must have the same dimensions.')
    }

    for (let y = 0; y < height; y += 1) {
      const sourceStart = y * width * 4
      const sourceEnd = sourceStart + width * 4
      const destinationStart = (y * sheetWidth + frameIndex * width) * 4
      pixels.set(frame.pixels.subarray(sourceStart, sourceEnd), destinationStart)
    }
  }

  return { width: sheetWidth, height, pixels }
}

/** Inserts a generated color before the outermost band without mutating the input. */
export function insertPaletteColor(palette: readonly RgbColor[]): readonly RgbColor[] {
  if (palette.length < 2 || palette.length >= 6) {
    throw new RangeError('Palette must contain between 2 and 5 colors before insertion.')
  }
  const insertionIndex = palette.length - 1
  return [
    ...palette.slice(0, insertionIndex),
    mixColor(palette[insertionIndex - 1], palette[insertionIndex]),
    palette[insertionIndex],
  ]
}

/** Removes one color while preserving the renderer's minimum two-band contract. */
export function removePaletteColor(palette: readonly RgbColor[], index: number): readonly RgbColor[] {
  if (palette.length <= 2) {
    throw new RangeError('A slash palette requires at least two colors.')
  }
  if (!Number.isInteger(index) || index < 0 || index >= palette.length) {
    throw new RangeError('Palette index is out of range.')
  }
  return palette.filter((_, colorIndex) => colorIndex !== index)
}

/** Creates a portable xorshift32 source that yields unsigned 32-bit values. */
export function createXorshift32(seed: number): () => number {
  let state = seed >>> 0
  if (state === 0) {
    state = 0x6d2b79f5
  }
  return () => {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    return state >>> 0
  }
}

/** Returns the normalized threshold for one cell in the fixed 4x4 Bayer matrix. */
export function bayerThreshold(x: number, y: number): number {
  const matrixX = positiveModulo(Math.floor(x), 4)
  const matrixY = positiveModulo(Math.floor(y), 4)
  return (BAYER_4X4[matrixY * 4 + matrixX] + 0.5) / 16
}

/** Resolves the seeded dissolution threshold for the active dissolve mode. */
function dissolveThreshold(parameters: SlashParameters, x: number, y: number, radius: number): number {
  switch (parameters.dissolveMode) {
    case 'ordered':
      return bayerThreshold(x, y)
    case 'clusteredNoise':
      return clusteredNoiseThreshold(parameters.seed, x, y)
    case 'directionalStreaks':
      return directionalStreakThreshold(parameters.seed, x, y, radius)
  }
}

/**
 * Combines smooth low-frequency value noise with a fine hash detail so the
 * dissolve edge forms irregular contiguous blocks instead of a fixed grid.
 */
function clusteredNoiseThreshold(seed: number, x: number, y: number): number {
  const noiseScale = 0.26
  const coarse = valueNoise(seed, x / 10, y / 10)
  const fine = hashUnit(seed ^ 0x5f3759df, x, y)
  const value = 0.3 + coarse * noiseScale + fine * 0.14
  return smoothStep(clamp01(value))
}

/**
 * Produces stable bands elongated along the sweep direction in arc coordinates;
 * the pattern varies across the arc radius so strips read as speed tears.
 */
function directionalStreakThreshold(seed: number, x: number, y: number, radius: number): number {
  const radialCell = radius / 2.4
  const bandStart = Math.floor(radialCell)
  const local = radialCell - bandStart
  const taper = 0.62
  const current = streakBandValue(seed, bandStart)
  const next = streakBandValue(seed, bandStart + 1)
  const blend = smoothStep(clamp01((local - 0.5) / taper + 0.5))
  const arcVariation = hashUnit(seed ^ 0xa5a5a5a5, x, y) * 0.08
  return clamp01(current + (next - current) * blend + arcVariation)
}

/** Samples one deterministic streak band's width and central threshold. */
function streakBandValue(seed: number, bandIndex: number): number {
  const width = 1 + hashUnit(seed ^ 0x9e3779b9, bandIndex, 0) * 1.6
  const center = 0.3 + hashUnit(seed ^ 0x85ebca6b, bandIndex, 1) * 0.62
  return center / Math.sqrt(width)
}

/** Bilinearly interpolated value noise with deterministic cell hashes. */
function valueNoise(seed: number, x: number, y: number): number {
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const fx = x - x0
  const fy = y - y0
  const topLeft = hashUnit(seed, x0, y0)
  const topRight = hashUnit(seed, x0 + 1, y0)
  const bottomLeft = hashUnit(seed, x0, y0 + 1)
  const bottomRight = hashUnit(seed, x0 + 1, y0 + 1)
  return lerp(
    lerp(topLeft, topRight, smoothStep(fx)),
    lerp(bottomLeft, bottomRight, smoothStep(fx)),
    smoothStep(fy),
  )
}

/** Decides whether the active edge mode removes this outer-edge pixel. */
function edgeBreakupCut(
  parameters: SlashParameters,
  directedProgress: number,
  radius: number,
  radialProgress: number,
): boolean {
  switch (parameters.edgeBreakupMode) {
    case 'blockChips': {
      if (radialProgress < 1 - parameters.edgeDepth) {
        return false
      }
      const arcCell = Math.floor(directedProgress * parameters.radius / 2)
      const radialCell = Math.floor((radius - (parameters.radius - parameters.thickness)) / 2)
      return hashUnit(parameters.seed, arcCell, radialCell) < parameters.edgeBreakup
    }
    case 'jaggedContour': {
      if (parameters.edgeBreakup <= 0) {
        return false
      }
      const arcDistancePixels = directedProgress * parameters.radius
      const inset = jaggedContourInset(parameters.seed, arcDistancePixels, parameters.edgeBreakup, parameters.edgeDepth)
      return radialProgress >= 1 - inset
    }
    case 'slashCuts': {
      if (parameters.edgeBreakup <= 0) {
        return false
      }
      const arcDistancePixels = directedProgress * parameters.radius
      return radialProgress >= 1 - slashCutDepth(parameters.seed, arcDistancePixels, parameters.edgeBreakup, parameters.edgeDepth)
    }
  }
}

/** Returns a continuous jagged inset sampled in local arc-length pixels. */
export function jaggedContourInset(seed: number, arcDistancePixels: number, edgeBreakup: number, edgeDepth: number): number {
  const noise = 0.55 + 0.45 * valueNoise(seed ^ 0x1234567, arcDistancePixels / 4, 0)
  return clamp01(noise) * edgeBreakup * edgeDepth
}

/**
 * Samples the sparse, wedge-shaped cut depth at one arc fraction. Cuts are
 * gate-hashed so most arc cells remain intact, and depth is capped by
 * `edgeDepth` at maximum intensity.
 */
export function slashCutDepth(seed: number, arcDistancePixels: number, edgeBreakup: number, edgeDepth: number): number {
  const arcCells = arcDistancePixels / 8
  const cell = Math.floor(arcCells)
  const local = arcCells - cell
  let depth = 0
  for (let offset = -1; offset <= 1; offset += 1) {
    const candidateCell = cell + offset
    const gate = hashUnit(seed ^ 0x6a09e667, candidateCell, 0)
    if (gate >= 0.58) {
      continue
    }
    const centerOffset = (hashUnit(seed ^ 0xbb67ae85, candidateCell, 1) - 0.5) * 2.2
    const distanceFromCenter = Math.abs(local - offset - centerOffset)
    if (distanceFromCenter >= 1) {
      continue
    }
    const wedgeWidth = 0.45 + hashUnit(seed ^ 0x3c6ef372, candidateCell, 2) * 0.55
    const coreDepth = 0.35 + hashUnit(seed ^ 0xa54ff53a, candidateCell, 3) * 0.55
    const falloff = 1 - smoothStep(clamp01(distanceFromCenter / wedgeWidth))
    const candidate = coreDepth * (0.55 + 0.45 * falloff)
    depth = Math.max(depth, candidate)
  }
  return clamp01(depth) * edgeBreakup * edgeDepth
}

/** Builds stable fragment descriptors once so their motion remains continuous across frames. */
export function generateFragments(parameters: SlashParameters): readonly FragmentDescriptor[] {
  assertValidParameters(parameters)
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

  return Array.from({ length: count }, () => {
    const spawnTime = lerp(tailStart, 0.9, random())
    const arcProgress = tailProgressAt(spawnTime, tailStart)
    return {
      spawnTime,
      arcProgress,
      radius: parameters.radius - random() * parameters.thickness * 0.35,
      size: 1 + Math.floor(random() * parameters.fragmentSize),
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

  return Array.from({ length: count }, () => {
    const spawnTime = lerp(tailStart, 0.9, random())
    const arcProgress = tailProgressAt(spawnTime, tailStart)
    return {
      spawnTime,
      arcProgress,
      radius: parameters.radius - random() * parameters.thickness * 0.35,
      size: 1 + Math.floor(random() * parameters.fragmentSize),
      tangentSpeed: parameters.fragmentTangentSpeed * lerp(0.7, 1.3, random()),
      outwardSpeed: parameters.fragmentOutwardSpeed * lerp(0.7, 1.3, random()),
      lifetime: parameters.fragmentLifetime * lerp(0.75, 1.25, random()),
      colorIndex: outerPaletteStart + Math.floor(random() * (parameters.palette.length - outerPaletteStart)),
      ditherOffsetX: Math.floor(random() * 4),
      ditherOffsetY: Math.floor(random() * 4),
    }
  })
}

/** Converts a CSS hexadecimal color into the renderer's portable RGB contract. */
export function hexToRgb(hex: string): RgbColor {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) {
    throw new TypeError(`Invalid RGB color: ${hex}`)
  }
  return {
    r: Number.parseInt(hex.slice(1, 3), 16),
    g: Number.parseInt(hex.slice(3, 5), 16),
    b: Number.parseInt(hex.slice(5, 7), 16),
  }
}

/** Converts a renderer RGB value into a CSS hexadecimal color. */
export function rgbToHex(color: RgbColor): string {
  assertValidColor(color, 'color')
  return `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`
}

function renderSlashFrame(
  parameters: SlashParameters,
  fragments: readonly FragmentDescriptor[],
  frameIndex: number,
): SlashFrame {
  const pixels = new Uint8ClampedArray(FRAME_SIZE * FRAME_SIZE * 4)
  if (frameIndex === parameters.frameCount - 1) {
    return { width: FRAME_SIZE, height: FRAME_SIZE, pixels }
  }

  const sampleTime = (frameIndex + 1) / parameters.frameCount
  const headEnd = lerp(0.85, 0.35, parameters.sweepSpeed)
  const tailStart = trailStartTime(parameters.trailLength)
  const headProgress = easeOutCubic(clamp01(sampleTime / headEnd))
  const tailProgress = tailProgressAt(sampleTime, tailStart)
  const arcRadians = degreesToRadians(parameters.sweepDegrees)
  const visibleStart = tailProgress * arcRadians
  const visibleEnd = headProgress * arcRadians
  const arcStart = degreesToRadians(parameters.startAngleDegrees)
  const rotationRadians = degreesToRadians(parameters.rotationDegrees)
  const tiltScale = Math.max(Math.cos(degreesToRadians(parameters.tiltDegrees)), 1 / parameters.radius)
  const inverseTiltScale = 1 / tiltScale
  const innerRadius = parameters.radius - parameters.thickness
  const center = FRAME_SIZE / 2
  const rotationCosine = Math.cos(rotationRadians)
  const rotationSine = Math.sin(rotationRadians)

  for (let y = 0; y < FRAME_SIZE; y += 1) {
    for (let x = 0; x < FRAME_SIZE; x += 1) {
      const screenX = x + 0.5 - center
      const screenY = y + 0.5 - center
      const localX = screenX * rotationCosine + screenY * rotationSine
      const localY = (-screenX * rotationSine + screenY * rotationCosine) * inverseTiltScale
      const radius = Math.sqrt(localX * localX + localY * localY)
      if (radius < innerRadius || radius > parameters.radius) {
        continue
      }

      const angle = Math.atan2(localY, localX)
      const directedOffset = parameters.direction === 'clockwise'
        ? positiveModulo(angle - arcStart, FULL_CIRCLE_RADIANS)
        : positiveModulo(arcStart - angle, FULL_CIRCLE_RADIANS)
      const directedProgress = visibleDirectedProgress(directedOffset, visibleStart, visibleEnd, arcRadians)
      if (directedProgress === undefined) {
        continue
      }

      const distanceFromTail = directedProgress - visibleStart
      const dissolveSpan = arcRadians * parameters.dissolveLength
      if (dissolveSpan > 0 && distanceFromTail < dissolveSpan) {
        const survival = distanceFromTail / dissolveSpan
        if (survival < dissolveThreshold(parameters, x, y, radius)) {
          continue
        }
      }

      const radialProgress = (radius - innerRadius) / parameters.thickness
      if (edgeBreakupCut(parameters, directedProgress, radius, radialProgress)) {
        continue
      }

      writePixel(pixels, x, y, parameters.palette[colorBandIndex(radialProgress, parameters.palette.length)])
    }
  }

  renderFragments(pixels, parameters, fragments, sampleTime, arcStart, rotationCosine, rotationSine)
  return { width: FRAME_SIZE, height: FRAME_SIZE, pixels }
}

function renderFragments(
  pixels: Uint8ClampedArray,
  parameters: SlashParameters,
  fragments: readonly FragmentDescriptor[],
  sampleTime: number,
  arcStart: number,
  rotationCosine: number,
  rotationSine: number,
): void {
  if (parameters.fragmentMode === 'pixelChunks') {
    renderPixelChunks(pixels, parameters, fragments, sampleTime, arcStart, rotationCosine, rotationSine)
    return
  }
  if (parameters.fragmentMode === 'energySparks') {
    renderEnergySparks(pixels, parameters, fragments, sampleTime, arcStart, rotationCosine, rotationSine)
    return
  }
  renderDirectionalShards(pixels, parameters, fragments, sampleTime, arcStart, rotationCosine, rotationSine)
}

/** Legacy square-chunk fragment rendering. */
function renderPixelChunks(
  pixels: Uint8ClampedArray,
  parameters: SlashParameters,
  fragments: readonly FragmentDescriptor[],
  sampleTime: number,
  arcStart: number,
  rotationCosine: number,
  rotationSine: number,
): void {
  const tiltScale = Math.max(Math.cos(degreesToRadians(parameters.tiltDegrees)), 1 / parameters.radius)
  const center = FRAME_SIZE / 2

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
    const screenX = Math.round(center + localX * rotationCosine - localY * rotationSine)
    const screenY = Math.round(center + localX * rotationSine + localY * rotationCosine)
    const survival = 1 - age / fragment.lifetime
    const color = parameters.palette[fragment.colorIndex]

    for (let offsetY = 0; offsetY < fragment.size; offsetY += 1) {
      for (let offsetX = 0; offsetX < fragment.size; offsetX += 1) {
        if (survival < bayerThreshold(offsetX + fragment.ditherOffsetX, offsetY + fragment.ditherOffsetY)) {
          continue
        }
        writePixel(pixels, screenX + offsetX, screenY + offsetY, color)
      }
    }
  }
}

/** Renders fragments as short integer-pixel lines aligned with the tangent. */
function renderDirectionalShards(
  pixels: Uint8ClampedArray,
  parameters: SlashParameters,
  fragments: readonly FragmentDescriptor[],
  sampleTime: number,
  arcStart: number,
  rotationCosine: number,
  rotationSine: number,
): void {
  const tiltScale = Math.max(Math.cos(degreesToRadians(parameters.tiltDegrees)), 1 / parameters.radius)
  const center = FRAME_SIZE / 2
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
    const screenX = Math.round(center + localX * rotationCosine - localY * rotationSine)
    const screenY = Math.round(center + localX * rotationSine + localY * rotationCosine)
    const color = parameters.palette[fragment.colorIndex]
    const segmentLength = Math.max(1, fragment.size)
    const stepX = tangentX * rotationCosine - tangentY * tiltScale * rotationSine
    const stepY = tangentX * rotationSine + tangentY * tiltScale * rotationCosine

    const endX = Math.round(screenX + stepX * (segmentLength - 1))
    const endY = Math.round(screenY + stepY * (segmentLength - 1))
    for (const point of integerLinePoints(screenX, screenY, endX, endY)) {
      writePixel(pixels, point.x, point.y, color)
    }
  }
}

/** Renders fast, short-lived single or double pixel sparks. */
function renderEnergySparks(
  pixels: Uint8ClampedArray,
  parameters: SlashParameters,
  fragments: readonly FragmentDescriptor[],
  sampleTime: number,
  arcStart: number,
  rotationCosine: number,
  rotationSine: number,
): void {
  const tiltScale = Math.max(Math.cos(degreesToRadians(parameters.tiltDegrees)), 1 / parameters.radius)
  const center = FRAME_SIZE / 2
  const directionSign = parameters.direction === 'clockwise' ? 1 : -1

  for (let fragmentIndex = 0; fragmentIndex < fragments.length; fragmentIndex += 1) {
    const fragment = fragments[fragmentIndex]
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
    const screenX = Math.round(center + localX * rotationCosine - localY * rotationSine)
    const screenY = Math.round(center + localX * rotationSine + localY * rotationCosine)
    const color = parameters.palette[fragment.colorIndex]
    const trailHash = hashUnit(parameters.seed ^ 0x165667b1, fragmentIndex, 0)

    writePixel(pixels, screenX, screenY, color)
    if (fragment.size >= 2 && trailHash < 0.55) {
      const trailX = tangentX * rotationCosine - tangentY * tiltScale * rotationSine
      const trailY = tangentX * rotationSine + tangentY * tiltScale * rotationCosine
      writePixel(pixels, Math.round(screenX + trailX), Math.round(screenY + trailY), color)
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

function writePixel(pixels: Uint8ClampedArray, x: number, y: number, color: RgbColor): void {
  if (x < 0 || x >= FRAME_SIZE || y < 0 || y >= FRAME_SIZE) {
    return
  }
  const pixelIndex = (y * FRAME_SIZE + x) * 4
  pixels[pixelIndex] = color.r
  pixels[pixelIndex + 1] = color.g
  pixels[pixelIndex + 2] = color.b
  pixels[pixelIndex + 3] = 255
}

function assertValidParameters(parameters: SlashParameters): void {
  if (parameters.palette.length < 2 || parameters.palette.length > 6) {
    throw new RangeError('palette must contain between 2 and 6 colors.')
  }
  parameters.palette.forEach((color, index) => assertValidColor(color, `palette[${index}]`))
  assertInRange(parameters.radius, 2, FRAME_SIZE / 2 - 1, 'radius')
  assertInRange(parameters.thickness, 1, parameters.radius, 'thickness')
  assertInRange(parameters.startAngleDegrees, -180, 180, 'startAngleDegrees')
  assertInRange(parameters.sweepDegrees, 30, MAX_SWEEP_DEGREES, 'sweepDegrees')
  assertInRange(parameters.rotationDegrees, -180, 180, 'rotationDegrees')
  assertInRange(parameters.tiltDegrees, 0, 90, 'tiltDegrees')
  assertInRange(parameters.frameCount, MIN_FRAME_COUNT, MAX_FRAME_COUNT, 'frameCount')
  assertInRange(parameters.sweepSpeed, 0, 1, 'sweepSpeed')
  assertInRange(parameters.trailLength, 0, 1, 'trailLength')
  assertInRange(parameters.dissolveLength, 0, 1, 'dissolveLength')
  assertInRange(parameters.edgeBreakup, 0, 1, 'edgeBreakup')
  assertInRange(parameters.fragmentAmount, 0, 1, 'fragmentAmount')
  assertInRange(parameters.seed, 0, 0xffffffff, 'seed')
  assertInRange(parameters.edgeDepth, 0.05, 0.5, 'edgeDepth')
  assertInRange(parameters.fragmentSize, 1, 3, 'fragmentSize')
  assertInRange(parameters.fragmentTangentSpeed, 0, 32, 'fragmentTangentSpeed')
  assertInRange(parameters.fragmentOutwardSpeed, 0, 24, 'fragmentOutwardSpeed')
  assertInRange(parameters.fragmentLifetime, 0.1, 1, 'fragmentLifetime')
  if (!Number.isInteger(parameters.frameCount) || !Number.isInteger(parameters.seed) || !Number.isInteger(parameters.fragmentSize)) {
    throw new RangeError('frameCount, seed, and fragmentSize must be integers.')
  }
  if (parameters.direction !== 'clockwise' && parameters.direction !== 'counterClockwise') {
    throw new RangeError('direction is invalid.')
  }
  if (parameters.dissolveMode !== 'ordered' && parameters.dissolveMode !== 'clusteredNoise' && parameters.dissolveMode !== 'directionalStreaks') {
    throw new RangeError('dissolveMode is invalid.')
  }
  if (parameters.edgeBreakupMode !== 'blockChips' && parameters.edgeBreakupMode !== 'jaggedContour' && parameters.edgeBreakupMode !== 'slashCuts') {
    throw new RangeError('edgeBreakupMode is invalid.')
  }
  if (parameters.fragmentMode !== 'pixelChunks' && parameters.fragmentMode !== 'directionalShards' && parameters.fragmentMode !== 'energySparks') {
    throw new RangeError('fragmentMode is invalid.')
  }
}

function assertValidColor(color: RgbColor, name: string): void {
  assertInRange(color.r, 0, 255, `${name}.r`)
  assertInRange(color.g, 0, 255, `${name}.g`)
  assertInRange(color.b, 0, 255, `${name}.b`)
  if (![color.r, color.g, color.b].every(Number.isInteger)) {
    throw new RangeError(`${name} channels must be integers.`)
  }
}

function assertInRange(value: number, minimum: number, maximum: number, name: string): void {
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    throw new RangeError(`${name} must be between ${minimum} and ${maximum}.`)
  }
}

function colorBandIndex(radialProgress: number, colorCount: number): number {
  return Math.min(colorCount - 1, Math.floor(radialProgress * colorCount))
}

function mixColor(first: RgbColor, second: RgbColor): RgbColor {
  return {
    r: Math.round((first.r + second.r) / 2),
    g: Math.round((first.g + second.g) / 2),
    b: Math.round((first.b + second.b) / 2),
  }
}

function hashUnit(seed: number, x: number, y: number): number {
  let value = (seed ^ Math.imul(x, 0x45d9f3b) ^ Math.imul(y, 0x119de1f3)) >>> 0
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b)
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b)
  return ((value ^ (value >>> 16)) >>> 0) / 0x100000000
}

function trailStartTime(trailLength: number): number {
  return lerp(0.05, 0.55, trailLength)
}

function tailProgressAt(time: number, tailStart: number): number {
  return smoothStep(clamp01((time - tailStart) / (1 - tailStart)))
}

function toHex(channel: number): string {
  return channel.toString(16).padStart(2, '0')
}

function degreesToRadians(degrees: number): number {
  return degrees * Math.PI / 180
}

function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor
}

/** Resolves the first visible revolution of one spatial angle in a multi-turn sweep. */
export function visibleDirectedProgress(
  directedOffset: number,
  visibleStart: number,
  visibleEnd: number,
  totalSweep: number,
): number | undefined {
  const revolution = Math.max(0, Math.ceil((visibleStart - directedOffset) / FULL_CIRCLE_RADIANS))
  const progress = directedOffset + revolution * FULL_CIRCLE_RADIANS
  return progress <= Math.min(visibleEnd, totalSweep) ? progress : undefined
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

function lerp(start: number, end: number, progress: number): number {
  return start + (end - start) * progress
}

function easeOutCubic(value: number): number {
  return 1 - (1 - value) ** 3
}

function smoothStep(value: number): number {
  return value * value * (3 - 2 * value)
}
