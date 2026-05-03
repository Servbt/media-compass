import { config } from 'dotenv'
import { z } from 'zod'

config()

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3001),
  MEDIA_COMPASS_DATA_FILE: z.string().default('.data/media-compass.json'),
  HOST: z.string().default('0.0.0.0'),
  FRONTEND_ORIGIN: z.string().optional(),
  API_TOKEN: z.string().optional(),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_WEBHOOK_SECRET: z.string().optional(),
  TELEGRAM_ALLOWED_USER_ID: z.string().optional(),
  APP_BASE_URL: z.string().optional(),
  DATABASE_URL: z.string().optional(),
})

export const env = envSchema.parse(process.env)
