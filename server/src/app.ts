import cors from '@fastify/cors'
import Fastify from 'fastify'
import type { MediaCompassStore } from './db/types'
import { registerItemRoutes } from './routes/items'

export type BuildAppOptions = {
  store: MediaCompassStore
  corsOrigin?: string | false
  apiToken?: string
}

export function buildApp({ store, corsOrigin = false, apiToken }: BuildAppOptions) {
  const app = Fastify({ logger: false })

  app.register(cors, { origin: corsOrigin })

  app.addHook('preHandler', async (request, reply) => {
    if (!apiToken || request.method === 'GET' || request.url === '/healthz') return
    if (request.headers.authorization === `Bearer ${apiToken}`) return
    return reply.status(401).send({ error: 'Unauthorized' })
  })

  app.get('/healthz', async () => ({ ok: true }))
  app.register(async (scoped) => registerItemRoutes(scoped, store))

  return app
}
