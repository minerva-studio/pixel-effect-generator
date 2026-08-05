import { describe, expect, it } from 'vitest'
import type { GeneratorProjectCodec, JsonValue } from '../types'
import {
  MAX_PIXELS_PER_UNIT,
  MIN_PIXELS_PER_UNIT,
  PROJECT_SCHEMA,
  PROJECT_VERSION,
  SUPPORTED_PREVIEW_FPS,
  buildProjectDocument,
  parseProjectDocument,
  serializeProjectDocument,
  type ParsedProjectDocument,
} from '../document'

const codec: GeneratorProjectCodec<unknown> = {
  generatorId: 'slash',
  version: 1,
  serialize: (parameters) => parameters as JsonValue,
  parse: (value) => {
    if (!isRecord(value) || typeof value.radius !== 'number') {
      throw new RangeError('invalid parameters')
    }
    return { radius: value.radius, label: String(value.label) }
  },
}

const validDocument = () => ({
  schema: PROJECT_SCHEMA,
  version: PROJECT_VERSION,
  generator: 'slash',
  parameters: { radius: 44, label: 'sweep' },
  playback: { fps: 12 },
  export: { unity: { pixelsPerUnit: 100, guid: null } },
})

describe('serializeProjectDocument', () => {
  it('writes stable field order with two-space indent and a trailing newline', () => {
    const json = serializeProjectDocument(codec, { radius: 44 }, 12, { pixelsPerUnit: 100, guid: null })
    expect(json).toBe([
      '{',
      '  "schema": "minerva.pixel-effect",',
      '  "version": 1,',
      '  "generator": "slash",',
      '  "parameters": {',
      '    "radius": 44',
      '  },',
      '  "playback": {',
      '    "fps": 12',
      '  },',
      '  "export": {',
      '    "unity": {',
      '      "pixelsPerUnit": 100,',
      '      "guid": null',
      '    }',
      '  }',
      '}',
      '',
    ].join('\n'))
  })

  it('normalizes a hyphenated GUID to lowercase hex without dashes', () => {
    const json = serializeProjectDocument(codec, {}, 8, {
      pixelsPerUnit: 100,
      guid: 'B93362E4-A2B3-BC24-0B45-2B57B97A4147',
    })
    expect(JSON.parse(json).export.unity.guid).toBe('b93362e4a2b3bc240b452b57b97a4147')
  })

  it('rejects unsupported FPS, out-of-range PPU, and invalid GUIDs', () => {
    expect(() => serializeProjectDocument(codec, {}, 10, { pixelsPerUnit: 100, guid: null })).toThrow(RangeError)
    expect(() => serializeProjectDocument(codec, {}, 12, { pixelsPerUnit: 0, guid: null })).toThrow(RangeError)
    expect(() => serializeProjectDocument(codec, {}, 12, { pixelsPerUnit: 1025, guid: null })).toThrow(RangeError)
    expect(() => serializeProjectDocument(codec, {}, 12, { pixelsPerUnit: 100, guid: 'nope' })).toThrow(RangeError)
  })

  it('builds the same document object that serialize writes', () => {
    const document = buildProjectDocument(codec, { radius: 44 }, 12, { pixelsPerUnit: 100, guid: null })
    expect(JSON.parse(serializeProjectDocument(codec, { radius: 44 }, 12, { pixelsPerUnit: 100, guid: null })))
      .toEqual(JSON.parse(JSON.stringify(document)))
  })

  it('serializes identical inputs to identical bytes', () => {
    const first = serializeProjectDocument(codec, { radius: 44 }, 12, { pixelsPerUnit: 100, guid: 'B93362E4-A2B3-BC24-0B45-2B57B97A4147' })
    const second = serializeProjectDocument(codec, { radius: 44 }, 12, { pixelsPerUnit: 100, guid: 'b93362e4a2b3bc240b452b57b97a4147' })
    expect(first).toBe(second)
  })

  it('serialized baselines only change for persistent project fields', () => {
    const settings = { pixelsPerUnit: 100, guid: null }
    const base = serializeProjectDocument(codec, { radius: 44 }, 12, settings)
    expect(serializeProjectDocument(codec, { radius: 44 }, 12, settings)).toBe(base)
    expect(serializeProjectDocument(codec, { radius: 45 }, 12, settings)).not.toBe(base)
    expect(serializeProjectDocument(codec, { radius: 44 }, 24, settings)).not.toBe(base)
    expect(serializeProjectDocument(codec, { radius: 44 }, 12, { pixelsPerUnit: 64, guid: null })).not.toBe(base)
  })
})

