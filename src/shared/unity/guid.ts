/** Normalized Unity GUID length and accepted characters. */
const GUID_HEX_LENGTH = 32
const GUID_PATTERN = /^[0-9a-f]{32}$/

/**
 * Normalizes a GUID input to lowercase 32 hex characters without dashes.
 * Returns null when the input is not a valid Unity GUID.
 */
export function normalizeGuid(input: string): string | null {
  if (typeof input !== 'string') {
    return null
  }
  const cleaned = input.replace(/-/g, '').toLowerCase()
  return GUID_PATTERN.test(cleaned) ? cleaned : null
}

/** True when the input is a valid Unity GUID in any accepted casing. */
export function isValidGuid(input: string): boolean {
  return normalizeGuid(input) !== null
}

/**
 * Generates a random lowercase 32-hex GUID using a cryptographically secure
 * source; never uses Math.random().
 */
export function randomGuid(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return toHex(bytes)
}

function toHex(bytes: Uint8Array): string {
  let hex = ''
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, '0')
  }
  return hex
}

/** Throws when the input is not a normalized 32-hex GUID. */
export function assertNormalizedGuid(guid: string): void {
  if (typeof guid !== 'string' || !GUID_PATTERN.test(guid)) {
    throw new RangeError(`Invalid normalized Unity GUID: ${String(guid)}`)
  }
}
