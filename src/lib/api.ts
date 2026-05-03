import type { MediaItem, MediaCategory, MediaStatus, SourceArtifact } from './types'

export type CreateApiItemInput = {
  canonicalTitle: string
  category?: MediaCategory
  moods?: string[]
  themes?: string[]
  reason?: string
  priority?: 1 | 2 | 3 | 4 | 5
  needsReview?: boolean
  status?: MediaStatus
  sourceArtifacts?: SourceArtifact[]
}

export type UpdateApiItemInput = Partial<CreateApiItemInput>

export type MediaCompassApi = {
  listItems(): Promise<MediaItem[]>
  createItem(input: CreateApiItemInput): Promise<MediaItem>
  updateItem(id: string, input: UpdateApiItemInput): Promise<MediaItem>
  archiveItem(id: string): Promise<MediaItem>
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  })

  if (!response.ok) {
    throw new Error(`Media Compass API request failed: ${response.status}`)
  }

  return response.json() as Promise<T>
}

export function createMediaCompassApi(baseUrl?: string, apiToken?: string): MediaCompassApi | null {
  if (baseUrl === undefined) return null
  const normalizedBaseUrl = baseUrl.trim().replace(/\/$/, '')
  const authHeaders = apiToken ? { Authorization: `Bearer ${apiToken}` } : undefined

  return {
    listItems: () => requestJson<MediaItem[]>(`${normalizedBaseUrl}/api/items`),
    createItem: (input) => requestJson<MediaItem>(`${normalizedBaseUrl}/api/items`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(input),
    }),
    updateItem: (id, input) => requestJson<MediaItem>(`${normalizedBaseUrl}/api/items/${id}`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify(input),
    }),
    archiveItem: (id) => requestJson<MediaItem>(`${normalizedBaseUrl}/api/items/${id}/archive`, {
      method: 'POST',
      headers: authHeaders,
    }),
  }
}
