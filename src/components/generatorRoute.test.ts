import { describe, expect, it } from 'vitest'
import { GENERATOR_REGISTRY } from '../generators/registry'
import { formatRoute, parseRoute, resolveRouteDocument, shareBaseUrl } from './generatorRoute'
import { encodeEffectLink, PUBLIC_WEB_URL } from './shareLink'

const ids = GENERATOR_REGISTRY.registrations.map((generator) => generator.id)

describe('generator routes', () => {
  it.each(ids)('opens #/%s as a fresh entry and resolves the same on refresh', (id) => {
    const first = resolveRouteDocument(`#/${id}`)
    const refreshed = resolveRouteDocument(`#/${id}`)
    expect(first.kind).toBe('entry')
    expect(refreshed.kind).toBe('entry')
    if (first.kind !== 'entry' || refreshed.kind !== 'entry') return
    expect(first.document.session.generatorId).toBe(id)
    expect(first.document.session.parameters).toEqual(refreshed.document.session.parameters)
    expect(first.document.session.previewFps).toBe(GENERATOR_REGISTRY.getRegistered(id).defaultPreviewFps)
  })

  it('keeps the root and unknown ids on the default document', () => {
    for (const hash of ['', '#', '#/', '#/unknown', '#flame', '#/flame/extra', '#/__proto__']) {
      expect(resolveRouteDocument(hash)).toEqual({ kind: 'default' })
    }
  })

  it('formats and parses entry and effect fragments', () => {
    for (const id of ids) {
      expect(parseRoute(formatRoute(id))).toEqual({ generatorId: id, effect: null })
      expect(parseRoute(formatRoute(id, '1.ab-_C'))).toEqual({ generatorId: id, effect: '1.ab-_C' })
    }
    expect(formatRoute('flame', '1.abc')).toBe('#/flame?effect=1.abc')
    expect(parseRoute('#/flame?effect=')).toEqual({ generatorId: 'flame', effect: null })
  })

  it('opens valid effect links and falls back to the generator default for broken ones', () => {
    const flame = GENERATOR_REGISTRY.get('flame')
    const defaults = flame.createSession(flame.defaultPreviewFps).parameters
    const parameters = flame.shareCodec!.parse({ ...(flame.shareCodec!.serialize(defaults) as object), seed: 77 })
    const effect = encodeEffectLink(flame, parameters, 24)
    const opened = resolveRouteDocument(formatRoute('flame', effect))
    expect(opened.kind).toBe('effect')
    if (opened.kind === 'effect') {
      expect(opened.route.effect).toBe(effect)
      expect(opened.document.session.previewFps).toBe(24)
      expect(flame.shareCodec!.serialize(opened.document.session.parameters)).toEqual(flame.shareCodec!.serialize(parameters))
    }
    const broken = resolveRouteDocument(formatRoute('flame', effect.slice(0, -8)))
    expect(broken.kind).toBe('invalidEffect')
    if (broken.kind === 'invalidEffect') {
      expect(broken.error).toBe('INVALID_LINK')
      expect(broken.document.session.generatorId).toBe('flame')
      expect(broken.document.session.parameters).toEqual(defaults)
    }
  })

  it('points desktop links at the public web app', () => {
    const location = { origin: 'http://localhost:5173', pathname: '/pixel-effect-generator/' }
    expect(shareBaseUrl(false, location)).toBe('http://localhost:5173/pixel-effect-generator/')
    expect(shareBaseUrl(true, { origin: 'http://tauri.localhost', pathname: '/' })).toBe(PUBLIC_WEB_URL)
    expect(`${PUBLIC_WEB_URL}${formatRoute('flame')}`).toBe('https://minerva-studio.github.io/pixel-effect-generator/#/flame')
  })
})
