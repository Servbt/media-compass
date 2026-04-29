// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import {
  buildTelegramWebhookUrl,
  createTelegramWebhookRequest,
  runTelegramWebhookCommand,
} from './telegramWebhook'

describe('telegramWebhook script helpers', () => {
  it('builds the webhook URL from APP_BASE_URL without duplicating slashes', () => {
    expect(buildTelegramWebhookUrl('https://example.ngrok-free.app/')).toBe(
      'https://example.ngrok-free.app/api/webhooks/telegram',
    )
  })

  it('requires TELEGRAM_BOT_TOKEN for all commands', async () => {
    await expect(runTelegramWebhookCommand({ command: 'info', env: {}, fetch: vi.fn() })).rejects.toThrow(
      'TELEGRAM_BOT_TOKEN is required',
    )
  })

  it('requires APP_BASE_URL when setting the webhook', async () => {
    await expect(
      runTelegramWebhookCommand({
        command: 'set',
        env: { TELEGRAM_BOT_TOKEN: '123:secret' },
        fetch: vi.fn(),
      }),
    ).rejects.toThrow('APP_BASE_URL is required')
  })

  it('creates setWebhook request body with URL and secret token', () => {
    const request = createTelegramWebhookRequest({
      command: 'set',
      botToken: '123:secret',
      appBaseUrl: 'https://public.example',
      webhookSecret: 'webhook-secret',
    })

    expect(request.url).toBe('https://api.telegram.org/bot123:secret/setWebhook')
    expect(request.init).toMatchObject({
      method: 'POST',
      headers: { 'content-type': 'application/json' },
    })
    expect(JSON.parse(String(request.init.body))).toEqual({
      url: 'https://public.example/api/webhooks/telegram',
      secret_token: 'webhook-secret',
    })
  })

  it('omits secret_token when TELEGRAM_WEBHOOK_SECRET is blank', () => {
    const request = createTelegramWebhookRequest({
      command: 'set',
      botToken: '123:secret',
      appBaseUrl: 'https://public.example',
      webhookSecret: '',
    })

    expect(JSON.parse(String(request.init.body))).toEqual({
      url: 'https://public.example/api/webhooks/telegram',
    })
  })

  it('calls getWebhookInfo with POST and returns Telegram JSON', async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ ok: true, result: { url: 'https://public.example/api/webhooks/telegram' } })))

    await expect(
      runTelegramWebhookCommand({
        command: 'info',
        env: { TELEGRAM_BOT_TOKEN: '123:secret' },
        fetch,
      }),
    ).resolves.toEqual({ ok: true, result: { url: 'https://public.example/api/webhooks/telegram' } })

    expect(fetch).toHaveBeenCalledWith('https://api.telegram.org/bot123:secret/getWebhookInfo', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
    })
  })
})
