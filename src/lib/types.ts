export type MediaCategory = 'movie' | 'tv' | 'book' | 'game' | 'other'

export type MediaStatus =
  | 'inbox'
  | 'curious'
  | 'shortlist'
  | 'in_progress'
  | 'done'
  | 'rejected'
  | 'archived'

export type SourceArtifact = {
  id: string
  type: 'url' | 'text' | 'image' | 'screenshot' | 'telegram_forward' | 'audio' | 'file'
  url?: string
  contentText?: string
  storagePath?: string
  metadata?: Record<string, unknown>
  createdAt: string
}

export type MediaItem = {
  id: string
  canonicalTitle: string
  originalTitle?: string
  category: MediaCategory
  status: MediaStatus
  priority: 1 | 2 | 3 | 4 | 5
  reason?: string
  summary?: string
  creator?: string
  releaseYear?: number
  durationMinutes?: number
  commitmentLevel?: 'snack' | 'evening' | 'weekend' | 'long_term'
  moods: string[]
  themes: string[]
  sourceUrl?: string
  posterUrl?: string
  externalIds?: Record<string, string | number>
  agentConfidence?: number
  confidenceReasons?: string[]
  needsReview: boolean
  sourceArtifacts: SourceArtifact[]
  createdAt: string
  updatedAt: string
  lastPickedAt?: string
  completedAt?: string
}

export type PickConstraints = {
  category?: MediaCategory | 'any'
  mood?: string
}
