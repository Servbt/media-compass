// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { buildApp } from './app'
import { MemoryMediaCompassStore } from './db/memoryStore'

describe('server app', () => {
  it('responds to health checks', async () => {
    const app = buildApp({ store: new MemoryMediaCompassStore() })

    const response = await app.inject({ method: 'GET', url: '/healthz' })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ ok: true })
  })

  it('creates, lists, patches, and archives media items', async () => {
    const app = buildApp({ store: new MemoryMediaCompassStore() })

    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/items',
      payload: {
        canonicalTitle: 'Scavengers Reign',
        category: 'tv',
        moods: ['weird', 'beautiful'],
        reason: 'Looks like alien nature documentary nightmare fuel.',
      },
    })
    expect(createResponse.statusCode).toBe(201)
    const created = createResponse.json()
    expect(created).toMatchObject({
      canonicalTitle: 'Scavengers Reign',
      category: 'tv',
      status: 'inbox',
      needsReview: true,
    })

    const listResponse = await app.inject({ method: 'GET', url: '/api/items' })
    expect(listResponse.json()).toHaveLength(1)

    const patchResponse = await app.inject({
      method: 'PATCH',
      url: `/api/items/${created.id}`,
      payload: { status: 'shortlist', needsReview: false, priority: 5 },
    })
    expect(patchResponse.statusCode).toBe(200)
    expect(patchResponse.json()).toMatchObject({ status: 'shortlist', needsReview: false, priority: 5 })

    const archiveResponse = await app.inject({ method: 'POST', url: `/api/items/${created.id}/archive` })
    expect(archiveResponse.statusCode).toBe(200)
    expect(archiveResponse.json()).toMatchObject({ status: 'archived' })
  })

  it('preserves source artifacts when creating items', async () => {
    const app = buildApp({ store: new MemoryMediaCompassStore() })
    const createdAt = new Date().toISOString()

    const response = await app.inject({
      method: 'POST',
      url: '/api/items',
      payload: {
        canonicalTitle: 'Manual note',
        category: 'other',
        sourceArtifacts: [{
          id: 'artifact-1',
          type: 'text',
          contentText: 'Manual note',
          createdAt,
        }],
      },
    })

    expect(response.statusCode).toBe(201)
    expect(response.json().sourceArtifacts).toEqual([{
      id: 'artifact-1',
      type: 'text',
      contentText: 'Manual note',
      createdAt,
    }])
  })

  it('requires bearer token for writes when configured', async () => {
    const app = buildApp({ store: new MemoryMediaCompassStore(), apiToken: 'secret' })

    const unauthorized = await app.inject({
      method: 'POST',
      url: '/api/items',
      payload: { canonicalTitle: 'Nope', category: 'other' },
    })
    expect(unauthorized.statusCode).toBe(401)

    const authorized = await app.inject({
      method: 'POST',
      url: '/api/items',
      headers: { authorization: 'Bearer secret' },
      payload: { canonicalTitle: 'Yep', category: 'other' },
    })
    expect(authorized.statusCode).toBe(201)
  })

  it('rejects invalid item payloads and unknown ids', async () => {
    const app = buildApp({ store: new MemoryMediaCompassStore() })

    const badCreate = await app.inject({
      method: 'POST',
      url: '/api/items',
      payload: { canonicalTitle: '', category: 'vibes' },
    })
    expect(badCreate.statusCode).toBe(400)

    const missingPatch = await app.inject({
      method: 'PATCH',
      url: '/api/items/nope',
      payload: { status: 'done' },
    })
    expect(missingPatch.statusCode).toBe(404)
  })
})
