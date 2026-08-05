import { describe, expect, it } from 'vitest'
import { buildUnitySpriteEntries, renderUnityMetaYaml, type UnityMetaInput } from '../meta'
import fixtureMeta from './fixtures/two-frame-atlas.png.meta?raw'

const sampleInput = (): UnityMetaInput => ({
  guid: 'b93362e4a2b3bc240b452b57b97a4147',
  pixelsPerUnit: 100,
  sheetWidth: 384,
  sheetHeight: 384,
  generatorId: 'slash',
  sprites: [
    { index: 0, name: 'slash_000', x: 0, y: 0, width: 128, height: 128 },
    { index: 1, name: 'slash_001', x: 128, y: 0, width: 128, height: 128 },
    { index: 2, name: 'slash_002', x: 256, y: 0, width: 128, height: 128 },
    { index: 3, name: 'slash_003', x: 0, y: 128, width: 128, height: 128 },
  ],
})

describe('buildUnitySpriteEntries', () => {
  it('flips Y coordinates from top-left to Unity bottom-left origin', () => {
    const entries = buildUnitySpriteEntries(sampleInput())
    expect(entries.map((entry) => entry.unityY)).toEqual([256, 256, 256, 128])
    expect(entries[0]).toMatchObject({ name: 'slash_000', x: 0, width: 128, height: 128 })
  })

  it('generates deterministic file IDs and sprite IDs that are unique', () => {
    const first = buildUnitySpriteEntries(sampleInput())
    const second = buildUnitySpriteEntries(sampleInput())
    expect(first.map((entry) => entry.fileId)).toEqual(second.map((entry) => entry.fileId))
    expect(first.map((entry) => entry.spriteId)).toEqual(second.map((entry) => entry.spriteId))
    expect(new Set(first.map((entry) => entry.fileId.toString())).size).toBe(first.length)
    expect(new Set(first.map((entry) => entry.spriteId)).size).toBe(first.length)
  })

  it('rejects invalid GUIDs', () => {
    expect(() => buildUnitySpriteEntries({ ...sampleInput(), guid: 'nope' })).toThrow(RangeError)
  })
})

describe('renderUnityMetaYaml', () => {
  it('writes Unity 6 Multiple sprite mode and the fixed export settings', () => {
    const yaml = renderUnityMetaYaml(sampleInput())
    expect(yaml).toContain('fileFormatVersion: 2')
    expect(yaml).toContain('guid: b93362e4a2b3bc240b452b57b97a4147')
    expect(yaml).toContain('serializedVersion: 13')
    expect(yaml).toContain('spriteMode: 2')
    expect(yaml).not.toContain('spriteMode: 1')
    expect(yaml).toContain('textureType: 8')
    expect(yaml).toContain('filterMode: 0')
    expect(yaml).toContain('wrapU: 1')
    expect(yaml).toContain('wrapV: 1')
    expect(yaml).toContain('wrapW: 1')
    expect(yaml).toContain('textureCompression: 0')
    expect(yaml).toContain('spritePixelsToUnits: 100')
    expect(yaml).toContain('isReadable: 0')
    expect(yaml).toContain('spriteGenerateFallbackPhysicsShape: 1')
    expect(yaml).toContain('alphaIsTransparency: 1')
    expect(yaml).toContain('internalIDToNameTable: []')
  })

  it('writes Center pivot and Unity-6 tessellation detail per sprite', () => {
    const yaml = renderUnityMetaYaml(sampleInput())
    expect(yaml).toContain('      pivot: {x: 0.5, y: 0.5}')
    expect(yaml).toContain('      tessellationDetail: -1')
    expect(yaml).not.toContain('pivot: {x: 0, y: 0}')
    expect(yaml).not.toContain('tessellationDetail: 0')
  })

  it('writes an empty sheet-level spriteID and an empty internalIDToNameTable', () => {
    const yaml = renderUnityMetaYaml(sampleInput())
    expect(yaml).toContain('\n    spriteID: \n')
    expect(yaml).not.toContain('      213:')
  })

  it('writes one sprite entry per frame with matching name tables', () => {
    const yaml = renderUnityMetaYaml(sampleInput())
    const entries = buildUnitySpriteEntries(sampleInput())
    for (const entry of entries) {
      expect(yaml).toContain(`name: ${entry.name}`)
      expect(yaml).toContain(`internalID: ${entry.fileId}`)
      expect(yaml).toContain(`spriteID: ${entry.spriteId}`)
      expect(yaml).toContain(`${entry.name}: ${entry.fileId}`)
    }
    expect((yaml.match(/name: slash_/g) ?? []).length).toBe(sampleInput().sprites.length)
    expect((yaml.match(/\n      internalID: -?\d+/g) ?? []).length).toBe(sampleInput().sprites.length)
  })

  it('is deterministic for identical inputs', () => {
    expect(renderUnityMetaYaml(sampleInput())).toBe(renderUnityMetaYaml(sampleInput()))
  })

  it('renders PPU and rects for a single row atlas', () => {
    const input = {
      ...sampleInput(),
      pixelsPerUnit: 32,
      sheetWidth: 512,
      sheetHeight: 128,
      sprites: [
        { index: 0, name: 'slash_000', x: 0, y: 0, width: 256, height: 128 },
        { index: 1, name: 'slash_001', x: 256, y: 0, width: 256, height: 128 },
      ],
    }
    const yaml = renderUnityMetaYaml(input)
    expect(yaml).toContain('spritePixelsToUnits: 32')
    expect(yaml).toContain('x: 0')
    expect(yaml).toContain('x: 256')
    expect(yaml).toContain('y: 0')
  })
})

