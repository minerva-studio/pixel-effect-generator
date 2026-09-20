import { describe, expect, it } from 'vitest'
import { DEFAULT_FLAME_PARAMETERS as base, assertValidFlameParameters, resizeFlameCanvas } from '../model'
import { renderFlameFrame, renderFlameFrames } from '../renderer'
import { FLAME_SHAPE_DEFAULTS, flamePresetCapability, captureFlamePreset } from '../presets'
import { flameProjectCodec } from '../project'
import { buildProjectDocument, parseProjectDocument } from '../../../shared/project/document'
import { packSpriteSheet } from '../../../shared/pixel/atlas'
import { encodePng } from '../../../shared/pixel/png'
import { encodeAnimation } from '../../../shared/pixel/animation'
import type { PixelFrame } from '../../../shared/pixel/frame'
import { buildFrameZip, buildUnityZip } from '../../../shared/zip/zip'
import { unzipSync } from 'fflate'

function sameFrame(a: PixelFrame, b: PixelFrame): boolean {
  return a.width === b.width && a.height === b.height && a.pixels.length === b.pixels.length && a.pixels.every((value, i) => value === b.pixels[i])
}

function componentCount(frame: PixelFrame) {
  const seen = new Set<number>()
  let components = 0
  for (let i = 0; i < frame.width * frame.height; i++) {
    if (!frame.pixels[i * 4 + 3] || seen.has(i)) continue
    components++
    const queue = [i]; seen.add(i)
    for (let j = 0; j < queue.length; j++) {
      const k = queue[j], x = k % frame.width
      for (const n of [x > 0 ? k - 1 : -1, x < frame.width - 1 ? k + 1 : -1, k - frame.width, k + frame.width]) {
        if (n >= 0 && n < frame.width * frame.height && frame.pixels[n * 4 + 3] && !seen.has(n)) { seen.add(n); queue.push(n) }
      }
    }
  }
  return components
}

describe('flame model and persistence', () => {
  it('validates every shape and scaled extreme canvas', () => {
    for (const p of Object.values(FLAME_SHAPE_DEFAULTS)) for (const size of [{ width: 16, height: 16 }, { width: 512, height: 16 }, { width: 16, height: 512 }, { width: 512, height: 512 }]) {
      for (const scale of [false, true]) expect(() => assertValidFlameParameters(resizeFlameCanvas(p, size, scale))).not.toThrow()
    }
    expect(resizeFlameCanvas(base, { width: 256, height: 256 }).baseWidth).toBe(base.baseWidth * 2)
  })
  it.each([{ width: NaN }, { height: Infinity }, { shape: 'smoke' }, { width: 0 }, { loopCycles: 1.5 }, { flowSpeed: 1.5 }, { seed: -1 }, { sparksEnabled: 'yes' }, { palette: [] }, { palette: base.palette.map(c => ({ ...c, a: 128 })) }])('rejects malformed values %j', (patch) => {
    expect(() => flameProjectCodec.parse({ ...base, ...patch })).toThrow()
  })
  it('round-trips project state and rejects wrong generator without accepting missing fields', () => {
    const doc = buildProjectDocument(flameProjectCodec, base, 12, { pixelsPerUnit: 32, guid: null })
    const result = parseProjectDocument(JSON.parse(JSON.stringify(doc)), flameProjectCodec)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.project.project.parameters).toEqual(base)
    expect(parseProjectDocument({ ...doc, generator: 'projectile' }, flameProjectCodec).ok).toBe(false)
    const { width, ...missing } = base
    expect(() => flameProjectCodec.parse(missing)).toThrow()
    const parsed = flameProjectCodec.parse(base)
    expect(parsed.palette).not.toBe(base.palette)
  })
  it('validates and applies presets while retaining canvas and frame count', () => {
    for (const preset of flamePresetCapability.builtIns) {
      expect(flamePresetCapability.validate(preset.payload).ok).toBe(true)
      const p = flamePresetCapability.apply(resizeFlameCanvas({ ...base, frameCount: 7 }, { width: 16, height: 16 }), preset.payload)
      expect(p).toMatchObject({ canvasWidth: 16, canvasHeight: 16, frameCount: 7, shape: preset.id })
      expect(() => assertValidFlameParameters(p)).not.toThrow()
    }
    expect(captureFlamePreset(base)).not.toHaveProperty('canvasWidth')
    expect(captureFlamePreset(base)).not.toHaveProperty('frameCount')
  })
})

