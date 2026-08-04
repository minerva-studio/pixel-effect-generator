export const FRAME_SIZE = 128

const FULL_CIRCLE_RADIANS = Math.PI * 2
const MIN_FRAME_COUNT = 5
const MAX_FRAME_COUNT = 24

export interface RgbColor {
  readonly r: number
  readonly g: number
  readonly b: number
}

export interface SlashParameters {
  readonly innerColor: RgbColor
  readonly outerColor: RgbColor
  readonly radius: number
  readonly thickness: number
  readonly arcDegrees: number
  readonly rotationDegrees: number
  readonly tiltDegrees: number
  readonly frameCount: number
}

export interface SlashFrame {
  readonly width: number
  readonly height: number
  readonly pixels: Uint8ClampedArray
}

export const DEFAULT_SLASH_PARAMETERS: SlashParameters = {
  innerColor: { r: 255, g: 255, b: 255 },
  outerColor: { r: 52, g: 140, b: 255 },
  radius: 44,
  thickness: 12,
  arcDegrees: 180,
  rotationDegrees: 0,
  tiltDegrees: 0,
  frameCount: 8,
}

/** Renders every animation frame into deterministic RGBA pixel buffers. */
export function renderSlashFrames(parameters: SlashParameters): SlashFrame[] {
  assertValidParameters(parameters)
  return Array.from(
    { length: parameters.frameCount },
    (_, frameIndex) => renderSlashFrame(parameters, frameIndex),
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

function renderSlashFrame(parameters: SlashParameters, frameIndex: number): SlashFrame {
  const pixels = new Uint8ClampedArray(FRAME_SIZE * FRAME_SIZE * 4)
  if (frameIndex === parameters.frameCount - 1) {
    return { width: FRAME_SIZE, height: FRAME_SIZE, pixels }
  }

  const sampleTime = (frameIndex + 1) / parameters.frameCount
  const headProgress = easeOutCubic(clamp01(sampleTime / 0.62))
  const tailProgress = smoothStep(clamp01((sampleTime - 0.18) / 0.82))
  const arcRadians = degreesToRadians(parameters.arcDegrees)
  const visibleStart = tailProgress * arcRadians
  const visibleEnd = headProgress * arcRadians
  const arcStart = -arcRadians / 2
  const rotationRadians = degreesToRadians(parameters.rotationDegrees)
  const inverseTiltScale = 1 / Math.cos(degreesToRadians(parameters.tiltDegrees))
  const innerRadius = parameters.radius - parameters.thickness
  const middleColor = mixColor(parameters.innerColor, parameters.outerColor)
  const center = FRAME_SIZE / 2
  const rotationCosine = Math.cos(rotationRadians)
  const rotationSine = Math.sin(rotationRadians)

  for (let y = 0; y < FRAME_SIZE; y += 1) {
    for (let x = 0; x < FRAME_SIZE; x += 1) {
      const screenX = x + 0.5 - center
      const screenY = y + 0.5 - center

      // Undo the screen rotation first, then undo the perspective compression.
      const localX = screenX * rotationCosine + screenY * rotationSine
      const localY = (-screenX * rotationSine + screenY * rotationCosine) * inverseTiltScale
      const radius = Math.sqrt(localX * localX + localY * localY)
      if (radius < innerRadius || radius > parameters.radius) {
        continue
      }

      const angle = Math.atan2(localY, localX)
      const angularProgress = positiveModulo(angle - arcStart, FULL_CIRCLE_RADIANS)
      if (angularProgress < visibleStart || angularProgress > visibleEnd || angularProgress > arcRadians) {
        continue
      }

      const radialProgress = (radius - innerRadius) / parameters.thickness
      const color = radialProgress < 1 / 3
        ? parameters.innerColor
        : radialProgress < 2 / 3
          ? middleColor
          : parameters.outerColor
      const pixelIndex = (y * FRAME_SIZE + x) * 4
      pixels[pixelIndex] = color.r
      pixels[pixelIndex + 1] = color.g
      pixels[pixelIndex + 2] = color.b
      pixels[pixelIndex + 3] = 255
    }
  }

  return { width: FRAME_SIZE, height: FRAME_SIZE, pixels }
}

function assertValidParameters(parameters: SlashParameters): void {
  assertValidColor(parameters.innerColor, 'innerColor')
  assertValidColor(parameters.outerColor, 'outerColor')
  assertInRange(parameters.radius, 2, FRAME_SIZE / 2 - 1, 'radius')
  assertInRange(parameters.thickness, 1, parameters.radius, 'thickness')
  assertInRange(parameters.arcDegrees, 30, 360, 'arcDegrees')
  assertInRange(parameters.rotationDegrees, -180, 180, 'rotationDegrees')
  assertInRange(parameters.tiltDegrees, 0, 75, 'tiltDegrees')
  assertInRange(parameters.frameCount, MIN_FRAME_COUNT, MAX_FRAME_COUNT, 'frameCount')
  if (!Number.isInteger(parameters.frameCount)) {
    throw new RangeError('frameCount must be an integer.')
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

function mixColor(first: RgbColor, second: RgbColor): RgbColor {
  return {
    r: Math.round((first.r + second.r) / 2),
    g: Math.round((first.g + second.g) / 2),
    b: Math.round((first.b + second.b) / 2),
  }
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

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

function easeOutCubic(value: number): number {
  return 1 - (1 - value) ** 3
}

function smoothStep(value: number): number {
  return value * value * (3 - 2 * value)
}
