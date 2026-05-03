import { existsSync } from 'node:fs'
import path from 'node:path'
import cors from '@fastify/cors'
import fastifyStatic from '@fastify/static'
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
  serveStaticRoot?: string
}

export function buildApp({
  store,
  corsOrigin = false,
  apiToken,
  telegramBotToken,
  telegramWebhookSecret,
  telegramAllowedUserId,
  telegramClient,
  serveStaticRoot,
}: BuildAppOptions) {
  const app = Fastify({ logger: true })

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

  if (serveStaticRoot) {
    const resolved = path.resolve(serveStaticRoot)
    if (existsSync(resolved)) {
      app.register(fastifyStatic, {
        root: resolved,
        prefix: '/',
        wildcard: false,
      })
      // SPA fallback: any unmatched non-API route → index.html
      app.setNotFoundHandler(async (request, reply) => {
        if (request.url.startsWith('/api/')) {
          return reply.status(404).send({ error: 'Not found' })
        }
        return reply.sendFile('index.html')
      })
    }
  }

  return app
}
