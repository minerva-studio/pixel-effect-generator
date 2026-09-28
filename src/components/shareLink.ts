import { Inflate, deflateSync, strFromU8, strToU8 } from 'fflate'
import type { RegisteredGenerator } from '../generators/contract'
import { isPlainRecord, SUPPORTED_PREVIEW_FPS, type SupportedPreviewFps } from '../shared/project/document'
import { documentGenerator, type PreparedDocument } from './documentSession'
import { DEFAULT_UNITY_EXPORT_SETTINGS } from './unitySettings'

/** Public web build that desktop share links point to. */
export const PUBLIC_WEB_URL = 'https://minerva-studio.github.io/pixel-effect-generator/'

/** Current effect-link format version, written before the first dot. */
export const EFFECT_LINK_VERSION = 1
/** Longest accepted encoded effect value. */
export const MAX_EFFECT_LINK_LENGTH = 16 * 1024
/** Largest accepted decompressed payload. */
export const MAX_EFFECT_PAYLOAD_BYTES = 256 * 1024

const INFLATE_CHUNK_BYTES = 64

/** Machine-readable reasons an effect link was rejected. */
export type EffectLinkErrorCode =
  | 'INVALID_LINK'
  | 'UNSUPPORTED_VERSION'
  | 'TOO_LARGE'
  | 'WRONG_GENERATOR'
  | 'INVALID_FPS'
  | 'INVALID_PARAMETERS'

/** Effect-link failure; the current document is never touched when this is thrown. */
export class EffectLinkError extends Error {
  readonly code: EffectLinkErrorCode

  constructor(code: EffectLinkErrorCode, detail: string) {
    super(detail)
    this.name = 'EffectLinkError'
    this.code = code
  }
}

/** Encodes parameters and preview FPS only; Unity settings, file names, and presets stay out. */
export function encodeEffectLink(generator: RegisteredGenerator<string>, parameters: unknown, fps: number): string {
  const codec = generator.shareCodec
  if (!codec) throw new Error(`Generator ${generator.id} cannot be shared.`)
  const payload = { g: generator.id, v: codec.version, fps, p: codec.serialize(parameters) }
  return `${EFFECT_LINK_VERSION}.${toBase64Url(deflateSync(strToU8(JSON.stringify(payload)), { level: 9 }))}`
}

/** Validates, parses, and renders an effect link into a replacement document. */
export function decodeEffectLink(generatorId: string, text: string): PreparedDocument {
  const generator = documentGenerator(generatorId)
  const codec = generator.shareCodec
  if (!codec) throw new EffectLinkError('WRONG_GENERATOR', `Generator ${generatorId} cannot be shared.`)
  const dot = text.indexOf('.')
  if (dot <= 0) throw new EffectLinkError('INVALID_LINK', 'Missing effect link version.')
  if (text.slice(0, dot) !== String(EFFECT_LINK_VERSION)) throw new EffectLinkError('UNSUPPORTED_VERSION', `Unsupported effect link version: ${text.slice(0, dot)}`)
  if (text.length > MAX_EFFECT_LINK_LENGTH) throw new EffectLinkError('TOO_LARGE', 'Effect link is too long.')
  const payload = readPayload(text.slice(dot + 1))
  if (payload.g !== generator.id) throw new EffectLinkError('WRONG_GENERATOR', `Effect link targets generator: ${String(payload.g)}`)
  if (payload.v !== codec.version) throw new EffectLinkError('UNSUPPORTED_VERSION', `Unsupported parameter version: ${String(payload.v)}`)
  const fps = payload.fps
  if (typeof fps !== 'number' || !SUPPORTED_PREVIEW_FPS.includes(fps as SupportedPreviewFps)) {
    throw new EffectLinkError('INVALID_FPS', `Unsupported FPS: ${String(fps)}`)
  }
  try {
    const parameters = codec.parse(payload.p)
    const action = generator.createImportedAction(parameters, fps)
    return {
      session: generator.reduceSession(generator.createSession(fps), action),
      unitySettings: { ...DEFAULT_UNITY_EXPORT_SETTINGS },
    }
  } catch (error) {
    throw new EffectLinkError('INVALID_PARAMETERS', error instanceof Error ? error.message : String(error))
  }
}

/** Decodes base64url, inflates with a running size cap, and parses the JSON envelope. */
function readPayload(encoded: string): Readonly<Record<string, unknown>> {
  const compressed = fromBase64Url(encoded)
  const chunks: Uint8Array[] = []
  let total = 0
  let text: string
  try {
    const inflate = new Inflate((chunk) => {
      total += chunk.length
      if (total > MAX_EFFECT_PAYLOAD_BYTES) throw new EffectLinkError('TOO_LARGE', 'Effect payload is too large.')
      chunks.push(chunk.slice())
    })
    // Small input steps bound how much output one push can produce before the cap is checked.
    for (let offset = 0; offset < compressed.length; offset += INFLATE_CHUNK_BYTES) {
      const end = Math.min(compressed.length, offset + INFLATE_CHUNK_BYTES)
      inflate.push(compressed.subarray(offset, end), end === compressed.length)
    }
    if (compressed.length === 0) throw new Error('Empty effect payload.')
    const bytes = new Uint8Array(total)
    let offset = 0
    for (const chunk of chunks) {
      bytes.set(chunk, offset)
      offset += chunk.length
    }
    text = strFromU8(bytes)
  } catch (error) {
    if (error instanceof EffectLinkError) throw error
    throw new EffectLinkError('INVALID_LINK', 'Effect payload is not valid compressed data.')
  }
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    throw new EffectLinkError('INVALID_LINK', 'Effect payload is not valid JSON.')
  }
  if (!isPlainRecord(value)) throw new EffectLinkError('INVALID_LINK', 'Effect payload must be an object.')
  return value
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(text: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]*$/.test(text) || text.length % 4 === 1) throw new EffectLinkError('INVALID_LINK', 'Effect payload is not base64url.')
  const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(text.length / 4) * 4, '='))
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}
