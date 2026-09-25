import { describe, expect, it } from 'vitest'
import { DEFAULT_FIREBALL_PARAMETERS, classicProjectileParameters } from '../model'
import { renderFireballFrame } from '../renderer'
import { renderProjectileFrame } from '../../projectile/renderer'

const rotations = [0, 15, 30, 45, 90] as const
const breakups = [0, 0.5, 1] as const
const frameIndexes = [0, 4, 8, 12] as const

function colorKey(pixels: Uint8ClampedArray, offset: number): string {
  return `${pixels[offset]},${pixels[offset + 1]},${pixels[offset + 2]},${pixels[offset + 3]}`
}

function opaqueNeighbors(frame: ReturnType<typeof renderFireballFrame>, x: number, y: number): number {
  return [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]].filter(([nx, ny]) => {
    if (nx < 0 || nx >= frame.width || ny < 0 || ny >= frame.height) return false
    return frame.pixels[(ny * frame.width + nx) * 4 + 3] > 0
  }).length
}

function componentSizes(frame: ReturnType<typeof renderFireballFrame>): number[] {
  const visited = new Set<number>()
  const sizes: number[] = []
  for (let y = 0; y < frame.height; y++) for (let x = 0; x < frame.width; x++) {
    const start = y * frame.width + x
    if (visited.has(start) || frame.pixels[start * 4 + 3] === 0) continue
    let size = 0
    const pending = [start]
    visited.add(start)
    while (pending.length > 0) {
      const pixel = pending.pop()!
      size++
      const px = pixel % frame.width
      const py = Math.floor(pixel / frame.width)
      for (const [nx, ny] of [[px - 1, py], [px + 1, py], [px, py - 1], [px, py + 1]]) {
        if (nx < 0 || nx >= frame.width || ny < 0 || ny >= frame.height) continue
        const next = ny * frame.width + nx
        if (!visited.has(next) && frame.pixels[next * 4 + 3] > 0) {
          visited.add(next)
          pending.push(next)
        }
      }
    }
    sizes.push(size)
  }
  return sizes
}

describe('classic fireball tail', () => {
  it('loops exactly and uses only its palette for all breakup and rotation settings', () => {
    for (const rotationDegrees of rotations) for (const trailBreakup of breakups) {
      const parameters = {
        ...DEFAULT_FIREBALL_PARAMETERS,
        form: 'classic' as const,
        rotationDegrees,
        classic: {
          ...DEFAULT_FIREBALL_PARAMETERS.classic,
          trailBreakup,
          sparksEnabled: false,
          afterimagesEnabled: false,
        },
      }
      const colors = new Set(parameters.warmPalette.map((color) => `${color.r},${color.g},${color.b},${color.a}`))
      expect(renderFireballFrame(parameters, 0)).toEqual(renderFireballFrame(parameters, 1))
      for (const frameIndex of frameIndexes) {
        const frame = renderFireballFrame(parameters, frameIndex / 24)
        let invalidPalette = 0
        let isolatedPixels = 0
        let pinholes = 0
        for (let y = 0; y < frame.height; y++) for (let x = 0; x < frame.width; x++) {
          const offset = (y * frame.width + x) * 4
          if (frame.pixels[offset + 3] > 0) {
            if (!colors.has(colorKey(frame.pixels, offset))) invalidPalette++
            if (opaqueNeighbors(frame, x, y) === 0) isolatedPixels++
          } else {
            if (opaqueNeighbors(frame, x, y) === 4) pinholes++
          }
        }
        expect(invalidPalette, `palette ${rotationDegrees}/${trailBreakup} frame ${frameIndex}`).toBe(0)
        expect(isolatedPixels, `isolated pixels ${rotationDegrees}/${trailBreakup} frame ${frameIndex}`).toBe(0)
        expect(pinholes, `pin-holes ${rotationDegrees}/${trailBreakup} frame ${frameIndex}`).toBe(0)
        if (trailBreakup === 0) expect(componentSizes(frame), `components ${rotationDegrees} frame ${frameIndex}`).toHaveLength(1)
        if (trailBreakup > 0) {
          expect(componentSizes(frame).filter((size) => size < 5), `tiny masses ${rotationDegrees}/${trailBreakup} frame ${frameIndex}`).toEqual([])
        }
      }
    }
  }, 30_000)

  it('uses the ball rim colour along the continuous tongue silhouette', () => {
    const parameters = {
      ...DEFAULT_FIREBALL_PARAMETERS,
      form: 'classic' as const,
      rotationDegrees: 0,
      classic: {
        ...DEFAULT_FIREBALL_PARAMETERS.classic,
        trailBreakup: 0,
        sparksEnabled: false,
        afterimagesEnabled: false,
      },
    }
    const classic = classicProjectileParameters(parameters)
    const frontReach = Math.max(classic.radius * 0.8, classic.bodyLength / 2)
    const rearReach = frontReach * (1 + classic.fireRearExtension * 0.45) * 0.58
      + classic.trailLength * classic.radius * 5
    const forwardOffset = Math.max(0, (rearReach - frontReach) / 2)
    const body = renderProjectileFrame({ ...classic, trailMode: 'off' }, 0, forwardOffset)
    const bodyMinX = body.pixels.reduce((min, alpha, index) => index % 4 === 3 && alpha > 0
      ? Math.min(min, Math.floor(index / 4) % body.width)
      : min, body.width)
    const frame = renderFireballFrame(parameters, 0)
    const rim = parameters.warmPalette.at(-1)!
    const rimKey = `${rim.r},${rim.g},${rim.b},${rim.a}`
    let edgePixels = 0
    let wrongColors = 0
    for (let y = 0; y < frame.height; y++) for (let x = 0; x < bodyMinX; x++) {
      const offset = (y * frame.width + x) * 4
      const neighbors = opaqueNeighbors(frame, x, y)
      if (frame.pixels[offset + 3] === 0 || neighbors === 4 || neighbors === 0) continue
      edgePixels++
      if (colorKey(frame.pixels, offset) !== rimKey) wrongColors++
    }
    expect(edgePixels).toBeGreaterThan(0)
    expect(wrongColors).toBe(0)
  })
})
