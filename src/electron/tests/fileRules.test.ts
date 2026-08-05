import { describe, expect, it } from 'vitest'
import { PROJECT_MAX_BYTES, SAVE_SPECS, enforceExtension, parseSaveRequest, sanitizeSuggestedName } from '../fileRules'

describe('sanitizeSuggestedName', () => {
  it('strips directory parts from suggested names', () => {
    expect(sanitizeSuggestedName('C:\\Users\\me\\Documents\\sheet.png', '.png')).toBe('sheet.png')
    expect(sanitizeSuggestedName('sub/folder/clip.gif', '.gif')).toBe('clip.gif')
  })

  it('replaces invalid filename characters and enforces the extension', () => {
    expect(sanitizeSuggestedName('bad:name?.png', '.png')).toBe('bad_name_.png')
    expect(sanitizeSuggestedName('project', '.json')).toBe('project.json')
    expect(sanitizeSuggestedName('  ', '.zip')).toBe('pixel-effect.zip')
    expect(sanitizeSuggestedName('clip', '.gif')).toBe('clip.gif')
  })

  it('exposes the per-kind extensions', () => {
    expect(SAVE_SPECS['project-json'].extension).toBe('.json')
    expect(SAVE_SPECS['unity-zip'].extension).toBe('.zip')
    expect(SAVE_SPECS.apng.extension).toBe('.png')
  })

  it('forces the expected extension on final save paths', () => {
    expect(enforceExtension('C:\\Users\\me\\project', '.json')).toBe('C:\\Users\\me\\project.json')
    expect(enforceExtension('C:\\Users\\me\\project.json', '.json')).toBe('C:\\Users\\me\\project.json')
    expect(enforceExtension('C:\\Users\\me\\clip.GIF', '.gif')).toBe('C:\\Users\\me\\clip.GIF')
  })
})

describe('parseSaveRequest', () => {
  const valid = { kind: 'gif', suggestedName: 'clip.gif', bytes: new Uint8Array([1, 2]).buffer }

  it('accepts known kinds with an ArrayBuffer payload', () => {
    const parsed = parseSaveRequest(valid)
    expect(parsed).not.toBeNull()
    expect(parsed?.kind).toBe('gif')
    expect(parsed?.suggestedName).toBe('clip.gif')
    expect(Array.from(parsed!.bytes)).toEqual([1, 2])
  })

  it('rejects unknown kinds, wrong shapes, and missing buffers', () => {
    expect(parseSaveRequest({ ...valid, kind: 'exe' })).toBeNull()
    expect(parseSaveRequest(null)).toBeNull()
    expect(parseSaveRequest({ ...valid, bytes: undefined })).toBeNull()
    expect(parseSaveRequest({ ...valid, suggestedName: 5 })).toBeNull()
  })
})

describe('PROJECT_MAX_BYTES', () => {
  it('caps project JSON at 5 MiB', () => {
    expect(PROJECT_MAX_BYTES).toBe(5 * 1024 * 1024)
  })
})
