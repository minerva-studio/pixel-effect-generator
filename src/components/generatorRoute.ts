import { GENERATOR_REGISTRY } from '../generators/registry'
import { prepareNewDocument, type PreparedDocument } from './documentSession'
import { decodeEffectLink, EffectLinkError, PUBLIC_WEB_URL, type EffectLinkErrorCode } from './shareLink'

/** One generator entry parsed from a `#/<id>` or `#/<id>?effect=...` fragment. */
export interface GeneratorRoute {
  readonly generatorId: string
  readonly effect: string | null
}

/** Startup or navigation outcome for one URL fragment. */
export type RouteResolution =
  | { readonly kind: 'default' }
  | { readonly kind: 'entry'; readonly route: GeneratorRoute; readonly document: PreparedDocument }
  | { readonly kind: 'effect'; readonly route: GeneratorRoute; readonly document: PreparedDocument }
  | { readonly kind: 'invalidEffect'; readonly route: GeneratorRoute; readonly document: PreparedDocument; readonly error: EffectLinkErrorCode }

/** Parses a fragment into a registered generator route; anything else is null. */
export function parseRoute(hash: string): GeneratorRoute | null {
  const match = /^#\/([^?]+)(?:\?(.*))?$/.exec(hash)
  if (!match) return null
  const generatorId = match[1]
  if (!GENERATOR_REGISTRY.registrations.some((registration) => registration.id === generatorId)) return null
  const effect = new URLSearchParams(match[2] ?? '').get('effect')
  return { generatorId, effect: effect === '' ? null : effect }
}

/** Formats the fragment for one generator entry, optionally carrying an effect snapshot. */
export function formatRoute(generatorId: string, effect: string | null = null): string {
  return effect === null ? `#/${generatorId}` : `#/${generatorId}?${new URLSearchParams({ effect })}`
}

/** Base URL for copied links; desktop builds always point at the public web app. */
export function shareBaseUrl(isDesktop: boolean, location: { readonly origin: string; readonly pathname: string }): string {
  return isDesktop ? PUBLIC_WEB_URL : `${location.origin}${location.pathname}`
}

/** Prepares the document a fragment asks for without touching the current one. */
export function resolveRouteDocument(hash: string): RouteResolution {
  const route = parseRoute(hash)
  if (route === null) return { kind: 'default' }
  if (route.effect === null) return { kind: 'entry', route, document: prepareNewDocument(route.generatorId) }
  try {
    return { kind: 'effect', route, document: decodeEffectLink(route.generatorId, route.effect) }
  } catch (error) {
    const code = error instanceof EffectLinkError ? error.code : 'INVALID_LINK'
    return { kind: 'invalidEffect', route, document: prepareNewDocument(route.generatorId), error: code }
  }
}
