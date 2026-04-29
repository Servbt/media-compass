import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import { env } from '../env'

const { Client } = pg
const __dirname = dirname(fileURLToPath(import.meta.url))

if (!env.DATABASE_URL) {
  console.error('DATABASE_URL is required to run Postgres migrations.')
  process.exit(1)
}

const migrationPath = join(__dirname, '../../migrations/0001_initial.sql')
const sql = await readFile(migrationPath, 'utf8')
const client = new Client({ connectionString: env.DATABASE_URL })

await client.connect()
try {
  await client.query(sql)
  console.log('Applied migration: 0001_initial.sql')
} finally {
  await client.end()
}
