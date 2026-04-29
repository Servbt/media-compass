import type { MediaItem } from '../../../src/lib/types'
import type {
  CreateIngestEventInput,
  CreateMediaItemInput,
  CreateSourceArtifactInput,
  IngestEvent,
  MediaCompassStore,
  SourceArtifactRecord,
  UpdateMediaItemInput,
} from './types'

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

const defaultUserId = '00000000-0000-4000-8000-000000000001'

function makeIngestEvent(input: CreateIngestEventInput): IngestEvent {
  return {
    id: crypto.randomUUID(),
    userId: input.userId ?? defaultUserId,
    channel: input.channel,
    channelMessageId: input.channelMessageId,
    rawText: input.rawText,
    rawPayload: input.rawPayload,
    state: input.state ?? 'received',
    errorMessage: input.errorMessage,
    createdAt: nowIso(),
    processedAt: input.processedAt,
  }
}

function makeSourceArtifact(input: CreateSourceArtifactInput): SourceArtifactRecord {
  return {
    id: input.id ?? crypto.randomUUID(),
    userId: input.userId ?? defaultUserId,
    mediaItemId: input.mediaItemId,
    ingestEventId: input.ingestEventId,
    type: input.type,
    url: input.url,
    contentText: input.contentText,
    storagePath: input.storagePath,
    metadata: input.metadata,
    createdAt: input.createdAt ?? nowIso(),
  }
}

export class MemoryMediaCompassStore implements MediaCompassStore {
  protected items: MediaItem[]
  protected ingestEvents: IngestEvent[]
  protected sourceArtifacts: SourceArtifactRecord[]

  constructor(items: MediaItem[] = []) {
    this.items = items
    this.ingestEvents = []
    this.sourceArtifacts = []
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

  async listIngestEvents() {
    return [...this.ingestEvents]
  }

  async createIngestEvent(input: CreateIngestEventInput) {
    const event = makeIngestEvent(input)
    this.ingestEvents = [event, ...this.ingestEvents]
    return event
  }

  async listSourceArtifacts() {
    return [...this.sourceArtifacts]
  }

  async createSourceArtifact(input: CreateSourceArtifactInput) {
    const artifact = makeSourceArtifact(input)
    this.sourceArtifacts = [artifact, ...this.sourceArtifacts]
    return artifact
  }
}

export { makeIngestEvent, makeItem, makeSourceArtifact }
