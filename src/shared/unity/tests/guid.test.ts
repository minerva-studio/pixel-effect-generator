import { describe, expect, it } from 'vitest'
import { isValidGuid, normalizeGuid, randomGuid } from '../guid'

describe('normalizeGuid', () => {
  it('strips dashes and lowercases valid GUIDs', () => {
    expect(normalizeGuid('B93362E4-A2B3-BC24-0B45-2B57B97A4147'))
      .toBe('b93362e4a2b3bc240b452b57b97a4147')
    expect(normalizeGuid('b93362e4a2b3bc240b452b57b97a4147'))
      .toBe('b93362e4a2b3bc240b452b57b97a4147')
  })

  it('rejects wrong length, non-hex, and non-string values', () => {
    expect(normalizeGuid('')).toBeNull()
    expect(normalizeGuid('b93362e4a2b3bc240b452b57b97a41')).toBeNull()
    expect(normalizeGuid('zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz')).toBeNull()
    expect(normalizeGuid(123 as unknown as string)).toBeNull()
  })

  it('validates accepted GUID forms', () => {
    expect(isValidGuid('b93362e4a2b3bc240b452b57b97a4147')).toBe(true)
    expect(isValidGuid('B93362E4-A2B3-BC24-0B45-2B57B97A4147')).toBe(true)
    expect(isValidGuid('nope')).toBe(false)
  })
})

describe('randomGuid', () => {
  it('returns valid lowercase GUIDs and differs between calls', () => {
    const first = randomGuid()
    const second = randomGuid()
    expect(isValidGuid(first)).toBe(true)
    expect(isValidGuid(second)).toBe(true)
    expect(first).not.toBe(second)
    expect(first).toBe(first.toLowerCase())
    expect(first).not.toContain('-')
  })
})
