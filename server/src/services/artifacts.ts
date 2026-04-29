import type { SourceArtifact } from '../../../src/lib/types'

type TelegramEntity = {
  type?: string
  offset?: number
  length?: number
  url?: string
}

type TelegramPhotoSize = {
  file_id?: string
  file_unique_id?: string
  width?: number
  height?: number
  file_size?: number
}

type TelegramFileLike = {
  file_id?: string
  file_unique_id?: string
  file_name?: string
  mime_type?: string
  file_size?: number
  duration?: number
}

type TelegramMessage = {
  text?: string
  caption?: string
  entities?: TelegramEntity[]
  caption_entities?: TelegramEntity[]
  photo?: TelegramPhotoSize[]
  document?: TelegramFileLike
  audio?: TelegramFileLike
  forward_from?: unknown
  forward_from_chat?: unknown
  forward_sender_name?: string
  forward_date?: number
}

type ArtifactDraft = Omit<SourceArtifact, 'id' | 'createdAt'>

const rawUrlPattern = /https?:\/\/[^\s<>()]+/gi

export function extractTelegramText(message?: TelegramMessage) {
  return message?.text ?? message?.caption ?? ''
}

export function extractTelegramUrls(message?: TelegramMessage) {
  if (!message) return []
  const text = extractTelegramText(message)
  const urls = new Set<string>()
  for (const entity of [...(message.entities ?? []), ...(message.caption_entities ?? [])]) {
    if (entity.type === 'text_link' && entity.url) {
      urls.add(entity.url)
      continue
    }
    if (entity.type === 'url' && typeof entity.offset === 'number' && typeof entity.length === 'number') {
      urls.add(text.slice(entity.offset, entity.offset + entity.length))
    }
  }

  for (const match of text.matchAll(rawUrlPattern)) {
    urls.add(match[0].replace(/[),.;!?]+$/, ''))
  }

  return [...urls]
}

function forwardMetadata(message: TelegramMessage) {
  const metadata: Record<string, unknown> = {}
  if (message.forward_from) metadata.forwardFrom = message.forward_from
  if (message.forward_from_chat) metadata.forwardFromChat = message.forward_from_chat
  if (message.forward_sender_name) metadata.forwardSenderName = message.forward_sender_name
  if (message.forward_date) metadata.forwardDate = message.forward_date
  return Object.keys(metadata).length ? metadata : undefined
}

export function extractTelegramArtifacts(message?: TelegramMessage): ArtifactDraft[] {
  if (!message) return []
  const text = extractTelegramText(message).trim()
  const urls = extractTelegramUrls(message)
  const artifacts: ArtifactDraft[] = []
  const forwarded = forwardMetadata(message)

  if (text) {
    artifacts.push({
      type: 'text',
      contentText: text,
      metadata: forwarded,
    })
  }

  for (const url of urls) {
    artifacts.push({
      type: 'url',
      url,
      metadata: forwarded,
    })
  }

  if (message.photo?.length) {
    const largestPhoto = [...message.photo].sort((left, right) => (right.file_size ?? 0) - (left.file_size ?? 0))[0]
    artifacts.push({
      type: 'image',
      metadata: { ...forwarded, telegram: { kind: 'photo', ...largestPhoto } },
    })
  }

  if (message.document?.file_id) {
    artifacts.push({
      type: 'file',
      metadata: { ...forwarded, telegram: { kind: 'document', ...message.document } },
    })
  }

  if (message.audio?.file_id) {
    artifacts.push({
      type: 'audio',
      metadata: { ...forwarded, telegram: { kind: 'audio', ...message.audio } },
    })
  }

  return artifacts
}
