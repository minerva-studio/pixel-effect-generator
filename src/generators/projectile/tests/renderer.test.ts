import { describe, expect, it } from 'vitest'
import type { PixelFrame } from '../../../shared/pixel/frame'
import { DEFAULT_PROJECTILE_PARAMETERS } from '../model'
import { renderProjectileFrame, renderProjectileFrames } from '../renderer'

describe('renderProjectileFrames', () => {
  it('renders deterministic frames with the requested count and size', () => {
    const first = renderProjectileFrames(DEFAULT_PROJECTILE_PARAMETERS)
    const repeated = renderProjectileFrames(DEFAULT_PROJECTILE_PARAMETERS)
    const changed = renderProjectileFrames({ ...DEFAULT_PROJECTILE_PARAMETERS, seed: DEFAULT_PROJECTILE_PARAMETERS.seed + 1 })
    expect(first).toHaveLength(DEFAULT_PROJECTILE_PARAMETERS.frameCount)
    expect(first[0].width).toBe(128)
    expect(first[0].height).toBe(128)
    expect(frameBytes(first)).toEqual(frameBytes(repeated))
    expect(frameBytes(first)).not.toEqual(frameBytes(changed))
  })

  it('keeps binary alpha and a transparent background', () => {
    const alphas = new Set<number>()
    for (const frame of renderProjectileFrames(DEFAULT_PROJECTILE_PARAMETERS)) {
      for (let offset = 3; offset < frame.pixels.length; offset += 4) {
        alphas.add(frame.pixels[offset])
      }
    }
    for (const alpha of alphas) {
      expect([0, 255]).toContain(alpha)
    }
  })

  it('wraps seamlessly at t = 1 without duplicating the end frame', () => {
    const wrapped = renderProjectileFrame(DEFAULT_PROJECTILE_PARAMETERS, 1)
    const first = renderProjectileFrame(DEFAULT_PROJECTILE_PARAMETERS, 0)
    expect(frameBytes([wrapped])).toEqual(frameBytes([first]))

    const frames = renderProjectileFrames(DEFAULT_PROJECTILE_PARAMETERS)
    expect(frames.length).toBe(DEFAULT_PROJECTILE_PARAMETERS.frameCount)
    expect(frameBytes([frames[0]])).not.toEqual(frameBytes([frames.at(-1)!]))
  })

  it('keeps trail, sparks, and afterimages behind the head for every rotation', () => {
    const center = 64
    const right = extents(renderProjectileFrames({ ...DEFAULT_PROJECTILE_PARAMETERS, rotationDegrees: 0 }))
    expect(right.maxX).toBeGreaterThan(center)
    expect(center - right.minX).toBeGreaterThan(right.maxX - center)

    const left = extents(renderProjectileFrames({ ...DEFAULT_PROJECTILE_PARAMETERS, rotationDegrees: 180 }))
    expect(left.minX).toBeLessThan(center)
    expect(left.maxX - center).toBeGreaterThan(center - left.minX)

    const down = extents(renderProjectileFrames({ ...DEFAULT_PROJECTILE_PARAMETERS, rotationDegrees: 90 }))
    expect(down.maxY).toBeGreaterThan(center)
    expect(center - down.minY).toBeGreaterThan(down.maxY - center)

    const up = extents(renderProjectileFrames({ ...DEFAULT_PROJECTILE_PARAMETERS, rotationDegrees: 270 }))
    expect(up.minY).toBeLessThan(center)
    expect(up.maxY - center).toBeGreaterThan(center - up.minY)
  })

  it('toggles trail, sparks, and afterimages independently', () => {
    const base = { ...DEFAULT_PROJECTILE_PARAMETERS, pulseAmount: 0, wobbleAmount: 0 }
    const withTrail = renderProjectileFrames(base)
    const noTrail = renderProjectileFrames({ ...base, trailMode: 'off' })
    const noSparks = renderProjectileFrames({ ...base, sparksEnabled: false })
    const noAfterimages = renderProjectileFrames({ ...base, afterimagesEnabled: false })
    expect(frameBytes(withTrail)).not.toEqual(frameBytes(noTrail))
    expect(frameBytes(withTrail)).not.toEqual(frameBytes(noSparks))
    expect(frameBytes(withTrail)).not.toEqual(frameBytes(noAfterimages))
  })

  it('produces non-empty, distinct outputs for every projectile family', () => {
    const fireball = renderProjectileFrames(DEFAULT_PROJECTILE_PARAMETERS)
    const solidArrow = renderProjectileFrames({ ...DEFAULT_PROJECTILE_PARAMETERS, kind: 'arrow', arrowMaterial: 'solid' })
    const energyArrow = renderProjectileFrames({ ...DEFAULT_PROJECTILE_PARAMETERS, kind: 'arrow', arrowMaterial: 'energy' })
    const crystalSpear = renderProjectileFrames({ ...DEFAULT_PROJECTILE_PARAMETERS, kind: 'crystal', crystalForm: 'spear' })
    const crystalCore = renderProjectileFrames({ ...DEFAULT_PROJECTILE_PARAMETERS, kind: 'crystal', crystalForm: 'core' })
    for (const frames of [fireball, solidArrow, energyArrow, crystalSpear, crystalCore]) {
      expect(countOpaque(frames)).toBeGreaterThan(20)
    }
    expect(hashFrames(fireball)).not.toBe(hashFrames(solidArrow))
    expect(hashFrames(solidArrow)).not.toBe(hashFrames(energyArrow))
    expect(hashFrames(energyArrow)).not.toBe(hashFrames(fireball))
    expect(hashFrames(crystalSpear)).not.toBe(hashFrames(crystalCore))
  })

  it('gives solid arrows and energy spears different alpha silhouettes even with matching colors', () => {
    const palette = DEFAULT_PROJECTILE_PARAMETERS.energyPalette
    const base = {
      ...DEFAULT_PROJECTILE_PARAMETERS,
      kind: 'arrow' as const,
      bodyPalette: palette,
      energyPalette: palette,
      trailMode: 'off' as const,
      sparksEnabled: false,
      afterimagesEnabled: false,
      pulseAmount: 0,
      wobbleAmount: 0,
    }
    const solid = renderProjectileFrame({ ...base, arrowMaterial: 'solid' }, 0)
    const energy = renderProjectileFrame({ ...base, arrowMaterial: 'energy' }, 0)
    expect(alphaMask(solid)).not.toEqual(alphaMask(energy))
  })

  it('moves crystal-core satellites while preserving its loop seam and rotation', () => {
    const parameters = {
      ...DEFAULT_PROJECTILE_PARAMETERS,
      kind: 'crystal' as const,
      crystalForm: 'core' as const,
      trailMode: 'off' as const,
      sparksEnabled: false,
      afterimagesEnabled: false,
      rotationDegrees: 90,
    }
    expect(frameBytes([renderProjectileFrame(parameters, 0)])).toEqual(frameBytes([renderProjectileFrame(parameters, 1)]))
    expect(alphaMask(renderProjectileFrame(parameters, 0))).not.toEqual(alphaMask(renderProjectileFrame(parameters, 0.25)))
  })

  it('keeps energy arrows and crystal spears self-contained when the common trail is disabled', () => {
    const quiet = {
      ...DEFAULT_PROJECTILE_PARAMETERS,
      trailMode: 'off' as const,
      sparksEnabled: false,
      afterimagesEnabled: false,
      pulseAmount: 0,
      wobbleAmount: 0,
    }
    const energyArrow = { ...quiet, kind: 'arrow' as const, arrowMaterial: 'energy' as const }
    const crystalSpear = { ...quiet, kind: 'crystal' as const, crystalForm: 'spear' as const }
    expect(frameBytes([renderProjectileFrame(energyArrow, 0)])).toEqual(frameBytes([renderProjectileFrame(energyArrow, 0.25)]))
    expect(frameBytes([renderProjectileFrame(crystalSpear, 0)])).toEqual(frameBytes([renderProjectileFrame(crystalSpear, 0.25)]))
  })

  it('changes only the matching body family when a dedicated control is adjusted', () => {
    const quiet = {
      ...DEFAULT_PROJECTILE_PARAMETERS,
      trailMode: 'off' as const,
      sparksEnabled: false,
      afterimagesEnabled: false,
      pulseAmount: 0,
      wobbleAmount: 0,
    }
    const fireball = renderProjectileFrame(quiet, 0)
    expect(frameBytes([fireball])).not.toEqual(frameBytes([renderProjectileFrame({ ...quiet, fireRearExtension: 1 }, 0)]))
    const arrow = { ...quiet, kind: 'arrow' as const, arrowMaterial: 'solid' as const }
    expect(frameBytes([renderProjectileFrame(arrow, 0)])).toEqual(frameBytes([renderProjectileFrame({ ...arrow, fireRearExtension: 1 }, 0)]))
    expect(frameBytes([renderProjectileFrame(arrow, 0)])).not.toEqual(frameBytes([renderProjectileFrame({ ...arrow, solidHeadLength: 0.55 }, 0)]))
  })

  it('adds deterministic opaque mottling only to the fireball middle and rear', () => {
    const quiet = {
      ...DEFAULT_PROJECTILE_PARAMETERS,
      trailMode: 'off' as const,
      sparksEnabled: false,
      afterimagesEnabled: false,
      pulseAmount: 0,
      wobbleAmount: 0,
    }
    const plain = renderProjectileFrame({ ...quiet, fireMottleAmount: 0 }, 0.25)
    const mottled = renderProjectileFrame({ ...quiet, fireMottleAmount: 1 }, 0.25)
    expect(Array.from(plain.pixels.filter((_, index) => index % 4 === 3))).toEqual(Array.from(mottled.pixels.filter((_, index) => index % 4 === 3)))
    expect(frameBytes([plain])).not.toEqual(frameBytes([mottled]))
    expect(frameBytes([renderProjectileFrame({ ...quiet, fireMottleAmount: 1 }, 0)])).toEqual(frameBytes([renderProjectileFrame({ ...quiet, fireMottleAmount: 1 }, 1)]))
    const arrow = { ...quiet, kind: 'arrow' as const, arrowMaterial: 'energy' as const }
    expect(frameBytes([renderProjectileFrame(arrow, 0.25)])).toEqual(frameBytes([renderProjectileFrame({ ...arrow, fireMottleAmount: 1 }, 0.25)]))
  })

  it('uses only the owning palettes with binary alpha', () => {
    const fireball = renderProjectileFrames(DEFAULT_PROJECTILE_PARAMETERS)
    expect([...collectColors(fireball)].every((color) => (
      color === '0,0,0,0' || paletteSet(DEFAULT_PROJECTILE_PARAMETERS.energyPalette).has(color)
    ))).toBe(true)

    const solidArrow = renderProjectileFrames({ ...DEFAULT_PROJECTILE_PARAMETERS, kind: 'arrow', arrowMaterial: 'solid' })
    const solidAllowed = new Set([...paletteSet(DEFAULT_PROJECTILE_PARAMETERS.bodyPalette), ...paletteSet(DEFAULT_PROJECTILE_PARAMETERS.energyPalette)])
    expect([...collectColors(solidArrow)].every((color) => color === '0,0,0,0' || solidAllowed.has(color))).toBe(true)

    const energyArrow = renderProjectileFrames({ ...DEFAULT_PROJECTILE_PARAMETERS, kind: 'arrow', arrowMaterial: 'energy' })
    expect([...collectColors(energyArrow)].every((color) => (
      color === '0,0,0,0' || paletteSet(DEFAULT_PROJECTILE_PARAMETERS.energyPalette).has(color)
    ))).toBe(true)
  })

  it('paints the fireball core with the first energy color', () => {
    const quiet = {
      ...DEFAULT_PROJECTILE_PARAMETERS,
      pulseAmount: 0,
      wobbleAmount: 0,
      trailMode: 'off' as const,
      sparksEnabled: false,
      afterimagesEnabled: false,
      seed: 1,
    }
    const frame = renderProjectileFrame(quiet, 0)
    const offset = (64 * 128 + 64) * 4
    const core = DEFAULT_PROJECTILE_PARAMETERS.energyPalette[0]
    expect(Array.from(frame.pixels.subarray(offset, offset + 4))).toEqual([core.r, core.g, core.b, 255])
  })

  it('keeps the fireball body as one connected mass at maximum variation', () => {
    const quiet = {
      ...DEFAULT_PROJECTILE_PARAMETERS,
      pulseAmount: 0,
      wobbleAmount: 0,
      trailMode: 'off' as const,
      sparksEnabled: false,
      afterimagesEnabled: false,
      rotationDegrees: 0,
      silhouetteVariation: 1,
      seed: 1,
    }
    const frame = renderProjectileFrame(quiet, 0)
    const start = 64 * 128 + 64
    expect(frame.pixels[start * 4 + 3]).toBe(255)
    const reachable = new Set<number>([start])
    const queue = [start]
    while (queue.length > 0) {
      const current = queue.pop()!
      const x = current % 128
      const y = Math.floor(current / 128)
      for (const [nextX, nextY] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
        if (nextX < 0 || nextY < 0 || nextX >= 128 || nextY >= 128) continue
        const next = nextY * 128 + nextX
        if (reachable.has(next) || frame.pixels[next * 4 + 3] !== 255) continue
        reachable.add(next)
        queue.push(next)
      }
    }
    for (let index = 0; index < 128 * 128; index += 1) {
      if (frame.pixels[index * 4 + 3] === 255) {
        expect(reachable.has(index), `body pixel ${index} is isolated`).toBe(true)
      }
    }
  })

  it('attaches the trail to the body with no column gap at the pulse trough', () => {
    const base = {
      ...DEFAULT_PROJECTILE_PARAMETERS,
      pulseAmount: 0.35,
      wobbleAmount: 0,
      rotationDegrees: 0,
      trailBreakup: 0,
      sparksEnabled: false,
      afterimagesEnabled: false,
    }
    const full = renderProjectileFrame(base, 0.75)
    const bodyOnly = renderProjectileFrame({ ...base, trailMode: 'off' }, 0.75)
    const trailMinX = minOccupiedX(full)
    const bodyMinX = minOccupiedX(bodyOnly)
    expect(trailMinX).toBeLessThan(bodyMinX)
    for (let x = trailMinX; x <= bodyMinX; x += 1) {
      expect(columnOccupied(full, x)).toBe(true)
    }
  })

  it('uses a continuous fireball comet root and delays breakup until the tail leaves the body', () => {
    const base = {
      ...DEFAULT_PROJECTILE_PARAMETERS,
      kind: 'fireball' as const,
      trailMode: 'fire' as const,
      pulseAmount: 0,
      wobbleAmount: 0,
      rotationDegrees: 0,
      sparksEnabled: false,
      afterimagesEnabled: false,
      trailBreakup: 1,
    }
    const frame = renderProjectileFrame(base, 0.25)
    const uninterrupted = renderProjectileFrame({ ...base, trailBreakup: 0 }, 0.25)
    const bodyOnly = renderProjectileFrame({ ...base, trailMode: 'off' }, 0.25)
    const center = base.canvasWidth / 2
    const halfLength = Math.max(base.radius * 0.8, base.bodyLength / 2)
    const rootX = Math.floor(center - halfLength * 0.58)
    const tailMinX = minOccupiedX(frame)
    const bodyMinX = minOccupiedX(bodyOnly)

    for (let x = tailMinX; x <= bodyMinX; x += 1) {
      expect(columnOccupied(frame, x), `tail column ${x} is disconnected`).toBe(true)
    }
    for (let x = rootX - 1; x <= bodyMinX; x += 1) {
      for (let y = 0; y < frame.height; y += 1) {
        const offset = (y * frame.width + x) * 4
        expect(Array.from(frame.pixels.subarray(offset, offset + 4))).toEqual(
          Array.from(uninterrupted.pixels.subarray(offset, offset + 4)),
        )
      }
    }
    let distantDifference = 0
    for (let x = tailMinX; x < rootX - 1; x += 1) {
      for (let y = 0; y < frame.height; y += 1) {
        const offset = (y * frame.width + x) * 4
        if (frame.pixels[offset + 3] !== uninterrupted.pixels[offset + 3]) distantDifference += 1
      }
    }
    expect(distantDifference).toBeGreaterThan(0)
  })

  it('tapers the trail from a wide joint to a narrow far end', () => {
    const base = {
      ...DEFAULT_PROJECTILE_PARAMETERS,
      pulseAmount: 0,
      wobbleAmount: 0,
      rotationDegrees: 0,
      trailBreakup: 0,
      trailWidth: 8,
      sparksEnabled: false,
      afterimagesEnabled: false,
    }
    const frame = renderProjectileFrame(base, 0)
    const trailMinX = minOccupiedX(frame)
    const farCount = columnCount(frame, trailMinX)
    let nearCount = 0
    for (let x = trailMinX; x < 48; x += 1) {
      nearCount = Math.max(nearCount, columnCount(frame, x))
    }
    expect(farCount).toBeGreaterThan(0)
    expect(nearCount).toBeGreaterThan(farCount)
  })

  it('keeps spark pixels inside the trail column range', () => {
    const base = {
      ...DEFAULT_PROJECTILE_PARAMETERS,
      pulseAmount: 0,
      wobbleAmount: 0,
      rotationDegrees: 0,
      // A fully broken trail keeps the trail-active spark path while leaving
      // the embers visible on the transparent background for the diff.
      trailBreakup: 1,
      afterimagesEnabled: false,
    }
    const frames = renderProjectileFrames(base)
    const withoutSparks = renderProjectileFrames({ ...base, sparksEnabled: false })
    const trailMinX = Math.min(...renderProjectileFrames({ ...base, sparksEnabled: false, trailBreakup: 0 }).map(minOccupiedX))
    const bodyMinX = Math.min(...renderProjectileFrames({ ...base, sparksEnabled: false, trailMode: 'off' }).map(minOccupiedX))
    let sparkPixels = 0
    for (let frameIndex = 0; frameIndex < frames.length; frameIndex += 1) {
      const frame = frames[frameIndex]
      const plain = withoutSparks[frameIndex]
      for (let index = 0; index < 128 * 128; index += 1) {
        if (frame.pixels[index * 4 + 3] !== 255 || plain.pixels[index * 4 + 3] === 255) continue
        sparkPixels += 1
        const x = index % 128
        expect(x).toBeGreaterThanOrEqual(trailMinX)
        expect(x).toBeLessThanOrEqual(bodyMinX - 1)
      }
    }
    expect(sparkPixels).toBeGreaterThan(0)
  })
})

