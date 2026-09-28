import { deflateSync, inflateSync, strFromU8, strToU8 } from 'fflate'
import { describe, expect, it } from 'vitest'
import { GENERATOR_REGISTRY } from '../generators/registry'
import type { RegisteredGenerator } from '../generators/contract'
import {
  decodeEffectLink,
  EffectLinkError,
  encodeEffectLink,
  MAX_EFFECT_LINK_LENGTH,
  MAX_EFFECT_PAYLOAD_BYTES,
  type EffectLinkErrorCode,
} from './shareLink'
import { DEFAULT_UNITY_EXPORT_SETTINGS } from './unitySettings'

/** Non-default parameters: a changed seed survives every codec. */
function customParameters(generator: RegisteredGenerator<string>): unknown {
  const defaults = generator.createSession(generator.defaultPreviewFps).parameters
  const value = generator.shareCodec!.serialize(defaults) as Record<string, unknown>
  return generator.shareCodec!.parse({ ...value, seed: 424242 })
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function encodePayload(payload: unknown): string {
  return `1.${toBase64Url(deflateSync(strToU8(JSON.stringify(payload))))}`
}

function decodePayload(link: string): Record<string, unknown> {
  const body = link.slice(2)
  const binary = atob(body.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(body.length / 4) * 4, '='))
  return JSON.parse(strFromU8(inflateSync(Uint8Array.from(binary, (character) => character.charCodeAt(0)))))
}

function expectCode(action: () => unknown, code: EffectLinkErrorCode): void {
  let caught: unknown = null
  try {
    action()
  } catch (error) {
    caught = error
  }
  expect(caught).toBeInstanceOf(EffectLinkError)
  expect((caught as EffectLinkError).code).toBe(code)
}

const slash = GENERATOR_REGISTRY.get('slash')

describe('effect share links', () => {
  it.each(GENERATOR_REGISTRY.registrations.map((generator): readonly [string, RegisteredGenerator<string>] => [generator.id, generator]))('round-trips non-default %s effects', (_id, generator) => {
    const parameters = customParameters(generator)
    const link = encodeEffectLink(generator, parameters, 18)
    expect(link).toMatch(/^1\.[A-Za-z0-9_-]+$/)
    const document = decodeEffectLink(generator.id, link)
    expect(document.session.generatorId).toBe(generator.id)
    expect(document.session.previewFps).toBe(18)
    expect(document.session.frameIndex).toBe(0)
    expect(document.unitySettings).toEqual(DEFAULT_UNITY_EXPORT_SETTINGS)
    expect(generator.shareCodec!.serialize(document.session.parameters)).toEqual(generator.shareCodec!.serialize(parameters))
    expect(document.session.frames.read().length).toBe(generator.readFrameCount(document.session))
    expect(encodeEffectLink(generator, document.session.parameters, 18)).toBe(link)
  })

  it('carries only generator, codec version, fps, and parameters', () => {
    for (const generator of GENERATOR_REGISTRY.registrations) {
      const payload = decodePayload(encodeEffectLink(generator, customParameters(generator), 12))
      expect(Object.keys(payload).sort()).toEqual(['fps', 'g', 'p', 'v'])
      expect(JSON.stringify(payload)).not.toMatch(/pixelsPerUnit|guid|unity|fileName/i)
    }
  })

  it('rejects malformed, oversized, and mismatched links', () => {
    const link = encodeEffectLink(slash, customParameters(slash), 12)
    const valid = decodePayload(link)
    expectCode(() => decodeEffectLink('slash', 'garbage'), 'INVALID_LINK')
    expectCode(() => decodeEffectLink('slash', '1.@@@'), 'INVALID_LINK')
    expectCode(() => decodeEffectLink('slash', '1.AAAA'), 'INVALID_LINK')
    expectCode(() => decodeEffectLink('slash', '1.'), 'INVALID_LINK')
    expectCode(() => decodeEffectLink('slash', link.slice(0, -12)), 'INVALID_LINK')
    expectCode(() => decodeEffectLink('slash', `1.${toBase64Url(deflateSync(strToU8('not json')))}`), 'INVALID_LINK')
    expectCode(() => decodeEffectLink('slash', encodePayload([1, 2])), 'INVALID_LINK')
    expectCode(() => decodeEffectLink('slash', `1.${'A'.repeat(MAX_EFFECT_LINK_LENGTH)}`), 'TOO_LARGE')
    expectCode(() => decodeEffectLink('slash', encodePayload({ ...valid, pad: ' '.repeat(MAX_EFFECT_PAYLOAD_BYTES) })), 'TOO_LARGE')
    expectCode(() => decodeEffectLink('slash', `2.${link.slice(2)}`), 'UNSUPPORTED_VERSION')
    expectCode(() => decodeEffectLink('slash', encodePayload({ ...valid, v: 99 })), 'UNSUPPORTED_VERSION')
    expectCode(() => decodeEffectLink('flame', link), 'WRONG_GENERATOR')
    expectCode(() => decodeEffectLink('slash', encodePayload({ ...valid, fps: 7 })), 'INVALID_FPS')
    expectCode(() => decodeEffectLink('slash', encodePayload({ ...valid, p: { ...(valid.p as object), seed: -1 } })), 'INVALID_PARAMETERS')
    expectCode(() => decodeEffectLink('slash', encodePayload({ ...valid, p: 'nope' })), 'INVALID_PARAMETERS')
  })
})
