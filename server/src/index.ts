import { buildApp } from './app'
import { JsonMediaCompassStore } from './db/jsonStore'
import { env } from './env'
import { TelegramBotApiClient } from './services/telegram'

const app = buildApp({
  store: new JsonMediaCompassStore(env.MEDIA_COMPASS_DATA_FILE),
  corsOrigin: env.FRONTEND_ORIGIN ?? false,
  apiToken: env.API_TOKEN,
  telegramBotToken: env.TELEGRAM_BOT_TOKEN,
  telegramWebhookSecret: env.TELEGRAM_WEBHOOK_SECRET,
  telegramAllowedUserId: env.TELEGRAM_ALLOWED_USER_ID,
  telegramClient: env.TELEGRAM_BOT_TOKEN ? new TelegramBotApiClient(env.TELEGRAM_BOT_TOKEN) : undefined,
  serveStaticRoot: 'dist',
})

try {
  await app.listen({ port: env.PORT, host: env.HOST })
  app.log.info(`Media Compass API listening on ${env.PORT}`)
} catch (error) {
  app.log.error(error)
  process.exit(1)
}
