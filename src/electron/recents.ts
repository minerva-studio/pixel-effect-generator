import type { RecentProject } from './desktopApi'

export const MAX_RECENT_PROJECTS = 8

/** One persisted recent-project entry; the path never reaches the renderer. */
export interface RecentEntry {
  readonly id: string
  readonly name: string
  readonly path: string
}

/** Inserts or moves one entry to the front, deduplicated by path. */
export function addRecent(entries: readonly RecentEntry[], entry: RecentEntry): readonly RecentEntry[] {
  const rest = entries.filter((existing) => existing.path !== entry.path)
  return [entry, ...rest].slice(0, MAX_RECENT_PROJECTS)
}

export function removeRecentById(entries: readonly RecentEntry[], id: string): readonly RecentEntry[] {
  return entries.filter((entry) => entry.id !== id)
}

export function removeRecentByPath(entries: readonly RecentEntry[], filePath: string): readonly RecentEntry[] {
  return entries.filter((entry) => entry.path !== filePath)
}

/** Strips paths for the renderer; ids stay opaque. */
export function toPublicRecents(entries: readonly RecentEntry[]): readonly RecentProject[] {
  return entries.map((entry) => ({ id: entry.id, name: entry.name }))
}
