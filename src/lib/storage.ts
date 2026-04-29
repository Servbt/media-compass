import { seedItems } from './seed'
import type { MediaItem } from './types'

export const STORAGE_KEY = 'media-compass.items.v1'

type StorageAdapter = Pick<Storage, 'getItem' | 'setItem'>

const categories = new Set(['movie', 'tv', 'book', 'game', 'other'])
const statuses = new Set(['inbox', 'curious', 'shortlist', 'in_progress', 'done', 'rejected', 'archived'])
const priorities = new Set([1, 2, 3, 4, 5])
const artifactTypes = new Set(['url', 'text', 'image', 'screenshot', 'telegram_forward', 'audio', 'file'])

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isSourceArtifact(value: unknown) {
  if (!isRecord(value)) return false
  return (
    typeof value.id === 'string' &&
    typeof value.type === 'string' &&
    artifactTypes.has(value.type) &&
    typeof value.createdAt === 'string'
  )
}

function isMediaItem(value: unknown): value is MediaItem {
  if (!isRecord(value)) return false
  return (
    typeof value.id === 'string' &&
    typeof value.canonicalTitle === 'string' &&
    typeof value.category === 'string' &&
    categories.has(value.category) &&
    typeof value.status === 'string' &&
    statuses.has(value.status) &&
    typeof value.priority === 'number' &&
    priorities.has(value.priority) &&
    isStringArray(value.moods) &&
    isStringArray(value.themes) &&
    typeof value.needsReview === 'boolean' &&
    Array.isArray(value.sourceArtifacts) &&
    value.sourceArtifacts.every(isSourceArtifact) &&
    typeof value.createdAt === 'string' &&
    typeof value.updatedAt === 'string'
  )
}

function cloneSeedItems() {
  return structuredClone(seedItems)
}

export function loadItems(storage: StorageAdapter = window.localStorage): MediaItem[] {
  const raw = storage.getItem(STORAGE_KEY)
  if (!raw) return cloneSeedItems()

  try {
    const parsed = JSON.parse(raw) as unknown
    if (Array.isArray(parsed) && parsed.every(isMediaItem)) {
      return parsed
    }
  } catch {
    // Corrupt localStorage should not brick the app. Tiny mercy.
  }

  return cloneSeedItems()
}

export function saveItems(items: MediaItem[], storage: StorageAdapter = window.localStorage) {
  storage.setItem(STORAGE_KEY, JSON.stringify(items, null, 2))
}

export function serializeItems(items: MediaItem[]) {
  return JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), items }, null, 2)
}

export function parseImportedItems(raw: string): MediaItem[] {
  const parsed = JSON.parse(raw) as unknown
  const maybeItems = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === 'object' && 'items' in parsed
      ? (parsed as { items?: unknown }).items
      : null

  if (!Array.isArray(maybeItems) || !maybeItems.every(isMediaItem)) {
    throw new Error('Import file does not contain valid Media Compass items.')
  }

  return maybeItems
}