/** Copies every frame byte for exact deterministic comparisons. */
function frameBytes(frames: readonly PixelFrame[]): number[][] {
  return frames.map((frame) => Array.from(frame.pixels))
}

/** Counts every fully opaque pixel across a frame set. */
function countOpaque(frames: readonly PixelFrame[]): number {
  let count = 0
  for (const frame of frames) {
    for (let offset = 3; offset < frame.pixels.length; offset += 4) {
      if (frame.pixels[offset] === 255) count += 1
    }
  }
  return count
}

/** Returns the leftmost occupied column of one frame. */
function minOccupiedX(frame: PixelFrame): number {
  for (let x = 0; x < frame.width; x += 1) {
    for (let y = 0; y < frame.height; y += 1) {
      if (frame.pixels[(y * frame.width + x) * 4 + 3] !== 0) {
        return x
      }
    }
  }
  return -1
}

/** Reports whether one column contains any opaque pixel. */
function columnOccupied(frame: PixelFrame, x: number): boolean {
  return columnCount(frame, x) > 0
}

/** Counts opaque pixels in one column of a frame. */
function columnCount(frame: PixelFrame, x: number): number {
  let count = 0
  for (let y = 0; y < frame.height; y += 1) {
    if (frame.pixels[(y * frame.width + x) * 4 + 3] !== 0) {
      count += 1
    }
  }
  return count
}

