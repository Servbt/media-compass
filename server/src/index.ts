import { buildApp } from './app'
import { JsonMediaCompassStore } from './db/jsonStore'
import { env } from './env'

const app = buildApp({
  store: new JsonMediaCompassStore(env.MEDIA_COMPASS_DATA_FILE),
  corsOrigin: env.FRONTEND_ORIGIN ?? false,
  apiToken: env.API_TOKEN,
})

try {
  await app.listen({ port: env.PORT, host: env.HOST })
  app.log.info(`Media Compass API listening on ${env.PORT}`)
} catch (error) {
  app.log.error(error)
  process.exit(1)
}
