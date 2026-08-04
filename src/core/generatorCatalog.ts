export interface GeneratorDefinition {
  readonly id: 'slash'
  readonly index: number
  readonly name: string
  readonly description: string
}

export type SlashCategory = 'shape' | 'palette' | 'motion' | 'breakup'

export interface SlashCategoryDefinition {
  readonly id: SlashCategory
  readonly label: string
  readonly description: string
}

export const GENERATOR_CATALOG: readonly GeneratorDefinition[] = [
  {
    id: 'slash',
    index: 1,
    name: 'Slash',
    description: 'Animated weapon trails and sweeping attack arcs.',
  },
]

export const SLASH_CATEGORIES: readonly SlashCategoryDefinition[] = [
  { id: 'shape', label: 'Shape', description: 'Define the arc silhouette, orientation, and perspective.' },
  { id: 'palette', label: 'Palette', description: 'Build the radial color bands from the inner edge outward.' },
  { id: 'motion', label: 'Motion', description: 'Control timing, trail length, and the direction of the sweep.' },
  { id: 'breakup', label: 'Breakup', description: 'Add pixel dissolve, chipped edges, and deterministic fragments.' },
]
