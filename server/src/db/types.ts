import type { MediaItem, MediaCategory, MediaStatus, SourceArtifact } from '../../../src/lib/types'

export type User = {
  id: string
  telegramUserId?: string
  displayName: string
  timezone?: string
  createdAt: string
}

export type IngestEvent = {
  id: string
  userId: string
  channel: 'telegram' | 'web' | 'manual' | 'api'
  channelMessageId?: string
  rawText?: string
  rawPayload: Record<string, unknown>
  state: string
  errorMessage?: string
  createdAt: string
  processedAt?: string
}

export type EnrichmentJob = {
  id: string
  userId: string
  ingestEventId?: string
  mediaItemId?: string
  type: 'extract' | 'fetch_metadata' | 'dedupe' | 'classify' | 'clarify_response'
  state: string
  attempts: number
  maxAttempts: number
  runAfter: string
  lockedAt?: string
  lockedBy?: string
  input: Record<string, unknown>
  output?: Record<string, unknown>
  errorMessage?: string
  createdAt: string
  finishedAt?: string
}

export type ClarificationRequest = {
  id: string
  userId: string
  ingestEventId?: string
  mediaItemId?: string
  question: string
  options?: unknown[]
  state: 'open' | 'answered' | 'expired' | 'cancelled'
  answerText?: string
  answerPayload?: Record<string, unknown>
  createdAt: string
  answeredAt?: string
}

export type PickerEvent = {
  id: string
  userId: string
  mediaItemId: string
  constraints: Record<string, unknown>
  resultRank: number
  action: 'shown' | 'accepted' | 'rerolled' | 'skipped' | 'started' | 'completed'
  createdAt: string
}

export type SourceArtifactRecord = SourceArtifact & {
  userId: string
  mediaItemId?: string
  ingestEventId?: string
}

export type DataSnapshot = {
  schemaVersion: 1
  users: User[]
  mediaItems: MediaItem[]
  sourceArtifacts: SourceArtifactRecord[]
  ingestEvents: IngestEvent[]
  enrichmentJobs: EnrichmentJob[]
  clarificationRequests: ClarificationRequest[]
  pickerEvents: PickerEvent[]
}

export type CreateIngestEventInput = {
  userId?: string
  channel: IngestEvent['channel']
  channelMessageId?: string
  rawText?: string
  rawPayload: Record<string, unknown>
  state?: string
  errorMessage?: string
  processedAt?: string
}

export type CreateSourceArtifactInput = {
  id?: string
  userId?: string
  mediaItemId?: string
  ingestEventId?: string
  type: SourceArtifact['type']
  url?: string
  contentText?: string
  storagePath?: string
  metadata?: Record<string, unknown>
  createdAt?: string
}

export type CreateMediaItemInput = {
  canonicalTitle: string
  originalTitle?: string
  category?: MediaCategory
  status?: MediaStatus
  priority?: 1 | 2 | 3 | 4 | 5
  reason?: string
  summary?: string
  creator?: string
  releaseYear?: number
  durationMinutes?: number
  commitmentLevel?: MediaItem['commitmentLevel']
  moods?: string[]
  themes?: string[]
  sourceUrl?: string
  posterUrl?: string
  externalIds?: Record<string, string | number>
  agentConfidence?: number
  confidenceReasons?: string[]
  needsReview?: boolean
  sourceArtifacts?: SourceArtifact[]
}

export type UpdateMediaItemInput = Partial<Omit<CreateMediaItemInput, 'sourceArtifacts'>>

export type MediaCompassStore = {
  listMediaItems(): Promise<MediaItem[]>
  createMediaItem(input: CreateMediaItemInput): Promise<MediaItem>
  updateMediaItem(id: string, input: UpdateMediaItemInput): Promise<MediaItem | null>
  archiveMediaItem(id: string): Promise<MediaItem | null>
  listIngestEvents(): Promise<IngestEvent[]>
  createIngestEvent(input: CreateIngestEventInput): Promise<IngestEvent>
  listSourceArtifacts(): Promise<SourceArtifactRecord[]>
  createSourceArtifact(input: CreateSourceArtifactInput): Promise<SourceArtifactRecord>
}