describe('parseProjectDocument', () => {
  it('round-trips a valid document and returns typed contents', () => {
    const result = parseProjectDocument(validDocument(), codec)
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.project.fps).toBe(12)
    expect(result.project.exportSettings).toEqual({ pixelsPerUnit: 100, guid: null })
    expect(result.project.project.parameters).toEqual({ radius: 44, label: 'sweep' })
  })

  it('accepts a hyphenated GUID and normalizes it', () => {
    const document = {
      ...validDocument(),
      export: { unity: { pixelsPerUnit: 100, guid: 'B93362E4-A2B3-BC24-0B45-2B57B97A4147' } },
    }
    const result = parseProjectDocument(document, codec)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.project.exportSettings.guid).toBe('b93362e4a2b3bc240b452b57b97a4147')
    }
  })

  it('ignores unknown extra fields for forward compatibility', () => {
    const result = parseProjectDocument({ ...validDocument(), future: { any: 1 } }, codec)
    expect(result.ok).toBe(true)
  })

  it('rejects non-object roots and missing schema', () => {
    expect(parseProjectDocument(null, codec).ok).toBe(false)
    expect(parseProjectDocument([1, 2], codec).ok).toBe(false)
    const { schema: _schema, ...withoutSchema } = validDocument()
    expect(parseProjectDocument(withoutSchema, codec).ok).toBe(false)
  })

  it('rejects unsupported schema and versions', () => {
    expect(parseProjectDocument({ ...validDocument(), schema: 'other.schema' }, codec)).toMatchObject({
      ok: false,
      error: { code: 'UNSUPPORTED_SCHEMA' },
    })
    expect(parseProjectDocument({ ...validDocument(), version: 2 }, codec)).toMatchObject({
      ok: false,
      error: { code: 'UNSUPPORTED_VERSION' },
    })
  })

  it('rejects a project saved for another generator', () => {
    expect(parseProjectDocument({ ...validDocument(), generator: 'blip' }, codec)).toMatchObject({
      ok: false,
      error: { code: 'WRONG_GENERATOR' },
    })
  })

  it('fails when the codec rejects the parameters', () => {
    expect(parseProjectDocument({ ...validDocument(), parameters: { label: 'no radius' } }, codec)).toMatchObject({
      ok: false,
      error: { code: 'INVALID_PARAMETERS' },
    })
  })

  it('rejects missing, invalid, and unsupported FPS values', () => {
    const { playback: _playback, ...withoutPlayback } = validDocument()
    expect(parseProjectDocument(withoutPlayback, codec).ok).toBe(false)
    expect(parseProjectDocument({ ...validDocument(), playback: { fps: 10 } }, codec)).toMatchObject({
      ok: false,
      error: { code: 'INVALID_FPS' },
    })
    expect(parseProjectDocument({ ...validDocument(), playback: { fps: NaN } }, codec)).toMatchObject({
      ok: false,
      error: { code: 'INVALID_FPS' },
    })
    expect(SUPPORTED_PREVIEW_FPS).toEqual([6, 8, 12, 18, 24])
  })

  it('rejects invalid PPU values', () => {
    expect(parseProjectDocument({ ...validDocument(), export: { unity: { pixelsPerUnit: 0, guid: null } } }, codec))
      .toMatchObject({ ok: false, error: { code: 'INVALID_PPU' } })
    expect(parseProjectDocument({ ...validDocument(), export: { unity: { pixelsPerUnit: 12.5, guid: null } } }, codec))
      .toMatchObject({ ok: false, error: { code: 'INVALID_PPU' } })
    expect(MIN_PIXELS_PER_UNIT).toBe(1)
    expect(MAX_PIXELS_PER_UNIT).toBe(1024)
  })

  it('rejects invalid GUID values and missing export sections', () => {
    expect(parseProjectDocument({ ...validDocument(), export: { unity: { pixelsPerUnit: 100, guid: 'xyz' } } }, codec))
      .toMatchObject({ ok: false, error: { code: 'INVALID_GUID' } })
    expect(parseProjectDocument({ ...validDocument(), export: {} }, codec).ok).toBe(false)
    expect(parseProjectDocument({ ...validDocument() }, codec).ok).toBe(true)
  })

  it('does not mutate the parsed document between calls', () => {
    const first = parseProjectDocument(validDocument(), codec) as { ok: true; project: ParsedProjectDocument }
    const second = parseProjectDocument(validDocument(), codec) as { ok: true; project: ParsedProjectDocument }
    expect(first.project.project.parameters).toEqual(second.project.project.parameters)
  })
})

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