/** Serializes every RGBA sample for palette membership checks. */
function collectColors(frames: readonly PixelFrame[]): Set<string> {
  const colors = new Set<string>()
  for (const frame of frames) {
    for (let offset = 0; offset < frame.pixels.length; offset += 4) {
      colors.add(Array.from(frame.pixels.subarray(offset, offset + 4)).join(','))
    }
  }
  return colors
}

/** Converts one palette into a serialized RGBA membership set. */
function paletteSet(palette: readonly { readonly r: number; readonly g: number; readonly b: number; readonly a: number }[]): Set<string> {
  return new Set(palette.map((color) => `${color.r},${color.g},${color.b},${color.a}`))
}

/** Measures the occupied bounding box across every frame. */
function extents(frames: readonly PixelFrame[]): { readonly minX: number; readonly maxX: number; readonly minY: number; readonly maxY: number } {
  let minX = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  for (const frame of frames) {
    for (let y = 0; y < frame.height; y += 1) {
      for (let x = 0; x < frame.width; x += 1) {
        if (frame.pixels[(y * frame.width + x) * 4 + 3] === 0) continue
        minX = Math.min(minX, x)
        maxX = Math.max(maxX, x)
        minY = Math.min(minY, y)
        maxY = Math.max(maxY, y)
      }
    }
  }
  return { minX, maxX, minY, maxY }
}

/** Hashes every frame byte with FNV-1a for structural difference checks. */
function hashFrames(frames: readonly PixelFrame[]): string {
  let hash = 2166136261
  for (const frame of frames) {
    for (const byte of frame.pixels) {
      hash = Math.imul(hash ^ byte, 16777619)
    }
  }
  return (hash >>> 0).toString(16)
}

/** Captures opaque-pixel geometry without allowing color differences to hide a shared silhouette. */
function alphaMask(frame: PixelFrame): number[] {
  const mask: number[] = []
  for (let offset = 3; offset < frame.pixels.length; offset += 4) mask.push(frame.pixels[offset])
  return mask
}
