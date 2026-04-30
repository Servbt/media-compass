import { constants as fsConstants } from 'node:fs'
import { access, readFile, writeFile } from 'node:fs/promises'
import { spawn, type ChildProcessByStdio } from 'node:child_process'
import type { Readable } from 'node:stream'
import { parse as parseDotenv } from 'dotenv'
import { runTelegramWebhookCommand } from './telegramWebhook'

const API_PORT = 3001
const FRONTEND_PORT = 5173
const API_HEALTH_URL = `http://localhost:${API_PORT}/healthz`
const FRONTEND_LOCAL_URL = `http://localhost:${FRONTEND_PORT}`
const ENV_PATH = '.env'

type EnvMap = Record<string, string | undefined>
type ManagedChildProcess = ChildProcessByStdio<null, Readable, Readable>

type ManagedProcess = {
  name: string
  child: ManagedChildProcess
}

type EnvUpdates = Record<string, string>

export function parseCloudflaredUrl(text: string) {
  return text.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/)?.[0] ?? null
}

function quoteEnvValue(value: string) {
  if (value.length === 0) return ''
  if (!/[\s#'"\\]/.test(value)) return value
  return JSON.stringify(value)
}

export function updateEnvText(text: string, updates: EnvUpdates) {
  const remainingUpdates = new Map(Object.entries(updates))
  const hadTrailingNewline = text.endsWith('\n')
  const lines = text.length > 0 ? text.replace(/\n$/, '').split('\n') : []
  const updatedLines = lines.map((line) => {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/)
    if (!match) return line

    const key = match[1]
    const value = remainingUpdates.get(key)
    if (value === undefined) return line

    remainingUpdates.delete(key)
    return `${key}=${quoteEnvValue(value)}`
  })

  for (const [key, value] of remainingUpdates) {
    updatedLines.push(`${key}=${quoteEnvValue(value)}`)
  }

  if (updatedLines.length === 0) {
    return hadTrailingNewline ? '\n' : Object.entries(updates).map(([key, value]) => `${key}=${quoteEnvValue(value)}`).join('\n') + '\n'
  }

  return `${updatedLines.join('\n')}\n`
}

export function assertRequiredEnv(env: EnvMap, keys: string[]) {
  const result: Record<string, string> = {}
  const missing = keys.filter((key) => {
    const value = env[key]
    if (!value || value.trim().length === 0) return true
    result[key] = value.trim()
    return false
  })

  if (missing.length > 0) {
    throw new Error(`Missing required .env values: ${missing.join(', ')}`)
  }

  return result
}

export function buildFrontendEnv(baseEnv: NodeJS.ProcessEnv, apiBaseUrl: string) {
  return {
    ...baseEnv,
    VITE_API_BASE_URL: apiBaseUrl,
  }
}

async function assertCloudflaredExists() {
  await new Promise<void>((resolve, reject) => {
    const child = spawn('cloudflared', ['--version'], { stdio: 'ignore' })
    child.once('error', () => reject(new Error('cloudflared is required. Install it first, then rerun npm run dev:tunnel.')))
    child.once('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error('cloudflared is installed but `cloudflared --version` failed.'))
    })
  })
}

async function loadEnvFile(path: string) {
  await access(path, fsConstants.R_OK | fsConstants.W_OK).catch(() => {
    throw new Error(`Missing writable ${path}. Create it from .env.example and add Telegram values before running this command.`)
  })

  const text = await readFile(path, 'utf8')
  return { text, parsed: parseDotenv(text) as EnvMap }
}

async function updateEnvFile(path: string, updates: EnvUpdates) {
  const text = await readFile(path, 'utf8')
  await writeFile(path, updateEnvText(text, updates))
}

function prefixOutput(name: string, chunk: Buffer) {
  const text = chunk.toString()
  for (const line of text.split(/\r?\n/)) {
    if (line.trim().length > 0) console.log(`[${name}] ${line}`)
  }
}

