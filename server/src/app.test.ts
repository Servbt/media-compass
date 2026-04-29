// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
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

  it('bypasses API token but requires Telegram secret for webhook captures', async () => {
    const store = new MemoryMediaCompassStore()
    const app = buildApp({
      store,
      apiToken: 'api-secret',
      telegramWebhookSecret: 'telegram-secret',
      telegramAllowedUserId: '42',
    })

    const payload = {
      update_id: 1000,
      message: {
        message_id: 99,
        from: { id: 42, first_name: 'Arian' },
        chat: { id: 123, type: 'private' },
        date: 1_700_000_000,
        text: 'Outer Wilds looks cool',
      },
    }

    const missingSecret = await app.inject({
      method: 'POST',
      url: '/api/webhooks/telegram',
      payload,
    })
    expect(missingSecret.statusCode).toBe(401)

    const wrongUser = await app.inject({
      method: 'POST',
      url: '/api/webhooks/telegram',
      headers: { 'x-telegram-bot-api-secret-token': 'telegram-secret' },
      payload: { ...payload, message: { ...payload.message, from: { id: 777 } } },
    })
    expect(wrongUser.statusCode).toBe(403)

    const ok = await app.inject({
      method: 'POST',
      url: '/api/webhooks/telegram',
      headers: { 'x-telegram-bot-api-secret-token': 'telegram-secret' },
      payload,
    })
    expect(ok.statusCode).toBe(200)
    expect(ok.json()).toEqual({ ok: true })

    await expect(store.listIngestEvents()).resolves.toMatchObject([
      {
        channel: 'telegram',
        channelMessageId: '99',
        rawText: 'Outer Wilds looks cool',
        state: 'completed',
      },
    ])
  })

  it('captures Telegram text into artifacts and a review inbox item visible in items API', async () => {
    const sendMessage = vi.fn().mockResolvedValue(undefined)
    const store = new MemoryMediaCompassStore()
    const app = buildApp({
      store,
      telegramBotToken: 'bot-token',
      telegramClient: { sendMessage },
    })

    const response = await app.inject({
      method: 'POST',
      url: '/api/webhooks/telegram',
      payload: {
        update_id: 1001,
        message: {
          message_id: 100,
          from: { id: 42 },
          chat: { id: 123, type: 'private' },
          text: 'Outer Wilds looks cool\nRecommended by Mobius.',
        },
      },
    })

    expect(response.statusCode).toBe(200)
    expect(sendMessage).toHaveBeenCalledWith(123, "Saved to inbox. I'll annotate it now.")

    const artifacts = await store.listSourceArtifacts()
    expect(artifacts).toHaveLength(1)
    expect(artifacts[0]).toMatchObject({
      type: 'text',
      contentText: 'Outer Wilds looks cool\nRecommended by Mobius.',
    })

    const listResponse = await app.inject({ method: 'GET', url: '/api/items' })
    expect(listResponse.json()).toMatchObject([
      {
        canonicalTitle: 'Outer Wilds looks cool',
        category: 'other',
        status: 'inbox',
        needsReview: true,
        reason: 'Captured from Telegram; needs review.',
        sourceArtifacts: [
          {
            type: 'text',
            contentText: 'Outer Wilds looks cool\nRecommended by Mobius.',
          },
        ],
      },
    ])
  })

  it('captures Telegram URLs into URL artifacts and item sourceUrl', async () => {
    const store = new MemoryMediaCompassStore()
    const app = buildApp({ store })

    const response = await app.inject({
      method: 'POST',
      url: '/api/webhooks/telegram',
      payload: {
        update_id: 1002,
        message: {
          message_id: 101,
          from: { id: 42 },
          chat: { id: 123, type: 'private' },
          text: 'Watch this https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          entities: [{ type: 'url', offset: 11, length: 43 }],
        },
      },
    })

    expect(response.statusCode).toBe(200)
    const artifacts = await store.listSourceArtifacts()
    expect(artifacts).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'url', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }),
    ]))

    const listResponse = await app.inject({ method: 'GET', url: '/api/items' })
    expect(listResponse.json()[0]).toMatchObject({
      canonicalTitle: 'www.youtube.com',
      sourceUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      sourceArtifacts: expect.arrayContaining([
        expect.objectContaining({ type: 'url', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }),
      ]),
    })
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
