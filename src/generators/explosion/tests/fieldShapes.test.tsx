import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../i18n/I18nProvider'
import { ExplosionControls } from '../controls'
import {
  DEFAULT_EXPLOSION_PARAMETERS,
  PUFF_EXPLOSION_PARAMETERS,
  assertValidExplosionParameters,
  resizeExplosionCanvas,
  type ExplosionParameters,
} from '../model'
import { applyExplosionPreset, captureExplosionPreset, parseExplosionPresetPayload } from '../presets'
import { parseExplosionParameters, serializeExplosionParameters } from '../project'
import { renderExplosionFrames } from '../renderer'
import type { ExplosionCategory } from '../module'

afterEach(() => vi.unstubAllGlobals())

const fieldShapes = [DEFAULT_EXPLOSION_PARAMETERS, PUFF_EXPLOSION_PARAMETERS] as const
const same = (a: Uint8ClampedArray, b: Uint8ClampedArray) => Buffer.compare(Buffer.from(a), Buffer.from(b)) === 0
const opaqueCount = (pixels: Uint8ClampedArray) => {
  let count = 0
  for (let i = 3; i < pixels.length; i += 4) if (pixels[i]) count++
  return count
}
const framesDiffer = (a: ExplosionParameters, b: ExplosionParameters) => {
  const first = renderExplosionFrames(a), second = renderExplosionFrames(b)
  return first.some((frame, i) => !same(frame.pixels, second[i].pixels))
}

function renderControls(category: ExplosionCategory, parameters: ExplosionParameters) {
  vi.stubGlobal('navigator', { language: 'en-US' })
  return renderToStaticMarkup(<I18nProvider><ExplosionControls category={category} parameters={parameters} onChange={() => undefined} /></I18nProvider>)
}

