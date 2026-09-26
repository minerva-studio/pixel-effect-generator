import type { PaletteSlot } from './contract'

/** Applies a preset result while restoring only the colors in each declared slot. */
export function applyPreservingColors<Parameters>(
  slots: readonly PaletteSlot<Parameters>[],
  current: Parameters,
  next: Parameters,
): Parameters {
  return slots.reduce((parameters, slot) => slot.write(parameters, slot.read(current)), next)
}
