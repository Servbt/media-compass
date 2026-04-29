import type { CreateMediaItemInput } from '../db/types'
import { extractTelegramUrls } from './artifacts'

type TelegramMessage = Parameters<typeof extractTelegramUrls>[0]

function firstLine(text: string) {
  return text.split(/\r?\n/).map((line) => line.trim()).find(Boolean)
}

function titleFromUrl(url: string) {
  try {
    return new URL(url).hostname || url
  } catch {
    return url
  }
}

export function createInboxDraftFromTelegram(message: TelegramMessage, sourceArtifacts: CreateMediaItemInput['sourceArtifacts']): CreateMediaItemInput {
  const rawText = message?.text ?? message?.caption ?? ''
  const urls = extractTelegramUrls(message)
  const sourceUrl = urls[0]
  const line = firstLine(rawText)
  const canonicalTitle = sourceUrl ? titleFromUrl(sourceUrl) : (line ?? 'Telegram capture')

  return {
    canonicalTitle,
    category: 'other',
    status: 'inbox',
    needsReview: true,
    reason: 'Captured from Telegram; needs review.',
    sourceUrl,
    sourceArtifacts,
  }
}
