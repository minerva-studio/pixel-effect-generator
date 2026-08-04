import { describe, expect, it } from 'vitest'
import { assertValidParameters, DEFAULT_SLASH_PARAMETERS } from '../model'

describe('slash model', () => {
  it('accepts the modern defaults and rejects invalid mode values', () => {
    expect(() => assertValidParameters(DEFAULT_SLASH_PARAMETERS)).not.toThrow()
    expect(() => assertValidParameters({ ...DEFAULT_SLASH_PARAMETERS, dissolveMode: 'invalid' as never })).toThrow(RangeError)
    expect(() => assertValidParameters({ ...DEFAULT_SLASH_PARAMETERS, edgeBreakupMode: 'invalid' as never })).toThrow(RangeError)
    expect(() => assertValidParameters({ ...DEFAULT_SLASH_PARAMETERS, fragmentMode: 'invalid' as never })).toThrow(RangeError)
  })
})
