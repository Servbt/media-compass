import { config } from 'dotenv'
import { z } from 'zod'

config()

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3001),
  MEDIA_COMPASS_DATA_FILE: z.string().default('.data/media-compass.json'),
  HOST: z.string().default('127.0.0.1'),
  FRONTEND_ORIGIN: z.string().optional(),
  API_TOKEN: z.string().optional(),
  DATABASE_URL: z.string().optional(),
})

export const env = envSchema.parse(process.env)
