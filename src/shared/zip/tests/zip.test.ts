import { describe, expect, it } from 'vitest'
import { unzipSync } from 'fflate'
import { buildProjectDocument } from '../../project/document'
import { buildSpriteSheetManifest, buildFrameZip, buildUnityZip, frameNamesFor, zipEntries, type FrameZipInput, type UnityZipInput } from '../zip'
import { encodePng } from '../../pixel/png'
import type { PixelFrame } from '../../pixel/frame'
import type { GeneratorProjectCodec } from '../../project/types'

const codec: GeneratorProjectCodec<unknown> = {
  generatorId: 'slash',
  version: 1,
  serialize: (parameters) => parameters as never,
  parse: (value) => value,
}

const project = buildProjectDocument(codec, { radius: 44 }, 12, { pixelsPerUnit: 100, guid: null })

function sampleFrame(index: number, width = 128, height = 128): PixelFrame {
  const pixels = new Uint8ClampedArray(width * height * 4)
  for (let offset = 0; offset < pixels.length; offset += 4) {
    pixels[offset] = index
    pixels[offset + 3] = index === 1 ? 0 : 255
  }
  return { width, height, pixels }
}

const frames = [sampleFrame(0), sampleFrame(1)]

const frameZipInput = (): FrameZipInput => ({
  generatorId: 'slash',
  frames,
  fps: 12,
  project,
  folderName: 'pixel-slash-128x128-2-frames',
  frameNamePrefix: 'slash',
})

const unityZipInput = (): UnityZipInput => ({
  generatorId: 'slash',
  frames,
  fps: 12,
  project,
  pixelsPerUnit: 100,
  guid: 'b93362e4a2b3bc240b452b57b97a4147',
  layout: 'compact',
  folderName: 'pixel-slash-128x128-2-frames-compact-unity6',
  imageName: 'pixel-slash-128x128-2-frames-compact.png',
})

describe('zipEntries', () => {
  it('stamps every entry with the fixed 1980-01-01 local time', () => {
    const bytes = zipEntries([
      { name: 'a.txt', bytes: new TextEncoder().encode('hello') },
      { name: 'b.txt', bytes: new TextEncoder().encode('world') },
    ])
    // Local file header: signature 0x04034b50, then version, flags, method,
    // mod time at offset 10, mod date at offset 12.
    expect(readUint32LE(bytes, 0)).toBe(0x04034b50)
    expect(readUint16LE(bytes, 10)).toBe(0)
    expect(readUint16LE(bytes, 12)).toBe(0x21)
  })

  it('produces identical bytes for identical entries', () => {
    const entries = [{ name: 'a.txt', bytes: new TextEncoder().encode('fixed') }]
    expect(bytesEqual(zipEntries(entries), zipEntries(entries))).toBe(true)
  })
})

describe('buildFrameZip', () => {
  it('contains manifest.json and every frame in order', () => {
    const bytes = buildFrameZip(frameZipInput())
    const unzipped = unzipSync(bytes)
    expect(Object.keys(unzipped)).toEqual([
      'pixel-slash-128x128-2-frames/manifest.json',
      'pixel-slash-128x128-2-frames/frames/slash_000.png',
      'pixel-slash-128x128-2-frames/frames/slash_001.png',
    ])
    const manifest = JSON.parse(new TextDecoder().decode(unzipped['pixel-slash-128x128-2-frames/manifest.json']))
    expect(manifest.schema).toBe('minerva.pixel-effect.manifest')
    expect(manifest.version).toBe(1)
    expect(manifest.generator).toBe('slash')
    expect(manifest.output.type).toBe('frame-sequence')
    expect(manifest.output.frameCount).toBe(2)
    expect(manifest.output.fps).toBe(12)
    expect(manifest.output.frames).toEqual([
      { index: 0, name: 'slash_000', file: 'frames/slash_000.png' },
      { index: 1, name: 'slash_001', file: 'frames/slash_001.png' },
    ])
    expect(bytesEqual(unzipped['pixel-slash-128x128-2-frames/frames/slash_000.png'], encodePng(frames[0]))).toBe(true)
    expect(bytesEqual(unzipped['pixel-slash-128x128-2-frames/frames/slash_001.png'], encodePng(frames[1]))).toBe(true)
  })

  it('keeps the final transparent frame and is deterministic', () => {
    const first = buildFrameZip(frameZipInput())
    const second = buildFrameZip(frameZipInput())
    expect(bytesEqual(first, second)).toBe(true)
    const unzipped = unzipSync(first)
    expect(unzipped['pixel-slash-128x128-2-frames/frames/slash_001.png'].length).toBeGreaterThan(0)
  })

  it('rejects empty frame sets', () => {
    expect(() => buildFrameZip({ ...frameZipInput(), frames: [] })).toThrow(RangeError)
  })
})

