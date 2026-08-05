import { describe, expect, it } from 'vitest'
import {
  MAX_RECENT_PROJECTS,
  addRecent,
  removeRecentById,
  removeRecentByPath,
  toPublicRecents,
  type RecentEntry,
} from '../recents'

function entry(id: string, name: string, path: string): RecentEntry {
  return { id, name, path }
}

describe('addRecent', () => {
  it('moves a re-opened path to the front and deduplicates', () => {
    const a = entry('a', 'a.json', '/p/a.json')
    const b = entry('b', 'b.json', '/p/b.json')
    const list = addRecent([a, b], b)
    expect(list.map((item) => item.id)).toEqual(['b', 'a'])
    expect(list).toHaveLength(2)
  })

  it('caps the list at eight entries', () => {
    let list: readonly RecentEntry[] = []
    for (let index = 0; index < 12; index += 1) {
      list = addRecent(list, entry(`id-${index}`, `${index}.json`, `/p/${index}.json`))
    }
    expect(list).toHaveLength(MAX_RECENT_PROJECTS)
    expect(list[0].id).toBe('id-11')
    expect(list[MAX_RECENT_PROJECTS - 1].id).toBe('id-4')
  })
})

describe('removeRecent', () => {
  it('removes by id and by path', () => {
    const list = [entry('a', 'a.json', '/p/a.json'), entry('b', 'b.json', '/p/b.json')]
    expect(removeRecentById(list, 'a').map((item) => item.id)).toEqual(['b'])
    expect(removeRecentByPath(list, '/p/b.json').map((item) => item.id)).toEqual(['a'])
  })
})

describe('toPublicRecents', () => {
  it('never exposes filesystem paths to the renderer', () => {
    const list = [entry('a', 'a.json', 'C:\\secret\\projects\\a.json')]
    expect(toPublicRecents(list)).toEqual([{ id: 'a', name: 'a.json' }])
  })
})
