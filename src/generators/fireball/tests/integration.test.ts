import { describe, expect, it } from 'vitest'
import { parseProjectDocument, serializeProjectDocument } from '../../../shared/project/document'
import { DEFAULT_FIREBALL_PARAMETERS, DEFAULT_FIREBALL_SPARKS, maxFireballSize, resizeFireballCanvas } from '../model'
import { fireballProjectCodec } from '../project'
import { renderFireballFrame } from '../renderer'
import { toReference } from '../view'

describe('standalone fireball', () => {
  it('allows larger fireballs and scales the size limit with the canvas', () => {
    expect(maxFireballSize(128, 128)).toBe(18)
    expect(maxFireballSize(256, 128)).toBe(18)
    expect(maxFireballSize(256, 256)).toBe(36)
    expect(renderFireballFrame({ ...DEFAULT_FIREBALL_PARAMETERS, size: 18 }, 0).width).toBe(128)
  })

  it('keeps the default forms inside a 128 px canvas at the larger size', () => {
    for (const form of ['stream', 'wrapped', 'puff', 'classic'] as const) {
      const parameters = { ...DEFAULT_FIREBALL_PARAMETERS, form, size: 18 }
      for (let index = 0; index < parameters.frameCount; index++) {
        const frame = renderFireballFrame(parameters, index / parameters.frameCount)
        for (let y = 0; y < frame.height; y++) {
          expect(frame.pixels[(y * frame.width) * 4 + 3], `${form} frame ${index} left y=${y}`).toBe(0)
          expect(frame.pixels[(y * frame.width + frame.width - 1) * 4 + 3], `${form} frame ${index} right y=${y}`).toBe(0)
        }
      }
    }
  })

  it('keeps each form deterministic and periodic across the study seeds', () => {
    for (const seed of [20260923, 3107, 8401]) {
      for (const form of ['stream', 'wrapped', 'puff', 'classic'] as const) {
        const parameters = { ...DEFAULT_FIREBALL_PARAMETERS, seed, form }
        expect(renderFireballFrame(parameters, 0)).toEqual(renderFireballFrame(parameters, 1))
        expect(renderFireballFrame(parameters, 7 / 24)).toEqual(renderFireballFrame(parameters, 7 / 24))
      }
    }
  }, 30_000)

  it('keeps the default classic flame trail inside its flight canvas', () => {
    const parameters = { ...DEFAULT_FIREBALL_PARAMETERS, form: 'classic' as const }
    for (let index = 0; index < parameters.frameCount; index++) {
      const frame = renderFireballFrame(parameters, index / parameters.frameCount)
      for (let y = 0; y < frame.height; y++) {
        expect(frame.pixels[(y * frame.width) * 4 + 3]).toBe(0)
        expect(frame.pixels[(y * frame.width + frame.width - 1) * 4 + 3]).toBe(0)
      }
    }
  })

  it('applies the shared fire palette and loop timing to classic', () => {
    const parameters = { ...DEFAULT_FIREBALL_PARAMETERS, form: 'classic' as const }
    const recolored = { ...parameters, warmPalette: parameters.warmPalette.map(() => ({ r: 10, g: 20, b: 30, a: 255 })) }
    const original = renderFireballFrame(parameters, 1 / 24)
    const changed = renderFireballFrame(recolored, 1 / 24)
    expect(changed.pixels).not.toEqual(original.pixels)
    for (let i = 0; i < changed.pixels.length; i += 4) {
      if (changed.pixels[i + 3]) expect(Array.from(changed.pixels.slice(i, i + 3))).toEqual([10, 20, 30])
    }
    expect(renderFireballFrame({ ...parameters, loopCycles: 2 }, 1 / 4)).toEqual(renderFireballFrame(parameters, 1 / 2))
  })

  it('renders every form with two-color warm and smoke palettes', () => {
    const parameters = {
      ...DEFAULT_FIREBALL_PARAMETERS,
      warmPalette: DEFAULT_FIREBALL_PARAMETERS.warmPalette.slice(0, 2),
      smokePalette: DEFAULT_FIREBALL_PARAMETERS.smokePalette.slice(0, 2),
      stream: { ...DEFAULT_FIREBALL_PARAMETERS.stream, fireballTrail: 'smoke' as const },
      wrapped: { ...DEFAULT_FIREBALL_PARAMETERS.wrapped, fireballTrail: 'smoke' as const },
      puff: { ...DEFAULT_FIREBALL_PARAMETERS.puff, smoke: true },
    }

    for (const form of ['stream', 'wrapped', 'puff', 'classic'] as const) {
      expect(() => renderFireballFrame({ ...parameters, form }, 0.4)).not.toThrow()
    }
  })

  it('round-trips all form settings in its own project codec', () => {
    const parameters = { ...DEFAULT_FIREBALL_PARAMETERS, wrapped: { ...DEFAULT_FIREBALL_PARAMETERS.wrapped, fireballBall: 'molten' as const } }
    const serialized = serializeProjectDocument(fireballProjectCodec, parameters, 20, { pixelsPerUnit: 16, guid: null })
    expect(JSON.stringify(parameters.classic)).not.toMatch(/energyPalette|radius|loopCycles|rotationDegrees|canvasWidth/)
    const reopened = parseProjectDocument(JSON.parse(serialized), fireballProjectCodec)
    expect(reopened.ok).toBe(true)
    if (reopened.ok) {
      expect(reopened.project.project.parameters).toEqual(parameters)
      expect(reopened.project.fps).toBe(20)
    }
  })

  it('migrates classic trail visibility when opening older documents', () => {
    const serialized = JSON.parse(JSON.stringify(DEFAULT_FIREBALL_PARAMETERS)) as Record<string, unknown> & { classic: Record<string, unknown> }
    delete serialized.classic.trailEnabled
    const parsed = fireballProjectCodec.parse(serialized) as typeof DEFAULT_FIREBALL_PARAMETERS
    expect(parsed.classic.trailEnabled).toBe(parsed.classic.trailMode !== 'off')
  })

  it('keeps the wrapped silhouette inside resized and rotated canvases', () => {
    for (const side of [16, 64, 256]) for (const rotationDegrees of [0, 45, 90]) {
      const parameters = { ...resizeFireballCanvas(DEFAULT_FIREBALL_PARAMETERS, { width: side, height: side }, true), rotationDegrees }
      const frame = renderFireballFrame(parameters, 10 / 24)
      for (let x = 0; x < side; x++) {
        expect(frame.pixels[(x * 4) + 3]).toBe(0)
        expect(frame.pixels[((side * (side - 1) + x) * 4) + 3]).toBe(0)
      }
      for (let y = 0; y < side; y++) {
        expect(frame.pixels[((y * side) * 4) + 3]).toBe(0)
        expect(frame.pixels[((y * side + side - 1) * 4) + 3]).toBe(0)
      }
    }
  })

  it('lets the other forms borrow classic sparks, off by default and never over the head', () => {
    expect(DEFAULT_FIREBALL_PARAMETERS.sparks.sparksEnabled).toBe(false)
    const head = { stream: { x: 87, radius: 14.5 }, wrapped: { x: 84, radius: 15 }, puff: { x: 94, radius: 14 } }
    for (const form of ['stream', 'wrapped', 'puff'] as const) for (const [side, size, rotationDegrees] of [[128, 15, 0], [256, 36, 45]] as const) {
      const plain = { ...DEFAULT_FIREBALL_PARAMETERS, form, canvasWidth: side, canvasHeight: side, size, rotationDegrees }
      const sparked = { ...plain, sparks: { ...plain.sparks, sparksEnabled: true } }
      expect(renderFireballFrame(sparked, 0)).toEqual(renderFireballFrame(sparked, 1))
      let added = 0
      for (const time of [0, 0.25, 0.5]) {
        const before = renderFireballFrame(plain, time).pixels, after = renderFireballFrame(sparked, time).pixels
        for (let i = 0; i < after.length; i += 4) {
          if ([0, 1, 2, 3].every(k => after[i + k] === before[i + k])) continue
          added++
          expect([0, 1].map(k => plain.warmPalette[k]).some(c => c.r === after[i] && c.g === after[i + 1] && c.b === after[i + 2])).toBe(true)
          const x = (i / 4) % side, y = Math.floor(i / 4 / side)
          expect(x > 0 && y > 0 && x < side - 1 && y < side - 1).toBe(true)
          if (before[i + 3]) {
            const angle = rotationDegrees * Math.PI / 180
            const reference = toReference({ width: side, height: side, scale: size / 15, cos: Math.cos(angle), sin: Math.sin(angle) }, x, y)
            expect(Math.hypot(reference.x - head[form].x, reference.y - 64)).toBeGreaterThanOrEqual(head[form].radius)
          }
        }
      }
      expect(added, `${form} ${side}`).toBeGreaterThan(0)
    }
  }, 30_000)

  it('opens fireball documents saved before borrowed sparks with sparks off', () => {
    const { sparks: _sparks, ...legacy } = DEFAULT_FIREBALL_PARAMETERS
    const serialized = serializeProjectDocument(fireballProjectCodec, DEFAULT_FIREBALL_PARAMETERS, 20, { pixelsPerUnit: 16, guid: null })
    const document = JSON.parse(serialized)
    document.parameters = legacy
    const reopened = parseProjectDocument(document, fireballProjectCodec)
    expect(reopened.ok).toBe(true)
    if (reopened.ok) expect((reopened.project.project.parameters as typeof DEFAULT_FIREBALL_PARAMETERS).sparks).toEqual(DEFAULT_FIREBALL_SPARKS)
  })
})
