// @vitest-environment node
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { JsonMediaCompassStore } from './jsonStore'

const tempDirs: string[] = []

async function makeStore() {
  const dir = await mkdtemp(join(tmpdir(), 'media-compass-store-'))
  tempDirs.push(dir)
  return {
    dir,
    path: join(dir, 'data.json'),
    store: new JsonMediaCompassStore(join(dir, 'data.json')),
  }
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('JsonMediaCompassStore', () => {
  it('creates durable item records that survive a new store instance', async () => {
    const { path, store } = await makeStore()

    const created = await store.createMediaItem({
      canonicalTitle: 'Station Eleven',
      category: 'book',
      moods: ['hopeful'],
      themes: ['post-apocalypse'],
      reason: 'Recommended as thoughtful survival fiction.',
    })

    expect(created.id).toEqual(expect.any(String))
    expect(created.status).toBe('inbox')
    expect(created.needsReview).toBe(true)

    const reloaded = new JsonMediaCompassStore(path)
    await expect(reloaded.listMediaItems()).resolves.toEqual([created])
  })

  it('updates item status, timestamps, and archives without deleting data', async () => {
    const { store } = await makeStore()
    const created = await store.createMediaItem({ canonicalTitle: 'Outer Wilds', category: 'game' })

    const patched = await store.updateMediaItem(created.id, { status: 'shortlist', needsReview: false })
    expect(patched?.status).toBe('shortlist')
    expect(patched?.needsReview).toBe(false)
    expect(patched?.updatedAt).not.toBe(created.updatedAt)

    const archived = await store.archiveMediaItem(created.id)
    expect(archived?.status).toBe('archived')
    await expect(store.listMediaItems()).resolves.toHaveLength(1)
  })

  it('keeps concurrent creates instead of clobbering the JSON file', async () => {
    const { store } = await makeStore()

    await Promise.all(Array.from({ length: 25 }, (_, index) => store.createMediaItem({
      canonicalTitle: `Item ${index}`,
      category: 'other',
    })))

    await expect(store.listMediaItems()).resolves.toHaveLength(25)
  })

  it('initializes the capture pipeline tables in the snapshot', async () => {
    const { path, store } = await makeStore()
    await store.listMediaItems()

    const snapshot = JSON.parse(await readFile(path, 'utf8'))
    expect(Object.keys(snapshot).sort()).toEqual([
      'clarificationRequests',
      'enrichmentJobs',
      'ingestEvents',
      'mediaItems',
      'pickerEvents',
      'schemaVersion',
      'sourceArtifacts',
      'users',
    ])
    expect(snapshot.users).toHaveLength(1)
  })
})
