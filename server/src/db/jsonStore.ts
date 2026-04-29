import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { MediaItem } from '../../../src/lib/types'
import { makeIngestEvent, makeItem, makeSourceArtifact } from './memoryStore'
import type {
  CreateIngestEventInput,
  CreateMediaItemInput,
  CreateSourceArtifactInput,
  DataSnapshot,
  MediaCompassStore,
  UpdateMediaItemInput,
} from './types'

const defaultUserId = '00000000-0000-4000-8000-000000000001'

function defaultSnapshot(): DataSnapshot {
  return {
    schemaVersion: 1,
    users: [
      {
        id: defaultUserId,
        displayName: 'Arian',
        createdAt: new Date().toISOString(),
      },
    ],
    mediaItems: [],
    sourceArtifacts: [],
    ingestEvents: [],
    enrichmentJobs: [],
    clarificationRequests: [],
    pickerEvents: [],
  }
}

async function readSnapshot(path: string): Promise<DataSnapshot> {
  try {
    const raw = await readFile(path, 'utf8')
    const parsed = JSON.parse(raw) as DataSnapshot
    return { ...defaultSnapshot(), ...parsed, schemaVersion: 1 }
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return defaultSnapshot()
    }
    throw error
  }
}

async function writeSnapshot(path: string, snapshot: DataSnapshot) {
  await mkdir(dirname(path), { recursive: true })
  const tempPath = `${path}.${process.pid}.${crypto.randomUUID()}.tmp`
  await writeFile(tempPath, `${JSON.stringify(snapshot, null, 2)}\n`)
  await rename(tempPath, path)
}

function nextTimestamp(previous?: string) {
  const now = new Date()
  if (!previous) return now.toISOString()

  const previousMs = Date.parse(previous)
  if (Number.isFinite(previousMs) && now.getTime() <= previousMs) {
    return new Date(previousMs + 1).toISOString()
  }

  return now.toISOString()
}

export class JsonMediaCompassStore implements MediaCompassStore {
  private readonly path: string
  private operationQueue: Promise<unknown> = Promise.resolve()

  constructor(path: string) {
    this.path = path
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const run = this.operationQueue.then(operation, operation)
    this.operationQueue = run.catch(() => undefined)
    return run
  }

  private async updateSnapshot(mutator: (snapshot: DataSnapshot) => DataSnapshot | void) {
    const snapshot = await readSnapshot(this.path)
    const next = mutator(snapshot) ?? snapshot
    await writeSnapshot(this.path, next)
    return next
  }

  async listMediaItems() {
    return this.enqueue(async () => {
      const snapshot = await readSnapshot(this.path)
      await writeSnapshot(this.path, snapshot)
      return [...snapshot.mediaItems]
    })
  }

  async createMediaItem(input: CreateMediaItemInput) {
    return this.enqueue(async () => {
      const item = makeItem(input)
      await this.updateSnapshot((snapshot) => {
        snapshot.mediaItems = [item, ...snapshot.mediaItems]
      })
      return item
    })
  }

  async updateMediaItem(id: string, input: UpdateMediaItemInput) {
    return this.enqueue(async () => {
      let updated: MediaItem | null = null
      await this.updateSnapshot((snapshot) => {
        snapshot.mediaItems = snapshot.mediaItems.map((item) => {
          if (item.id !== id) return item
          updated = { ...item, ...input, updatedAt: nextTimestamp(item.updatedAt) }
          if (input.status === 'done') updated.completedAt = updated.updatedAt
          return updated
        })
      })
      return updated
    })
  }

  async archiveMediaItem(id: string) {
    return this.updateMediaItem(id, { status: 'archived' })
  }

  async listIngestEvents() {
    return this.enqueue(async () => {
      const snapshot = await readSnapshot(this.path)
      await writeSnapshot(this.path, snapshot)
      return [...snapshot.ingestEvents]
    })
  }

  async createIngestEvent(input: CreateIngestEventInput) {
    return this.enqueue(async () => {
      const event = makeIngestEvent(input)
      await this.updateSnapshot((snapshot) => {
        snapshot.ingestEvents = [event, ...snapshot.ingestEvents]
      })
      return event
    })
  }

  async listSourceArtifacts() {
    return this.enqueue(async () => {
      const snapshot = await readSnapshot(this.path)
      await writeSnapshot(this.path, snapshot)
      return [...snapshot.sourceArtifacts]
    })
  }

  async createSourceArtifact(input: CreateSourceArtifactInput) {
    return this.enqueue(async () => {
      const artifact = makeSourceArtifact(input)
      await this.updateSnapshot((snapshot) => {
        snapshot.sourceArtifacts = [artifact, ...snapshot.sourceArtifacts]
      })
      return artifact
    })
  }
}
