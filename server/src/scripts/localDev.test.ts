// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  assertRequiredEnv,
  buildFrontendEnv,
  parseCloudflaredUrl,
  updateEnvText,
} from './localDev'

describe('localDev script helpers', () => {
  it('parses a trycloudflare HTTPS URL from cloudflared output', () => {
    expect(
      parseCloudflaredUrl('2026-04-30T02:00 INF | https://quiet-river-123.trycloudflare.com |'),
    ).toBe('https://quiet-river-123.trycloudflare.com')
  })

  it('parses the first trycloudflare URL from multiline output', () => {
    expect(
      parseCloudflaredUrl(`starting tunnel\nYour quick Tunnel has been created! Visit it at:\nhttps://api-dev.trycloudflare.com\nmore logs`),
    ).toBe('https://api-dev.trycloudflare.com')
  })

  it('returns null when cloudflared output does not contain a public URL', () => {
    expect(parseCloudflaredUrl('Starting metrics server on 127.0.0.1:20241')).toBeNull()
  })

  it('updates existing env keys while preserving comments and unrelated values', () => {
    const envText = '# Media Compass\nAPP_BASE_URL=http://localhost:3001\nTELEGRAM_BOT_TOKEN=fake-bot-token\n\nFRONTEND_ORIGIN=http://localhost:5173\n'

    expect(updateEnvText(envText, {
      APP_BASE_URL: 'https://api.trycloudflare.com',
      FRONTEND_ORIGIN: 'https://web.trycloudflare.com',
    })).toBe('# Media Compass\nAPP_BASE_URL=https://api.trycloudflare.com\nTELEGRAM_BOT_TOKEN=fake-bot-token\n\nFRONTEND_ORIGIN=https://web.trycloudflare.com\n')
  })

  it('appends missing env keys and keeps a trailing newline', () => {
    expect(updateEnvText('TELEGRAM_BOT_TOKEN=fake-bot-token', {
      APP_BASE_URL: 'https://api.trycloudflare.com',
      VITE_API_BASE_URL: 'https://api.trycloudflare.com',
    })).toBe('TELEGRAM_BOT_TOKEN=fake-bot-token\nAPP_BASE_URL=https://api.trycloudflare.com\nVITE_API_BASE_URL=https://api.trycloudflare.com\n')
  })

  it('quotes env values that contain whitespace or comment characters', () => {
    expect(updateEnvText('', { EXAMPLE: 'value with # hash' })).toBe('EXAMPLE="value with # hash"\n')
  })

  it('throws a clear error listing missing required env values', () => {
    expect(() => assertRequiredEnv({ TELEGRAM_BOT_TOKEN: '   ' }, [
      'TELEGRAM_BOT_TOKEN',
      'TELEGRAM_WEBHOOK_SECRET',
    ])).toThrow('Missing required .env values: TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET')
  })

  it('returns trimmed required env values', () => {
    expect(assertRequiredEnv({ TELEGRAM_BOT_TOKEN: ' fake-bot-token ' }, ['TELEGRAM_BOT_TOKEN'])).toEqual({
      TELEGRAM_BOT_TOKEN: 'fake-bot-token',
    })
  })

  it('builds frontend process env with the tunnel API URL', () => {
    expect(buildFrontendEnv({ NODE_ENV: 'development', VITE_API_BASE_URL: 'http://localhost:3001' }, 'https://api.trycloudflare.com')).toMatchObject({
      NODE_ENV: 'development',
      VITE_API_BASE_URL: 'https://api.trycloudflare.com',
    })
  })
})
