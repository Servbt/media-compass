import cors from '@fastify/cors'
import Fastify from 'fastify'
import type { MediaCompassStore } from './db/types'
import { registerItemRoutes } from './routes/items'
import { registerTelegramRoutes } from './routes/telegram'
import type { TelegramClient } from './services/telegram'

export type BuildAppOptions = {
  store: MediaCompassStore
  corsOrigin?: string | false
  apiToken?: string
  telegramBotToken?: string
  telegramWebhookSecret?: string
  telegramAllowedUserId?: string
  telegramClient?: TelegramClient
}

export function buildApp({
  store,
  corsOrigin = false,
  apiToken,
  telegramBotToken,
  telegramWebhookSecret,
  telegramAllowedUserId,
  telegramClient,
}: BuildAppOptions) {
  const app = Fastify({ logger: false })

  app.register(cors, { origin: corsOrigin })

  app.addHook('preHandler', async (request, reply) => {
    if (
      !apiToken
      || request.method === 'GET'
      || request.url === '/healthz'
      || request.url === '/api/webhooks/telegram'
    ) return
    if (request.headers.authorization === `Bearer ${apiToken}`) return
    return reply.status(401).send({ error: 'Unauthorized' })
  })

  app.get('/healthz', async () => ({ ok: true }))
  app.register(async (scoped) => registerItemRoutes(scoped, store))
  app.register(async (scoped) => registerTelegramRoutes(scoped, {
    store,
    botToken: telegramBotToken,
    webhookSecret: telegramWebhookSecret,
    allowedUserId: telegramAllowedUserId,
    telegramClient,
  }))

  return app
}
