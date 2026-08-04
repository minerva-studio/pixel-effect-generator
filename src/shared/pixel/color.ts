/** Portable integer RGB color contract used across generator modules. */
export interface RgbColor {
  readonly r: number
  readonly g: number
  readonly b: number
}

/** Converts a CSS hexadecimal color into the portable RGB contract. */
export function hexToRgb(hex: string): RgbColor {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) {
    throw new TypeError(`Invalid RGB color: ${hex}`)
  }
  return {
    r: Number.parseInt(hex.slice(1, 3), 16),
    g: Number.parseInt(hex.slice(3, 5), 16),
    b: Number.parseInt(hex.slice(5, 7), 16),
  }
}

/** Converts a portable RGB value into a CSS hexadecimal color. */
export function rgbToHex(color: RgbColor): string {
  assertValidColor(color, 'color')
  return `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`
}

/** Validates one RGB channel triplet without relaxing the integer contract. */
export function assertValidColor(color: RgbColor, name: string): void {
  assertInRange(color.r, 0, 255, `${name}.r`)
  assertInRange(color.g, 0, 255, `${name}.g`)
  assertInRange(color.b, 0, 255, `${name}.b`)
  if (![color.r, color.g, color.b].every(Number.isInteger)) {
    throw new RangeError(`${name} channels must be integers.`)
  }
}

/** Validates that a finite number lies inside an inclusive range. */
export function assertInRange(value: number, minimum: number, maximum: number, name: string): void {
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    throw new RangeError(`${name} must be between ${minimum} and ${maximum}.`)
  }
}

function toHex(channel: number): string {
  return channel.toString(16).padStart(2, '0')
}
