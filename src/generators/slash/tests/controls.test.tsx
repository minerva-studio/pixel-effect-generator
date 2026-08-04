import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { SlashControls } from '../controls'
import { DEFAULT_SLASH_PARAMETERS } from '../model'

describe('Slash controls', () => {
  it('describes fragment size for every drawing mode', () => {
    const markup = renderToStaticMarkup(
      <SlashControls
        category="breakup"
        parameters={DEFAULT_SLASH_PARAMETERS}
        onChange={() => undefined}
      />,
    )

    expect(markup).toContain('Maximum chunk width, shard line length, or spark trail length')
    expect(markup).not.toContain('Maximum square size of an individual fragment')
  })
})
