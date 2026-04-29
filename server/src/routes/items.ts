import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { MediaCompassStore } from '../db/types'
import { mediaCategories, mediaStatuses } from '../db/schema'

const prioritySchema = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)])

const sourceArtifactSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['url', 'text', 'image', 'screenshot', 'telegram_forward', 'audio', 'file']),
  url: z.string().url().optional(),
  contentText: z.string().optional(),
  storagePath: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  createdAt: z.string().datetime(),
})

const createItemSchema = z.object({
  canonicalTitle: z.string().trim().min(1),
  originalTitle: z.string().trim().min(1).optional(),
  category: z.enum(mediaCategories).default('other'),
  status: z.enum(mediaStatuses).default('inbox'),
  priority: prioritySchema.default(3),
  reason: z.string().optional(),
  summary: z.string().optional(),
  creator: z.string().optional(),
  releaseYear: z.number().int().min(0).max(3000).optional(),
  durationMinutes: z.number().int().positive().optional(),
  commitmentLevel: z.enum(['snack', 'evening', 'weekend', 'long_term']).optional(),
  moods: z.array(z.string()).default([]),
  themes: z.array(z.string()).default([]),
  sourceUrl: z.string().url().optional(),
  posterUrl: z.string().url().optional(),
  externalIds: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
  agentConfidence: z.number().min(0).max(1).optional(),
  confidenceReasons: z.array(z.string()).optional(),
  needsReview: z.boolean().default(true),
  sourceArtifacts: z.array(sourceArtifactSchema).default([]),
})

const updateItemSchema = createItemSchema.partial()

export async function registerItemRoutes(app: FastifyInstance, store: MediaCompassStore) {
  app.get('/api/items', async () => store.listMediaItems())

  app.post('/api/items', async (request, reply) => {
    const parsed = createItemSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid item payload', issues: parsed.error.issues })
    }

    const created = await store.createMediaItem(parsed.data)
    return reply.status(201).send(created)
  })

  app.patch('/api/items/:id', async (request, reply) => {
    const params = z.object({ id: z.string().min(1) }).parse(request.params)
    const parsed = updateItemSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid item payload', issues: parsed.error.issues })
    }

    const updated = await store.updateMediaItem(params.id, parsed.data)
    if (!updated) return reply.status(404).send({ error: 'Item not found' })
    return updated
  })

  app.post('/api/items/:id/archive', async (request, reply) => {
    const params = z.object({ id: z.string().min(1) }).parse(request.params)
    const archived = await store.archiveMediaItem(params.id)
    if (!archived) return reply.status(404).send({ error: 'Item not found' })
    return archived
  })
}
