import { config } from 'dotenv'

config({ quiet: true })

export type TelegramWebhookCommand = 'info' | 'set' | 'delete' | 'me'

type TelegramWebhookEnv = Partial<Record<'TELEGRAM_BOT_TOKEN' | 'TELEGRAM_WEBHOOK_SECRET' | 'APP_BASE_URL', string>>

type FetchLike = (url: string, init: RequestInit) => Promise<Response>

type TelegramWebhookRequestOptions = {
  command: TelegramWebhookCommand
  botToken: string
  appBaseUrl?: string
  webhookSecret?: string
}

type TelegramApiPayload = null | boolean | number | string | TelegramApiPayload[] | { [key: string]: TelegramApiPayload }

export type RunTelegramWebhookCommandOptions = {
  command: TelegramWebhookCommand
  env?: TelegramWebhookEnv
  fetch?: FetchLike
}

export function buildTelegramWebhookUrl(appBaseUrl: string) {
  return `${appBaseUrl.replace(/\/+$/, '')}/api/webhooks/telegram`
}

function requireValue(value: string | undefined, envName: string) {
  if (!value || value.trim().length === 0) {
    throw new Error(`${envName} is required.`)
  }
  return value.trim()
}

function telegramApiUrl(botToken: string, method: string) {
  return `https://api.telegram.org/bot${botToken}/${method}`
}

export function createTelegramWebhookRequest({
  command,
  botToken,
  appBaseUrl,
  webhookSecret,
}: TelegramWebhookRequestOptions) {
  const init: RequestInit = {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
  }

  if (command === 'set') {
    const url = buildTelegramWebhookUrl(requireValue(appBaseUrl, 'APP_BASE_URL'))
    const body: { url: string; secret_token?: string } = { url }
    if (webhookSecret && webhookSecret.trim().length > 0) {
      body.secret_token = webhookSecret.trim()
    }
    init.body = JSON.stringify(body)
    return { url: telegramApiUrl(botToken, 'setWebhook'), init }
  }

  if (command === 'delete') return { url: telegramApiUrl(botToken, 'deleteWebhook'), init }
  if (command === 'me') return { url: telegramApiUrl(botToken, 'getMe'), init }
  return { url: telegramApiUrl(botToken, 'getWebhookInfo'), init }
}

export async function runTelegramWebhookCommand({
  command,
  env = process.env,
  fetch: fetchImpl = fetch,
}: RunTelegramWebhookCommandOptions) {
  const botToken = requireValue(env.TELEGRAM_BOT_TOKEN, 'TELEGRAM_BOT_TOKEN')
  const request = createTelegramWebhookRequest({
    command,
    botToken,
    appBaseUrl: env.APP_BASE_URL,
    webhookSecret: env.TELEGRAM_WEBHOOK_SECRET,
  })

  const response = await fetchImpl(request.url, request.init)
  const text = await response.text()
  const payload = text.length > 0 ? JSON.parse(text) as TelegramApiPayload : null

  if (!response.ok) {
    const description = typeof payload === 'object' && payload !== null && !Array.isArray(payload) && 'description' in payload
      ? String(payload.description)
      : text
    throw new Error(`Telegram ${command} failed with HTTP ${response.status}${description ? `: ${description}` : ''}`)
  }

  return payload
}

function parseCommand(value: string | undefined): TelegramWebhookCommand {
  if (value === 'set' || value === 'delete' || value === 'me' || value === 'info') return value
  throw new Error('Usage: tsx server/src/scripts/telegramWebhook.ts <info|set|delete|me>')
}

function printCommandHint(command: TelegramWebhookCommand) {
  if (command === 'set') {
    if (process.env.APP_BASE_URL && process.env.APP_BASE_URL.trim().length > 0) {
      console.error(`Setting Telegram webhook to ${buildTelegramWebhookUrl(process.env.APP_BASE_URL.trim())}`)
    }
    if (process.env.TELEGRAM_WEBHOOK_SECRET && process.env.TELEGRAM_WEBHOOK_SECRET.trim().length > 0) {
      console.error('Using TELEGRAM_WEBHOOK_SECRET as Telegram secret_token.')
    } else {
      console.error('TELEGRAM_WEBHOOK_SECRET is not configured; webhook will be set without secret_token.')
    }
  }
}

async function main() {
  const command = parseCommand(process.argv[2])
  printCommandHint(command)
  const result = await runTelegramWebhookCommand({ command })
  console.log(JSON.stringify(result, null, 2))
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  })
}
