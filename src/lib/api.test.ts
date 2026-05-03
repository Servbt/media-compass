import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMediaCompassApi } from './api'

describe('createMediaCompassApi', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns null when called with undefined (no base URL configured)', () => {
    expect(createMediaCompassApi()).toBeNull()
    expect(createMediaCompassApi(undefined)).toBeNull()
  })

  it('returns a client when base URL is empty string (same-origin)', () => {
    const api = createMediaCompassApi('')
    expect(api).not.toBeNull()
  })

  it('lists and creates items through the configured API', async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      if (String(url) === 'http://localhost:3001/api/items' && !init?.method) {
        return new Response(JSON.stringify([]), { status: 200 })
      }
      if (String(url) === 'http://localhost:3001/api/items' && init?.method === 'POST') {
        return new Response(String(init.body), { status: 201 })
      }
      return new Response('not found', { status: 404 })
    })
    vi.stubGlobal('fetch', fetchMock)

    const api = createMediaCompassApi('http://localhost:3001')

    const sourceArtifacts = [{
      id: 'artifact-1',
      type: 'text' as const,
      contentText: 'Dune',
      createdAt: '2026-01-01T00:00:00.000Z',
    }]

    await expect(api?.listItems()).resolves.toEqual([])
    await expect(api?.createItem({ canonicalTitle: 'Dune', category: 'book', sourceArtifacts })).resolves.toMatchObject({
      canonicalTitle: 'Dune',
      category: 'book',
      sourceArtifacts,
    })
  })
})
