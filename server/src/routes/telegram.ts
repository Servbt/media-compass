import type { FastifyInstance, FastifyRequest } from 'fastify'
import type { MediaCompassStore } from '../db/types'
import { extractTelegramArtifacts, extractTelegramText } from '../services/artifacts'
import { createInboxDraftFromTelegram } from '../services/basicExtraction'
import type { TelegramClient } from '../services/telegram'

export type RegisterTelegramRoutesOptions = {
  store: MediaCompassStore
  webhookSecret?: string
  allowedUserId?: string
  botToken?: string
  telegramClient?: TelegramClient
}

type TelegramUser = {
  id?: number | string
}

type TelegramChat = {
  id?: number | string
}

type TelegramMessage = {
  message_id?: number | string
  from?: TelegramUser
  chat?: TelegramChat
  text?: string
  caption?: string
}

type TelegramUpdate = {
  update_id?: number | string
  message?: TelegramMessage
  edited_message?: TelegramMessage
  channel_post?: TelegramMessage
}

function configured(value?: string) {
  return typeof value === 'string' && value.length > 0
}

function getSecretHeader(request: FastifyRequest) {
  const header = request.headers['x-telegram-bot-api-secret-token']
  return Array.isArray(header) ? header[0] : header
}

function getMessage(update: TelegramUpdate) {
  return update.message ?? update.edited_message ?? update.channel_post
}

function getTelegramUserId(message?: TelegramMessage) {
  if (message?.from?.id === undefined || message.from.id === null) return undefined
  return String(message.from.id)
}

function getChatId(message?: TelegramMessage) {
  return message?.chat?.id
}

function getChannelMessageId(message?: TelegramMessage, update?: TelegramUpdate) {
  if (message?.message_id !== undefined && message.message_id !== null) return String(message.message_id)
  if (update?.update_id !== undefined && update.update_id !== null) return String(update.update_id)
  return undefined
}

export async function registerTelegramRoutes(app: FastifyInstance, options: RegisterTelegramRoutesOptions) {
  app.post('/api/webhooks/telegram', async (request, reply) => {
    if (configured(options.webhookSecret) && getSecretHeader(request) !== options.webhookSecret) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }

    const update = (request.body ?? {}) as TelegramUpdate
    const message = getMessage(update)
    const telegramUserId = getTelegramUserId(message)
    if (configured(options.allowedUserId) && telegramUserId !== options.allowedUserId) {
      return reply.status(403).send({ error: 'Forbidden' })
    }

    const rawText = extractTelegramText(message).trim() || undefined
    const ingestEvent = await options.store.createIngestEvent({
      channel: 'telegram',
      channelMessageId: getChannelMessageId(message, update),
      rawText,
      rawPayload: update as Record<string, unknown>,
      state: 'completed',
      processedAt: new Date().toISOString(),
    })

    const artifactDrafts = extractTelegramArtifacts(message)
    const artifacts = []
    for (const artifact of artifactDrafts) {
      artifacts.push(await options.store.createSourceArtifact({
        ...artifact,
        userId: ingestEvent.userId,
        ingestEventId: ingestEvent.id,
      }))
    }

    await options.store.createMediaItem(createInboxDraftFromTelegram(message, artifacts))

    const chatId = getChatId(message)
    if (options.botToken && options.telegramClient && chatId !== undefined) {
      void options.telegramClient.sendMessage(chatId, "Saved to inbox. I'll annotate it now.").catch((error: unknown) => {
        request.log.warn({ error }, 'Telegram sendMessage failed')
      })
    }

    return { ok: true }
  })
}