function startManagedProcess(name: string, command: string, args: string[], env: NodeJS.ProcessEnv = process.env): ManagedProcess {
  const child = spawn(command, args, {
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const managed = { name, child }

  child.stdout.on('data', (chunk: Buffer) => prefixOutput(name, chunk))
  child.stderr.on('data', (chunk: Buffer) => prefixOutput(name, chunk))
  child.once('error', (error) => {
    console.error(`[${name}] ${error.message}`)
  })

  return managed
}

function startApiServer(envOverrides: EnvUpdates = {}) {
  return startManagedProcess('api', 'npm', ['run', 'dev:server'], { ...process.env, ...envOverrides })
}

function startFrontend(apiUrl: string) {
  return startManagedProcess('frontend', 'npm', ['run', 'dev', '--', '--host', '0.0.0.0'], buildFrontendEnv(process.env, apiUrl))
}

function startCloudflaredTunnel(name: string, localUrl: string) {
  return startManagedProcess(name, 'cloudflared', ['tunnel', '--url', localUrl])
}

async function waitForHttp(url: string, label: string, options: { requireHealthOk?: boolean } = {}) {
  const timeoutMs = 30_000
  const deadline = Date.now() + timeoutMs
  let lastError = ''

  while (Date.now() < deadline) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 2_000)
    try {
      const response = await fetch(url, { signal: controller.signal })
      if (response.ok) {
        if (!options.requireHealthOk) return
        const payload = await response.json() as { ok?: unknown }
        if (payload.ok === true) return
        lastError = `unexpected health payload: ${JSON.stringify(payload)}`
      } else {
        lastError = `HTTP ${response.status}`
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
    } finally {
      clearTimeout(timeout)
    }

    await new Promise((resolve) => setTimeout(resolve, 500))
  }

  throw new Error(`${label} did not become ready at ${url} within ${timeoutMs / 1000}s${lastError ? ` (${lastError})` : ''}.`)
}

async function waitForCloudflaredUrl(process: ManagedProcess) {
  return new Promise<string>((resolve, reject) => {
    let output = ''
    const timeout = setTimeout(() => {
      cleanup()
      reject(new Error(`${process.name} did not print a trycloudflare.com URL within 30s.`))
    }, 30_000)

    const onData = (chunk: Buffer) => {
      output += chunk.toString()
      const url = parseCloudflaredUrl(output)
      if (url) {
        cleanup()
        resolve(url)
      }
    }
    const onExit = (code: number | null, signal: NodeJS.Signals | null) => {
      cleanup()
      reject(new Error(`${process.name} exited before printing a public URL (code ${code ?? 'n/a'}, signal ${signal ?? 'n/a'}).`))
    }
    const onError = (error: Error) => {
      cleanup()
      reject(error)
    }
    const cleanup = () => {
      clearTimeout(timeout)
      process.child.stdout.off('data', onData)
      process.child.stderr.off('data', onData)
      process.child.off('exit', onExit)
      process.child.off('error', onError)
    }

    process.child.stdout.on('data', onData)
    process.child.stderr.on('data', onData)
    process.child.once('exit', onExit)
    process.child.once('error', onError)
  })
}

async function terminateProcess(process: ManagedProcess) {
  const { child, name } = process
  if (child.exitCode !== null || child.signalCode !== null) return

  await new Promise<void>((resolve) => {
    const killTimer = setTimeout(() => {
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL')
    }, 5_000)

    child.once('exit', () => {
      clearTimeout(killTimer)
      resolve()
    })

    console.log(`Stopping ${name}...`)
    child.kill('SIGTERM')
  })
}

async function cleanup(processes: ManagedProcess[]) {
  await Promise.all([...processes].reverse().map((managedProcess) => terminateProcess(managedProcess)))
}

async function main() {
  console.log('Starting Media Compass tunneled local development...')
  await assertCloudflaredExists()
  const initialEnv = await loadEnvFile(ENV_PATH)
  assertRequiredEnv(initialEnv.parsed, ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_WEBHOOK_SECRET'])

  const processes: ManagedProcess[] = []
  let shuttingDown = false
  const shutdown = async (signal: NodeJS.Signals) => {
    if (shuttingDown) return
    shuttingDown = true
    console.log(`\nReceived ${signal}. Shutting down local dev processes...`)
    await cleanup(processes)
    process.exit(0)
  }

  process.once('SIGINT', shutdown)
  process.once('SIGTERM', shutdown)

  try {
    let api = startApiServer()
    processes.push(api)
    await waitForHttp(API_HEALTH_URL, 'API server', { requireHealthOk: true })

    const apiTunnel = startCloudflaredTunnel('api-tunnel', `http://localhost:${API_PORT}`)
    processes.push(apiTunnel)
    const apiUrl = await waitForCloudflaredUrl(apiTunnel)
    await updateEnvFile(ENV_PATH, {
      APP_BASE_URL: apiUrl,
      VITE_API_BASE_URL: apiUrl,
    })
    console.log(`Updated .env with APP_BASE_URL and VITE_API_BASE_URL: ${apiUrl}`)

    const frontend = startFrontend(apiUrl)
    processes.push(frontend)
    await waitForHttp(FRONTEND_LOCAL_URL, 'Frontend')

    const frontendTunnel = startCloudflaredTunnel('frontend-tunnel', `http://localhost:${FRONTEND_PORT}`)
    processes.push(frontendTunnel)
    const frontendUrl = await waitForCloudflaredUrl(frontendTunnel)
    await updateEnvFile(ENV_PATH, { FRONTEND_ORIGIN: frontendUrl })
    console.log(`Updated .env with FRONTEND_ORIGIN: ${frontendUrl}`)

    console.log('Restarting API so it reloads FRONTEND_ORIGIN for CORS...')
    await terminateProcess(api)
    processes.splice(processes.indexOf(api), 1)
    api = startApiServer({
      APP_BASE_URL: apiUrl,
      VITE_API_BASE_URL: apiUrl,
      FRONTEND_ORIGIN: frontendUrl,
    })
    processes.push(api)
    await waitForHttp(API_HEALTH_URL, 'API server after restart', { requireHealthOk: true })

    const refreshedEnv = await loadEnvFile(ENV_PATH)
    const webhookResult = await runTelegramWebhookCommand({ command: 'set', env: refreshedEnv.parsed })

    console.log('\nMedia Compass tunneled local dev is ready.')
    console.log(`Frontend: ${frontendUrl}`)
    console.log(`API:      ${apiUrl}`)
    console.log(`Webhook:  ${apiUrl.replace(/\/+$/, '')}/api/webhooks/telegram`)
    console.log('Telegram setWebhook result:')
    console.log(JSON.stringify(webhookResult, null, 2))
    console.log('\nOpen the frontend URL above, send your Telegram bot a capture, and press Ctrl+C here to stop API, frontend, and both tunnels.')

    await new Promise(() => undefined)
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    await cleanup(processes)
    process.exit(1)
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  })
}
