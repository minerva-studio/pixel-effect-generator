import { describe, expect, it } from 'vitest'
import { DEFAULT_FIREBALL_PARAMETERS } from '../model'
import { renderFireballFrame } from '../renderer'
import type { PixelFrame } from '../../../shared/pixel/frame'
import { REFERENCE_VIEW, toReference } from '../view'

const views = [[32, 4], [64, 9], [128, 15], [128, 18], [256, 36]] as const
const rotations = [0, 30, 45, 90] as const

function positionFireball(source: PixelFrame, width: number, height: number, size: number, rotationDegrees: number): PixelFrame {
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

function alphaIoU(a: PixelFrame, b: PixelFrame): number {
  let intersection = 0, union = 0
  for (let i = 3; i < a.pixels.length; i += 4) {
    const inA = a.pixels[i] > 0, inB = b.pixels[i] > 0
    if (inA && inB) intersection++
    if (inA || inB) union++
  }
  return union === 0 ? 1 : intersection / union
}

describe('native fireball views', () => {
  it('keeps native alpha geometry close to the legacy resampling oracle', () => {
    const minimum: Record<'stream' | 'wrapped' | 'puff', number> = { stream: 1, wrapped: 1, puff: 1 }
    const minimumCase: Record<'stream' | 'wrapped' | 'puff', string> = { stream: '', wrapped: '', puff: '' }
    const minimumAccepted = { stream: 0.84, wrapped: 0.80, puff: 0.81 }
    const references = new Map<string, PixelFrame>()
    for (const form of ['stream', 'wrapped', 'puff'] as const) for (const time of [0, 6 / 24]) {
      references.set(`${form}-${time}`, renderFireballFrame({
        ...DEFAULT_FIREBALL_PARAMETERS,
        canvasWidth: REFERENCE_VIEW.width,
        canvasHeight: REFERENCE_VIEW.height,
        size: 15,
        rotationDegrees: 0,
        form,
      }, time))
    }
    for (const [side, size] of [[64, 9], [128, 18], [256, 36]] as const) {
      for (const rotationDegrees of rotations) for (const form of ['stream', 'wrapped', 'puff'] as const) {
        const parameters = { ...DEFAULT_FIREBALL_PARAMETERS, canvasWidth: side, canvasHeight: side, size, rotationDegrees, form }
        for (const time of [0, 6 / 24]) {
          const native = renderFireballFrame(parameters, time)
          const oracle = positionFireball(references.get(`${form}-${time}`)!, side, side, size, rotationDegrees)
          const iou = alphaIoU(native, oracle)
          if (iou < minimum[form]) {
            minimum[form] = iou
            minimumCase[form] = `${side}/${size} ${rotationDegrees}° t=${time}`
          }
          expect(iou, `${form} ${side}/${size} ${rotationDegrees}° t=${time}`).toBeGreaterThanOrEqual(minimumAccepted[form])
        }
      }
    }
    console.info(`Minimum alpha IoU: ${JSON.stringify(minimum)} (${JSON.stringify(minimumCase)})`)
  }, 60_000)

  it('clips puff pixels to the reference canvas', () => {
    for (const [side, size, rotationDegrees] of [[128, 18, 45], [256, 36, 45], [256, 36, 90]] as const) {
      const parameters = { ...DEFAULT_FIREBALL_PARAMETERS, form: 'puff' as const, canvasWidth: side, canvasHeight: side, size, rotationDegrees }
      const view = { width: side, height: side, scale: size / 15,
        cos: Math.cos(rotationDegrees * Math.PI / 180), sin: Math.sin(rotationDegrees * Math.PI / 180) }
      for (let frameIndex = 0; frameIndex < 24; frameIndex++) {
        const frame = renderFireballFrame(parameters, frameIndex / 24)
        for (let y = 0; y < side; y++) for (let x = 0; x < side; x++) {
          if (!frame.pixels[(y * side + x) * 4 + 3]) continue
          const reference = toReference(view, x, y)
          expect(reference.x >= 1 && reference.x < 127 && reference.y >= 1 && reference.y < 127,
            `puff ${side}/${size} ${rotationDegrees}° at ${x},${y} -> ${reference.x},${reference.y}`).toBe(true)
        }
      }
    }
  }, 30_000)

  it('keeps palette, loop, canvas-edge and wrapped-outline invariants', () => {
    for (const [side, size] of views) for (const rotationDegrees of rotations) {
      for (const form of ['stream', 'wrapped', 'puff'] as const) {
        const parameters = { ...DEFAULT_FIREBALL_PARAMETERS, canvasWidth: side, canvasHeight: side, size, rotationDegrees, form }
        const frame = renderFireballFrame(parameters, 0)
        expect(frame).toEqual(renderFireballFrame(parameters, 1))
        const colors = new Set([...parameters.warmPalette, ...parameters.smokePalette]
          .map(({ r, g, b }) => `${r},${g},${b}`))
        const outline = parameters.warmPalette[4]
        const outlineRgb = `${outline.r},${outline.g},${outline.b}`
        for (let y = 0; y < side; y++) for (let x = 0; x < side; x++) {
          const index = (y * side + x) * 4
          const alpha = frame.pixels[index + 3]
          if (x === 0 || y === 0 || x === side - 1 || y === side - 1) expect(alpha, `${form} ${side}/${size} ${rotationDegrees} border ${x},${y}`).toBe(0)
          if (!alpha) continue
          const rgb = `${frame.pixels[index]},${frame.pixels[index + 1]},${frame.pixels[index + 2]}`
          expect(colors.has(rgb), `${form} ${side}/${size} ${rotationDegrees} colour ${rgb}`).toBe(true)
          if (form === 'wrapped') {
            const transparentNeighbor = frame.pixels[index - 4 + 3] === 0 || frame.pixels[index + 4 + 3] === 0
              || frame.pixels[index - side * 4 + 3] === 0 || frame.pixels[index + side * 4 + 3] === 0
            expect(rgb === outlineRgb, `${form} ${side}/${size} ${rotationDegrees} outline ${x},${y}`).toBe(transparentNeighbor)
          }
        }
      }
    }
  }, 60_000)
})
