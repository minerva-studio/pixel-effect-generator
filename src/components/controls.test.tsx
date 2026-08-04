import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { InfoHint, NumberControl, SelectControl } from './controls'

describe('shared form controls', () => {
  it('generates unique, correctly associated ids without a slash prefix', () => {
    const markup = renderToStaticMarkup(
      <>
        <NumberControl label="Radius" description="Outer edge radius." value={10} minimum={2} maximum={63} onChange={() => undefined} />
        <SelectControl
          label="Mode"
          description="Choose a mode."
          value="a"
          options={[{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }]}
          onChange={() => undefined}
        />
        <InfoHint label="Help" description="Guidance text." hintId="help-hint" />
      </>,
    )

    const ids = [...markup.matchAll(/id="([^"]+)"/g)].map((match) => match[1])
    expect(ids.length).toBeGreaterThanOrEqual(4)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.some((id) => id.startsWith('slash-'))).toBe(false)
    expect(markup).toContain('aria-describedby="help-hint"')
  })
})