describe('buildUnityZip', () => {
  it('contains manifest, atlas PNG, and matching .meta', () => {
    const bytes = buildUnityZip(unityZipInput())
    const unzipped = unzipSync(bytes)
    expect(Object.keys(unzipped)).toEqual([
      'pixel-slash-128x128-2-frames-compact-unity6/manifest.json',
      'pixel-slash-128x128-2-frames-compact-unity6/pixel-slash-128x128-2-frames-compact.png',
      'pixel-slash-128x128-2-frames-compact-unity6/pixel-slash-128x128-2-frames-compact.png.meta',
    ])
    const manifest = JSON.parse(new TextDecoder().decode(unzipped['pixel-slash-128x128-2-frames-compact-unity6/manifest.json']))
    expect(manifest.output.type).toBe('sprite-sheet')
    expect(manifest.output.layout).toBe('compact')
    expect(manifest.output.coordinateOrigin).toBe('top-left')
    expect(manifest.output.columns).toBe(1)
    expect(manifest.output.rows).toBe(2)
    expect(manifest.output.sprites.map((sprite: { name: string }) => sprite.name)).toEqual(['slash_000', 'slash_001'])
    const meta = new TextDecoder().decode(unzipped['pixel-slash-128x128-2-frames-compact-unity6/pixel-slash-128x128-2-frames-compact.png.meta'])
    expect(meta).toContain('guid: b93362e4a2b3bc240b452b57b97a4147')
    expect(meta).toContain('spritePixelsToUnits: 100')
    expect(meta).toContain('spriteMode: 2')
  })

  it('rejects Unity atlases beyond 16384px even when called directly', () => {
    const wideFrames = Array.from({ length: 130 }, (_, index) => sampleFrame(index))
    expect(() => buildUnityZip({
      ...unityZipInput(),
      frames: wideFrames,
      layout: 'horizontal',
      imageName: 'pixel-slash-128x128-130-frames-horizontal.png',
    })).toThrow(RangeError)
  })

  it('keeps PNG and frame ZIP outputs unlimited by the Unity atlas cap', () => {
    const wideFrames = Array.from({ length: 130 }, (_, index) => sampleFrame(index))
    expect(() => buildFrameZip({ ...frameZipInput(), frames: wideFrames })).not.toThrow()
  })

  it('only the GUID and meta change when the stable GUID changes', () => {
    const first = unzipSync(buildUnityZip(unityZipInput()))
    const second = unzipSync(buildUnityZip({ ...unityZipInput(), guid: '9236350a1e871924d8fa3d928a4fd363' }))
    const firstMeta = first['pixel-slash-128x128-2-frames-compact-unity6/pixel-slash-128x128-2-frames-compact.png.meta']
    const secondMeta = second['pixel-slash-128x128-2-frames-compact-unity6/pixel-slash-128x128-2-frames-compact.png.meta']
    expect(bytesEqual(
      first['pixel-slash-128x128-2-frames-compact-unity6/pixel-slash-128x128-2-frames-compact.png'],
      second['pixel-slash-128x128-2-frames-compact-unity6/pixel-slash-128x128-2-frames-compact.png'],
    )).toBe(true)
    expect(bytesEqual(
      first['pixel-slash-128x128-2-frames-compact-unity6/manifest.json'],
      second['pixel-slash-128x128-2-frames-compact-unity6/manifest.json'],
    )).toBe(true)
    expect(bytesEqual(firstMeta, secondMeta)).toBe(false)
  })

  it('builds a horizontal atlas with the same structure', () => {
    const bytes = buildUnityZip({ ...unityZipInput(), layout: 'horizontal', imageName: 'pixel-slash-128x128-2-frames-horizontal.png' })
    const unzipped = unzipSync(bytes)
    const keys = Object.keys(unzipped)
    expect(keys[0]).toBe('pixel-slash-128x128-2-frames-compact-unity6/manifest.json')
    const parsed = JSON.parse(new TextDecoder().decode(unzipped[keys[0]]))
    expect(parsed.output.layout).toBe('horizontal')
    expect((parsed.output as { image: string }).image).toBe('pixel-slash-128x128-2-frames-horizontal.png')
  })
})

describe('buildSpriteSheetManifest and frameNamesFor', () => {
  it('pads frame names to at least three digits', () => {
    expect(frameNamesFor(5, 'slash')).toEqual(['slash_000', 'slash_001', 'slash_002', 'slash_003', 'slash_004'])
    expect(frameNamesFor(24, 'slash')[23]).toBe('slash_023')
  })

  it('writes the sprite sheet manifest with stable fields', () => {
    const manifest = buildSpriteSheetManifest(unityZipInput(), {
      frame: sampleFrame(0, 256, 128),
      columns: 2,
      rows: 1,
      sprites: [
        { index: 0, name: 'slash_000', x: 0, y: 0, width: 128, height: 128 },
        { index: 1, name: 'slash_001', x: 128, y: 0, width: 128, height: 128 },
      ],
    })
    expect(manifest.project).toEqual(project)
    expect((manifest.output as { image: string }).image).toBe('pixel-slash-128x128-2-frames-compact.png')
  })
})

function readUint16LE(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8)
}

function readUint32LE(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0)
}

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) {
    return false
  }
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false
    }
  }
  return true
}
