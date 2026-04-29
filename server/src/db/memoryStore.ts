import type { MediaItem } from '../../../src/lib/types'
import type { CreateMediaItemInput, MediaCompassStore, UpdateMediaItemInput } from './types'

function nowIso() {
  return new Date().toISOString()
}

function makeItem(input: CreateMediaItemInput): MediaItem {
  const timestamp = nowIso()
  return {
    id: crypto.randomUUID(),
    canonicalTitle: input.canonicalTitle,
    originalTitle: input.originalTitle,
    category: input.category ?? 'other',
    status: input.status ?? 'inbox',
    priority: input.priority ?? 3,
    reason: input.reason,
    summary: input.summary,
    creator: input.creator,
    releaseYear: input.releaseYear,
    durationMinutes: input.durationMinutes,
    commitmentLevel: input.commitmentLevel,
    moods: input.moods ?? [],
    themes: input.themes ?? [],
    sourceUrl: input.sourceUrl,
    posterUrl: input.posterUrl,
    externalIds: input.externalIds,
    agentConfidence: input.agentConfidence,
    confidenceReasons: input.confidenceReasons,
    needsReview: input.needsReview ?? true,
    sourceArtifacts: input.sourceArtifacts ?? [],
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

function nextTimestamp(previous?: string) {
  const now = new Date()
  if (!previous) return now.toISOString()

  const previousMs = Date.parse(previous)
  if (Number.isFinite(previousMs) && now.getTime() <= previousMs) {
    return new Date(previousMs + 1).toISOString()
  }

  return now.toISOString()
}

export class MemoryMediaCompassStore implements MediaCompassStore {
  protected items: MediaItem[]

  constructor(items: MediaItem[] = []) {
    this.items = items
  }

  async listMediaItems() {
    return [...this.items]
  }

  async createMediaItem(input: CreateMediaItemInput) {
    const item = makeItem(input)
    this.items = [item, ...this.items]
    return item
  }

  async updateMediaItem(id: string, input: UpdateMediaItemInput) {
    let updated: MediaItem | null = null
    this.items = this.items.map((item) => {
      if (item.id !== id) return item
      updated = { ...item, ...input, updatedAt: nextTimestamp(item.updatedAt) }
      if (input.status === 'done') updated.completedAt = updated.updatedAt
      return updated
    })
    return updated
  }

  async archiveMediaItem(id: string) {
    return this.updateMediaItem(id, { status: 'archived' })
  }
}

export { makeItem }