describe('flame rendering', () => {
  it.each(['torch', 'campfire'] as const)('varies upper contour branches and increases motion with turbulence for %s', (shape) => {
    const p = { ...FLAME_SHAPE_DEFAULTS[shape], edgeBreakup: 0, sparksEnabled: false }
    const gentle = renderFlameFrames({ ...p, turbulence: 0.15 })
    const strong = renderFlameFrames({ ...p, turbulence: 0.95 })
    // Horizontal sections through the upper body must split and rejoin over time.
    const row = p.canvasHeight - 3 - Math.round(p.height * 0.65)
    const branches = strong.map(frame => {
      let count = 0, previous = false
      for (let x = 0; x < frame.width; x++) {
        const occupied = frame.pixels[(row * frame.width + x) * 4 + 3] > 0
        if (occupied && !previous) count++
        previous = occupied
      }
      return count
    })
    expect(new Set(branches).size).toBeGreaterThan(1)
    const motion = (frames: PixelFrame[]) => frames.reduce((sum, frame, i) => {
      const next = frames[(i + 1) % frames.length]
      for (let pixel = 3; pixel < frame.pixels.length; pixel += 4) if (frame.pixels[pixel] !== next.pixels[pixel]) sum++
      return sum
    }, 0)
    expect(motion(strong)).toBeGreaterThan(motion(gentle))
    expect(sameFrame(renderFlameFrame({ ...p, turbulence: 0.95 }, 0), renderFlameFrame({ ...p, turbulence: 0.95 }, 1))).toBe(true)
  })
  it.each(Object.values(FLAME_SHAPE_DEFAULTS))('renders deterministic $shape loops with fixed roots and bounded chips', (preset) => {
    const p = { ...preset, sparksEnabled: false }
    const frames = renderFlameFrames(p)
    const repeated = renderFlameFrames(p)
    expect(frames.every((frame, i) => sameFrame(frame, repeated[i]))).toBe(true)
    expect(frames).toHaveLength(12)
    for (const frame of frames) {
      expect(componentCount(frame)).toBeLessThanOrEqual(1 + Math.ceil(p.edgeBreakup * 5))
      const alphas = frame.pixels.filter((_, i) => i % 4 === 3)
      expect(new Set(alphas)).toEqual(new Set([0, 255]))
      expect(frame.pixels[((p.canvasHeight - 3) * p.canvasWidth + Math.floor(p.canvasWidth / 2)) * 4 + 3]).toBe(255)
    }
    expect(sameFrame(renderFlameFrame(p, 0), renderFlameFrame(p, 1))).toBe(true)
    expect(sameFrame(frames.at(-1)!, frames[0])).toBe(false)
    const difference = (a: PixelFrame, b: PixelFrame) => a.pixels.reduce((sum, value, i) => sum + (value !== b.pixels[i] ? 1 : 0), 0)
    const steps = frames.map((frame, i) => difference(frame, frames[(i + 1) % frames.length]))
    expect(steps.at(-1)!).toBeLessThanOrEqual(Math.max(...steps.slice(0, -1)) * 1.5)
    for (const cycles of [1, 2, 3, 4]) expect(sameFrame(renderFlameFrame({ ...p, loopCycles: cycles, flowSpeed: cycles }, 0.25), renderFlameFrame({ ...p, loopCycles: cycles, flowSpeed: cycles }, 1.25))).toBe(true)
  })
  it('preserves a rooted body at small sizes and maximum disturbances', () => {
    for (const preset of Object.values(FLAME_SHAPE_DEFAULTS)) {
      const p = resizeFlameCanvas({ ...preset, fork: 1, turbulence: 1, sway: 1, roughness: 1, edgeBreakup: 1, sparksEnabled: false }, { width: 16, height: 16 })
      for (const frame of renderFlameFrames(p)) {
        expect(componentCount(frame)).toBeLessThanOrEqual(6)
        expect(frame.pixels[((p.canvasHeight - 3) * p.canvasWidth + Math.floor(p.canvasWidth / 2)) * 4 + 3]).toBe(255)
      }
    }
  })
  it('cuts only the outer flame, preserves root colors, and permits chips independently of sparks', () => {
    for (const preset of Object.values(FLAME_SHAPE_DEFAULTS)) {
      const p = { ...preset, sparksEnabled: false, edgeBreakup: 0 }
      const intact = renderFlameFrames(p)
      const broken = renderFlameFrames({ ...p, edgeBreakup: 1 })
      let removed = 0
      for (let f = 0; f < intact.length; f++) {
        expect(componentCount(intact[f])).toBe(1)
        expect(componentCount(broken[f])).toBeLessThanOrEqual(6)
        for (let i = 0; i < intact[f].pixels.length; i += 4) {
          if (broken[f].pixels[i + 3]) expect(broken[f].pixels.slice(i, i + 4)).toEqual(intact[f].pixels.slice(i, i + 4))
          else if (intact[f].pixels[i + 3]) removed++
        }
        const rootStart = (p.canvasHeight - 4) * p.canvasWidth * 4
        expect(broken[f].pixels.slice(rootStart)).toEqual(intact[f].pixels.slice(rootStart))
      }
      expect(removed).toBeGreaterThan(0)
      expect(broken.some(f => componentCount(f) > 1)).toBe(true)
      const strong = { ...p, edgeBreakup: 1 }
      expect(sameFrame(renderFlameFrame(strong, 0), renderFlameFrame(strong, 1))).toBe(true)
      expect(sameFrame(renderFlameFrame(strong, 0.25), renderFlameFrame(strong, 1.25))).toBe(true)
    }
  })
  it('changes silhouettes by shape even when size and motion match', () => {
    const frames = (['candle', 'torch', 'campfire'] as const).map(shape => renderFlameFrame({ ...base, shape, sparksEnabled: false }, 0.25))
    expect(frames[0]).not.toEqual(frames[1]); expect(frames[1]).not.toEqual(frames[2])
  })
  it('adds detached moving sparks with a periodic seam', () => {
    const p = { ...FLAME_SHAPE_DEFAULTS.campfire, sparkCount: 24, sparkRise: 80, sparkSpread: 1 }
    const frames = renderFlameFrames(p)
    expect(frames.some(f => componentCount(f) > 1)).toBe(true)
    expect(frames[0]).not.toEqual(frames[1])
    expect(renderFlameFrame(p, 0)).toEqual(renderFlameFrame(p, 1))
  })
  it('encodes both atlas layouts and looping GIF/APNG from the same frames', () => {
    const frames = renderFlameFrames(base)
    for (const layout of ['horizontal', 'compact'] as const) {
      const packed = packSpriteSheet(frames, layout)
      expect(packed.sprites).toHaveLength(12)
      expect(encodePng(packed.frame).slice(0, 4)).toEqual(new Uint8Array([137, 80, 78, 71]))
    }
    for (const format of ['gif', 'apng'] as const) expect(encodeAnimation({ format, frames, fps: 12, loop: true }).bytes.length).toBeGreaterThan(100)
  })
  it('exports frame and Unity packages with a reloadable flame project', () => {
    const frames = renderFlameFrames(base)
    const project = buildProjectDocument(flameProjectCodec, base, 12, { pixelsPerUnit: 32, guid: null })
    const common = { generatorId: 'flame', frames, fps: 12, project, folderName: 'flame' }
    const frameArchive = unzipSync(buildFrameZip({ ...common, frameNamePrefix: 'flame' }))
    expect(Object.keys(frameArchive).filter(name => name.endsWith('.png'))).toHaveLength(12)
    for (const layout of ['horizontal', 'compact'] as const) {
      const archive = unzipSync(buildUnityZip({ ...common, layout, pixelsPerUnit: 32, guid: '1234567890abcdef1234567890abcdef', imageName: 'flame.png' }))
      expect(Object.keys(archive).some(name => name.endsWith('.meta'))).toBe(true)
      const manifestPath = Object.keys(archive).find(name => name.endsWith('manifest.json'))!
      const manifest = JSON.parse(new TextDecoder().decode(archive[manifestPath]))
      expect(manifest.generator).toBe('flame')
      expect(manifest.output.sprites).toHaveLength(12)
      expect(parseProjectDocument(manifest.project, flameProjectCodec).ok).toBe(true)
    }
  })
})
