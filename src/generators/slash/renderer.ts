import type { PixelFrame } from '../../shared/pixel/frame'
import { clamp01, easeOutCubic, lerp, positiveModulo, smoothStep } from '../../shared/pixel/rng'
import { dissolveThreshold, edgeBreakupCut } from './breakup'
import { FragmentDescriptor, generateFragments, renderFragments, writePixel } from './fragments'
import { colorBandIndex } from './palette'
import { assertValidParameters, type SlashParameters } from './model'

const FULL_CIRCLE_RADIANS = Math.PI * 2

/** Renders every animation frame into deterministic RGBA pixel buffers. */
export function renderSlashFrames(parameters: SlashParameters): PixelFrame[] {
  assertValidParameters(parameters)
  const frameWidth = parameters.canvasWidth
  const frameHeight = parameters.canvasHeight
  const fragments = generateFragments(parameters)
  return Array.from(
    { length: parameters.frameCount },
    (_, frameIndex) => renderSlashFrame(parameters, frameWidth, frameHeight, fragments, frameIndex),
  )
}

function renderSlashFrame(
  parameters: SlashParameters,
  frameWidth: number,
  frameHeight: number,
  fragments: readonly FragmentDescriptor[],
  frameIndex: number,
): PixelFrame {
  const pixels = new Uint8ClampedArray(frameWidth * frameHeight * 4)
  if (frameIndex === parameters.frameCount - 1) {
    return { width: frameWidth, height: frameHeight, pixels }
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
  const middleRadius = parameters.radius - parameters.thickness / 2
  const visibleHead = Math.min(visibleEnd, arcRadians)
  const centerX = frameWidth / 2
  const centerY = frameHeight / 2
  const rotationCosine = Math.cos(rotationRadians)
  const rotationSine = Math.sin(rotationRadians)

  for (let y = 0; y < frameHeight; y += 1) {
    for (let x = 0; x < frameWidth; x += 1) {
      const screenX = x + 0.5 - centerX
      const screenY = y + 0.5 - centerY
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

      const localThickness = leadingTipThickness(parameters, visibleHead - directedProgress)
      if (localThickness <= 0) {
        continue
      }
      const localInnerRadius = parameters.tipLength === 0
        ? innerRadius
        : middleRadius - localThickness / 2
      const localOuterRadius = parameters.tipLength === 0
        ? parameters.radius
        : middleRadius + localThickness / 2
      if (radius < localInnerRadius || radius > localOuterRadius) {
        continue
      }

      const radialProgress = (radius - localInnerRadius) / localThickness
      if (edgeBreakupCut(parameters, directedProgress, radius, radialProgress)) {
        continue
      }

      writePixel(
        pixels,
        frameWidth,
        frameHeight,
        x,
        y,
        parameters.palette[colorBandIndex(radialProgress, parameters.palette.length)],
      )
    }
  }

  renderFragments(pixels, frameWidth, frameHeight, parameters, fragments, sampleTime, arcStart, rotationCosine, rotationSine)
  return { width: frameWidth, height: frameHeight, pixels }
}

/** Returns the centered band thickness at an angular distance behind the active leading edge. */
function leadingTipThickness(parameters: SlashParameters, angularDistance: number): number {
  if (parameters.tipLength === 0) {
    return parameters.thickness
  }
  const taperLength = parameters.tipLength * parameters.thickness * 4
  const distanceAlongArc = Math.max(0, angularDistance) * (parameters.radius - parameters.thickness / 2)
  return parameters.thickness * smoothStep(clamp01(distanceAlongArc / taperLength))
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

function trailStartTime(trailLength: number): number {
  return lerp(0.05, 0.55, trailLength)
}

function tailProgressAt(time: number, tailStart: number): number {
  return smoothStep(clamp01((time - tailStart) / (1 - tailStart)))
}

function degreesToRadians(degrees: number): number {
  return degrees * Math.PI / 180
}
