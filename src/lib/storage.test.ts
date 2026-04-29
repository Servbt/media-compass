import { describe, expect, it } from 'vitest'
import { loadItems, parseImportedItems, saveItems, STORAGE_KEY } from './storage'
import type { MediaItem } from './types'

const item: MediaItem = {
  id: 'item-1',
  canonicalTitle: 'Arrival',
  category: 'movie',
  status: 'curious',
  priority: 3,
  reason: 'Smart emotional sci-fi.',
  moods: ['thoughtful', 'quiet'],
  themes: ['sci-fi'],
  needsReview: false,
  sourceArtifacts: [],
  createdAt: '2026-04-29T00:00:00.000Z',
  updatedAt: '2026-04-29T00:00:00.000Z',
}

describe('storage', () => {
  it('loads seed items when localStorage is empty', () => {
    const storage = new Map<string, string>()

    expect(loadItems({
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
    })).toHaveLength(5)
  })

  it('round trips valid media items through localStorage', () => {
    const storage = new Map<string, string>()
    const adapter = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    }

    saveItems([item], adapter)

    expect(storage.has(STORAGE_KEY)).toBe(true)
    expect(loadItems(adapter)).toEqual([item])
  })

  it('falls back to seed items when stored JSON is corrupt', () => {
    const storage = new Map<string, string>([[STORAGE_KEY, '{nope']])

    expect(loadItems({
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
    })).toHaveLength(5)
  })

  it('rejects imported items with invalid enum values or priority', () => {
    const invalid = JSON.stringify({
      items: [
        {
          ...item,
          category: 'board-game',
          status: 'maybe',
          priority: 99,
        },
      ],
    })

    expect(loadItems({
      getItem: () => invalid,
      setItem: () => undefined,
    })).toHaveLength(5)
    expect(() => parseImportedItems(invalid)).toThrow('valid Media Compass items')
  })
})