describe('resolveUnityMaxTextureSize in meta output', () => {
  it('writes the computed max size into the root and every platform entry', () => {
    const yaml = renderUnityMetaYaml(sampleInput())
    expect((yaml.match(/maxTextureSize: 512/g) ?? []).length).toBe(4)
  })

  it('rounds 3072px atlases up to 4096', () => {
    const input = { ...sampleInput(), sheetWidth: 3072, sheetHeight: 128 }
    const yaml = renderUnityMetaYaml(input)
    expect((yaml.match(/maxTextureSize: 4096/g) ?? []).length).toBe(4)
  })

  it('rounds 12288px atlases up to 16384', () => {
    const input = { ...sampleInput(), sheetWidth: 12288, sheetHeight: 512 }
    const yaml = renderUnityMetaYaml(input)
    expect((yaml.match(/maxTextureSize: 16384/g) ?? []).length).toBe(4)
  })

  it('rejects atlases beyond the Unity 6 limit', () => {
    expect(() => renderUnityMetaYaml({ ...sampleInput(), sheetWidth: 16385, sheetHeight: 128 })).toThrow(RangeError)
  })
})

describe('Unity 6 fixture structure', () => {
  it('matches the real Unity 6000.3.9f1 generated meta after normalizing dynamic values', () => {
    const generated = renderUnityMetaYaml({
      guid: 'f6c9d7ccee798414e937b0ddb11c9486',
      pixelsPerUnit: 100,
      sheetWidth: 256,
      sheetHeight: 128,
      generatorId: 'slash',
      sprites: [
        { index: 0, name: 'slash_000', x: 0, y: 0, width: 128, height: 128 },
        { index: 1, name: 'slash_001', x: 128, y: 0, width: 128, height: 128 },
      ],
    })
    const fixtureLines = staticStructureLines(fixtureMeta)
    const generatedLines = staticStructureLines(generated)
    expect(generatedLines.filter((line) => !fixtureLines.includes(line))).toEqual([])
    expect(fixtureLines.filter((line) => !generatedLines.includes(line))).toEqual([])
  })
})

/**
 * Extracts the static structure of a `.meta`: trims lines, skips the
 * platformSettings block (platform lists differ across Unity versions) and
 * normalizes dynamic values (GUID, sprite IDs, file IDs, max texture size).
 */
function staticStructureLines(meta: string): string[] {
  const lines: string[] = []
  let inPlatformSettings = false
  for (const raw of meta.split('\n')) {
    const line = raw.trimEnd()
    if (line.trimStart().startsWith('platformSettings:')) {
      inPlatformSettings = true
      continue
    }
    if (inPlatformSettings && line.trimStart().startsWith('spriteSheet:')) {
      inPlatformSettings = false
    }
    if (inPlatformSettings || isDynamicLine(line)) {
      continue
    }
    lines.push(line)
  }
  return lines
}

function isDynamicLine(line: string): boolean {
  const trimmed = line.trim()
  return (
    /^guid: [0-9a-f]{32}$/i.test(trimmed)
    || /^spriteID: [0-9a-f]{32}$/i.test(trimmed)
    || /^internalID: -?\d+$/.test(trimmed)
    || /^maxTextureSize: \d+$/.test(trimmed)
    || /^\S+: -?\d+$/.test(trimmed)
  )
}
