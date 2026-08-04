import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { SlashControls, SlashPreviewTools } from '../controls'
import { DEFAULT_SLASH_PARAMETERS } from '../model'

describe('Slash controls', () => {
  it('describes fragment size for every drawing mode', () => {
    const markup = renderToStaticMarkup(
      <SlashControls
        category="fragments"
        parameters={DEFAULT_SLASH_PARAMETERS}
        onChange={() => undefined}
      />,
    )

    expect(markup).toContain('Maximum chunk width, shard line length, or spark trail length')
    expect(markup).not.toContain('Maximum square size of an individual fragment')
  })

  it('separates arc breakup, fragments, and preview seed controls', () => {
    const breakupMarkup = renderToStaticMarkup(
      <SlashControls
        category="breakup"
        parameters={DEFAULT_SLASH_PARAMETERS}
        onChange={() => undefined}
      />,
    )
    const fragmentMarkup = renderToStaticMarkup(
      <SlashControls
        category="fragments"
        parameters={DEFAULT_SLASH_PARAMETERS}
        onChange={() => undefined}
      />,
    )
    const previewToolsMarkup = renderToStaticMarkup(
      <SlashPreviewTools parameters={DEFAULT_SLASH_PARAMETERS} onChange={() => undefined} />,
    )

    expect(breakupMarkup).toContain('Dissolve mode')
    expect(breakupMarkup).not.toContain('Fragment mode')
    expect(fragmentMarkup).toContain('Fragment mode')
    expect(fragmentMarkup).not.toContain('Dissolve mode')
    expect(breakupMarkup).not.toContain('Random seed')
    expect(fragmentMarkup).not.toContain('Random seed')
    expect(previewToolsMarkup).toContain('Random seed')
    expect(previewToolsMarkup).toContain('Randomize')
  })
})
