import { describe, expect, it } from 'vitest'
import { getEligibleItems, pickMedia } from './picker'
import type { MediaItem } from './types'

function makeItem(overrides: Partial<MediaItem>): MediaItem {
  return {
    id: overrides.id ?? 'item',
    canonicalTitle: overrides.canonicalTitle ?? 'Item',
    category: overrides.category ?? 'movie',
    status: overrides.status ?? 'curious',
    priority: overrides.priority ?? 3,
    reason: overrides.reason ?? 'Because it seems good.',
    moods: overrides.moods ?? ['quiet'],
    themes: overrides.themes ?? [],
    needsReview: overrides.needsReview ?? false,
    sourceArtifacts: overrides.sourceArtifacts ?? [],
    createdAt: overrides.createdAt ?? '2026-04-01T00:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-04-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('picker', () => {
  it('excludes inbox, review, done, rejected, and archived items', () => {
    const eligible = makeItem({ id: 'eligible', status: 'curious' })
    const items = [
      eligible,
      makeItem({ id: 'inbox', status: 'inbox' }),
      makeItem({ id: 'review', needsReview: true }),
      makeItem({ id: 'done', status: 'done' }),
      makeItem({ id: 'rejected', status: 'rejected' }),
      makeItem({ id: 'archived', status: 'archived' }),
    ]

    expect(getEligibleItems(items, {})).toEqual([eligible])
  })

  it('applies category and comma-separated mood constraints before picking', () => {
    const target = makeItem({ id: 'target', category: 'book', moods: ['cozy', 'fun'] })
    const result = getEligibleItems([
      makeItem({ id: 'movie', category: 'movie', moods: ['cozy', 'fun'] }),
      makeItem({ id: 'wrong-mood', category: 'book', moods: ['cozy', 'bleak'] }),
      target,
    ], { category: 'book', mood: 'cozy, fun' })

    expect(result).toEqual([target])
  })

  it('returns one primary pick and alternates without duplicates', () => {
    const items = [
      makeItem({ id: 'a' }),
      makeItem({ id: 'b' }),
      makeItem({ id: 'c' }),
      makeItem({ id: 'd' }),
    ]

    const result = pickMedia(items, {}, () => 0)

    expect(result.primary?.id).toBe('a')
    expect(result.alternates.map((item) => item.id)).toEqual(['b', 'c'])
  })
})