describe('field explosion shapes', () => {
  it('default is the billow burst: 24 frames, no stacked shared effects', () => {
    expect(DEFAULT_EXPLOSION_PARAMETERS.body.shape).toBe('billowBurst')
    expect(DEFAULT_EXPLOSION_PARAMETERS.frameCount).toBe(24)
    expect([DEFAULT_EXPLOSION_PARAMETERS.core.enabled, DEFAULT_EXPLOSION_PARAMETERS.fragments.enabled,
      DEFAULT_EXPLOSION_PARAMETERS.tongues.enabled, DEFAULT_EXPLOSION_PARAMETERS.shockwave.mode]).toEqual([false, false, false, 'none'])
  })

  for (const parameters of fieldShapes) {
    it(`${parameters.body.shape} is deterministic, in-palette, bounded, with transparent endpoints`, () => {
      const palette = new Set(parameters.palette.map(c => `${c.r},${c.g},${c.b},${c.a}`))
      const frames = renderExplosionFrames(parameters)
      const again = renderExplosionFrames(parameters)
      expect(frames.every((frame, i) => same(frame.pixels, again[i].pixels))).toBe(true)
      expect(opaqueCount(frames[0].pixels)).toBe(0)
      expect(opaqueCount(frames.at(-1)!.pixels)).toBe(0)
      expect(opaqueCount(frames[8].pixels)).toBeGreaterThan(500)
      let bad = 0
      for (const { width, height, pixels } of frames) for (let i = 0; i < pixels.length; i += 4) {
        if (!pixels[i + 3]) continue
        const x = (i / 4) % width, y = Math.floor(i / 4 / width)
        const inPalette = palette.has(`${pixels[i]},${pixels[i + 1]},${pixels[i + 2]},${pixels[i + 3]}`)
        if (!inPalette || x === 0 || y === 0 || x === width - 1 || y === height - 1) bad++
      }
      expect(bad).toBe(0)
    })

    it(`${parameters.body.shape} scales with the canvas and stays inside it at maximum settings`, () => {
      const extreme = { ...parameters, body: { ...parameters.body, billow: 1, impulse: 1, debrisCount: 24, throwDistance: 1, massCount: 14 } }
      for (const size of [32, 64, 200]) {
        for (const { width, height, pixels } of renderExplosionFrames(resizeExplosionCanvas(extreme, { width: size, height: size }))) {
          let edge = 0
          for (let i = 0; i < width; i++) edge += pixels[i * 4 + 3] + pixels[((height - 1) * width + i) * 4 + 3]
          for (let i = 0; i < height; i++) edge += pixels[i * width * 4 + 3] + pixels[(i * width + width - 1) * 4 + 3]
          expect(edge).toBe(0)
        }
      }
    }, 20_000)

    it(`${parameters.body.shape} plays backwards as an implosion`, () => {
      const forward = renderExplosionFrames(parameters)
      const backward = renderExplosionFrames({ ...parameters, motion: { ...parameters.motion, mode: 'implosion' } })
      expect(same(backward[5].pixels, forward[forward.length - 1 - 5].pixels)).toBe(true)
    })
  }

  it('every billow-burst control changes the render', () => {
    const p = DEFAULT_EXPLOSION_PARAMETERS
    for (const body of [{ impulse: 0 }, { billow: 0 }, { churnAmount: 0 }, { debrisCount: 0 }, { rotation: 90 }]) {
      expect(framesDiffer(p, { ...p, body: { ...p.body, ...body } })).toBe(true)
    }
    for (const surface of [{ bandWarp: 0 }, { edgeBreakup: 1 }]) {
      expect(framesDiffer(p, { ...p, surface: { ...p.surface, ...surface } as ExplosionParameters['surface'] })).toBe(true)
    }
  }, 20_000)

  it('draws billow debris over opaque parts of the main fire', () => {
    const withDebris = renderExplosionFrames(DEFAULT_EXPLOSION_PARAMETERS)
    const withoutDebris = renderExplosionFrames({
      ...DEFAULT_EXPLOSION_PARAMETERS,
      body: { ...DEFAULT_EXPLOSION_PARAMETERS.body, debrisCount: 0 },
    })
    const overlapsFire = withDebris.some((frame, frameIndex) => {
      const behind = withoutDebris[frameIndex].pixels
      for (let i = 0; i < frame.pixels.length; i += 4) {
        if (behind[i + 3] && (frame.pixels[i] !== behind[i] || frame.pixels[i + 1] !== behind[i + 1] || frame.pixels[i + 2] !== behind[i + 2])) return true
      }
      return false
    })
    expect(overlapsFire).toBe(true)
  })

  it('every fire-mass control changes the render', () => {
    const p = PUFF_EXPLOSION_PARAMETERS
    for (const body of [{ massCount: 5 }, { throwDistance: 0 }, { buoyancy: 1 }, { billow: 0 }, { rotation: 90 }]) {
      expect(framesDiffer(p, { ...p, body: { ...p.body, ...body } })).toBe(true)
    }
    for (const surface of [{ bandWarp: 0 }, { edgeBreakup: 1 }]) {
      expect(framesDiffer(p, { ...p, surface: { ...p.surface, ...surface } as ExplosionParameters['surface'] })).toBe(true)
    }
  }, 20_000)

  it('requires the burning-layers surface and bounded field values', () => {
    const body = DEFAULT_EXPLOSION_PARAMETERS.body
    expect(() => assertValidExplosionParameters({ ...DEFAULT_EXPLOSION_PARAMETERS, surface: { style: 'rollingSoot', coverage: 1, sootAmount: 0.3, sootScale: 11 } })).toThrow(RangeError)
    for (const patch of [{ debrisCount: 25 }, { debrisCount: 1.5 }, { massCount: 3 }, { impulse: 2 }]) {
      expect(() => assertValidExplosionParameters({ ...DEFAULT_EXPLOSION_PARAMETERS, body: { ...body, ...patch } })).toThrow(RangeError)
    }
  })

  it('loads projects and presets saved before the field shapes existed', () => {
    const serialized = serializeExplosionParameters(DEFAULT_EXPLOSION_PARAMETERS) as Record<string, Record<string, unknown>>
    const { impulse: _i, billow: _b, debrisCount: _d, massCount: _m, throwDistance: _t, buoyancy: _y, ...oldBody } = serialized.body
    expect(parseExplosionParameters({ ...serialized, body: oldBody })).toEqual(DEFAULT_EXPLOSION_PARAMETERS)
    const preset = captureExplosionPreset(PUFF_EXPLOSION_PARAMETERS) as Record<string, Record<string, unknown>>
    const { massCount: _pm, ...oldPresetBody } = preset.body
    expect(parseExplosionPresetPayload({ ...preset, body: oldPresetBody }).body.massCount).toBe(9)
    // A field shape arriving with another surface style is coerced to burning layers.
    const mixed = { ...preset, surface: { style: 'rollingSoot', coverage: 0.9, sootAmount: 0.3, sootScale: 11 } }
    expect(applyExplosionPreset(DEFAULT_EXPLOSION_PARAMETERS, mixed as never).surface.style).toBe('burningLayers')
  })

  it('shows only the controls each field shape uses', () => {
    const billow = renderControls('body', DEFAULT_EXPLOSION_PARAMETERS)
    expect(billow).toContain('Billow burst')
    expect(billow).toContain('Fire masses')
    expect(billow.indexOf('Billow burst')).toBeLessThan(billow.indexOf('Legacy radial'))
    for (const label of ['Front surge', 'Billows', 'Mid-life turnover', 'Sparks and debris']) expect(billow).toContain(label)
    expect(billow).not.toContain('Mass count')
    const puff = renderControls('body', PUFF_EXPLOSION_PARAMETERS)
    for (const label of ['Mass count', 'Throw distance', 'Rise', 'Billows']) expect(puff).toContain(label)
    expect(puff).not.toContain('Front surge')
    const motion = renderControls('motion', DEFAULT_EXPLOSION_PARAMETERS)
    expect(motion).toContain('Implosion')
    expect(motion).not.toContain('Crisp')
    const material = renderControls('material', DEFAULT_EXPLOSION_PARAMETERS)
    expect(material).not.toContain('Retro pixel')
    expect(material).not.toContain('Convert')
  })
})
