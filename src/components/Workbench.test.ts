import { describe, expect, it } from 'vitest'
import { resolveTheme, resolveThemePreference } from './Workbench'

describe('appearance preference', () => {
  it('uses the system when no saved preference exists', () => {
    expect(resolveThemePreference(null)).toBe('system')
    expect(resolveTheme('system', false)).toBe('light')
    expect(resolveTheme('system', true)).toBe('dark')
  })

  it('keeps explicit choices independent of system appearance', () => {
    expect(resolveThemePreference('light')).toBe('light')
    expect(resolveThemePreference('dark')).toBe('dark')
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
  })
})
