export const mediaCategories = ['movie', 'tv', 'book', 'game', 'other'] as const
export const mediaStatuses = ['inbox', 'curious', 'shortlist', 'in_progress', 'done', 'rejected', 'archived'] as const
export const sourceArtifactTypes = ['url', 'text', 'image', 'screenshot', 'telegram_forward', 'audio', 'file'] as const
export const queueStates = [
  'received',
  'queued',
  'locked',
  'extracting',
  'metadata_lookup',
  'deduping',
  'needs_clarification',
  'needs_review',
  'saving',
  'completed',
  'failed_retryable',
  'failed_terminal',
  'cancelled',
] as const
