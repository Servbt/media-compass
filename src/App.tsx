import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'
import { createMediaCompassApi } from './lib/api'
import { getEligibleItems, pickMedia } from './lib/picker'
import { loadItems, parseImportedItems, saveItems, serializeItems } from './lib/storage'
import type { MediaCategory, MediaItem, MediaStatus } from './lib/types'

const categories: MediaCategory[] = ['movie', 'tv', 'book', 'game', 'other']
const activeStatuses: MediaStatus[] = ['curious', 'shortlist', 'in_progress', 'done']
const apiClient = createMediaCompassApi(import.meta.env.VITE_API_BASE_URL, import.meta.env.VITE_API_TOKEN)

function parseTags(input: string) {
  return input
    .split(',')
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean)
}

function titleCase(value: string) {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function nowIso() {
  return new Date().toISOString()
}

function makeManualItem(title: string, category: MediaCategory, moods: string[], reason: string): MediaItem {
  const timestamp = nowIso()
  return {
    id: crypto.randomUUID(),
    canonicalTitle: title,
    category,
    moods: moods.length ? moods : ['unsorted'],
    themes: [],
    reason: reason || 'Added because it caught your attention.',
    status: 'curious',
    priority: 3,
    needsReview: false,
    sourceArtifacts: [
      {
        id: crypto.randomUUID(),
        type: 'text',
        contentText: title,
        createdAt: timestamp,
      },
    ],
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

function App() {
  const [items, setItems] = useState<MediaItem[]>(() => loadItems())
  const [category, setCategory] = useState<MediaCategory | 'any'>('any')
  const [mood, setMood] = useState('')
  const [pick, setPick] = useState<MediaItem | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [storageMode, setStorageMode] = useState<'api' | 'local'>(() => (apiClient ? 'api' : 'local'))
  const importInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let cancelled = false
    if (!apiClient || storageMode !== 'api') return

    apiClient.listItems()
      .then((remoteItems) => {
        if (!cancelled) setItems(remoteItems)
      })
      .catch((error) => {
        console.warn('API load failed; switching to local media queue.', error)
        setStorageMode('local')
      })

    return () => {
      cancelled = true
    }
  }, [storageMode])

  useEffect(() => {
    if (storageMode === 'local') saveItems(items)
  }, [items, storageMode])

  const reviewItems = useMemo(
    () => items.filter((item) => item.status === 'inbox' || item.needsReview),
    [items],
  )
  const queueItems = useMemo(
    () => items.filter((item) => item.status !== 'inbox' && !item.needsReview),
    [items],
  )
  const eligibleItems = useMemo(
    () => getEligibleItems(items, { category, mood }),
    [category, items, mood],
  )

  function chooseOne() {
    const result = pickMedia(items, { category, mood })
    setPick(result.primary)
  }

  function addItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const title = String(form.get('title') || '').trim()
    const reason = String(form.get('reason') || '').trim()
    const newCategory = String(form.get('category')) as MediaCategory
    const newMood = parseTags(String(form.get('mood') || ''))

    if (!title) return

    const localItem = makeManualItem(title, newCategory, newMood, reason)
    setItems((current) => [localItem, ...current])
    event.currentTarget.reset()

    if (apiClient && storageMode === 'api') {
      apiClient.createItem({
        canonicalTitle: title,
        category: newCategory,
        moods: newMood.length ? newMood : ['unsorted'],
        themes: [],
        reason: localItem.reason,
        status: 'curious',
        priority: 3,
        needsReview: false,
        sourceArtifacts: localItem.sourceArtifacts,
      })
        .then((created) => {
          setItems((current) => current.map((item) => (item.id === localItem.id ? created : item)))
        })
        .catch((error) => {
          console.warn('API create failed; switching to local persistence for optimistic item.', error)
          setStorageMode('local')
        })
    }
  }

  function updateStatus(id: string, status: MediaStatus) {
    const timestamp = nowIso()
    setItems((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              status,
              completedAt: status === 'done' ? timestamp : item.completedAt,
              updatedAt: timestamp,
            }
          : item,
      ),
    )
    setPick((current) =>
      current?.id === id
        ? {
            ...current,
            status,
            completedAt: status === 'done' ? timestamp : current.completedAt,
            updatedAt: timestamp,
          }
        : current,
    )
    if (apiClient && storageMode === 'api') {
      apiClient.updateItem(id, { status })
        .then((updated) => {
          setItems((current) => current.map((item) => (item.id === id ? updated : item)))
          setPick((current) => (current?.id === id ? updated : current))
        })
        .catch((error) => {
          console.warn('API status update failed; switching to local persistence.', error)
          setStorageMode('local')
        })
    }
  }

  function resolveReviewItem(id: string, status: MediaStatus) {
    const timestamp = nowIso()
    setItems((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              status,
              needsReview: false,
              updatedAt: timestamp,
            }
          : item,
      ),
    )
    if (apiClient && storageMode === 'api') {
      apiClient.updateItem(id, { status, needsReview: false })
        .then((updated) => {
          setItems((current) => current.map((item) => (item.id === id ? updated : item)))
        })
        .catch((error) => {
          console.warn('API review resolution failed; switching to local persistence.', error)
          setStorageMode('local')
        })
    }
  }

  function rejectReviewItem(id: string) {
    resolveReviewItem(id, 'rejected')
  }

  function exportItems() {
    const blob = new Blob([serializeItems(items)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `media-compass-${new Date().toISOString().slice(0, 10)}.json`
    anchor.style.display = 'none'
    document.body.append(anchor)
    anchor.click()
    anchor.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
  }

  async function importItems(event: FormEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]
    if (!file) return

    try {
      setImportError(null)
      const imported = parseImportedItems(await file.text())
      setItems(imported)
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Import failed.')
    } finally {
      if (importInputRef.current) importInputRef.current.value = ''
    }
  }

  return (
    <main className="shell">
      <section className="hero-card">
        <p className="eyebrow">Media Compass</p>
        <h1>Stop scrolling. Pick the damn thing.</h1>
        <p className="lede">
          A tiny decision engine for movies, TV, books, and games — built around
          capture, annotation, mood filters, and a hard nudge toward choosing.
        </p>
        <div className="actions">
          <button type="button" onClick={chooseOne}>Pick for me</button>
          <span>{eligibleItems.length} trusted options match</span>
        </div>
      </section>

      <section className="chooser panel" aria-label="Picker filters">
        <div>
          <label htmlFor="category-filter">Category filter</label>
          <select
            id="category-filter"
            value={category}
            onChange={(event) => setCategory(event.target.value as MediaCategory | 'any')}
          >
            <option value="any">Any</option>
            {categories.map((name) => <option key={name} value={name}>{titleCase(name)}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="mood">Mood / tags</label>
          <input
            id="mood"
            placeholder="quiet, weird, cozy..."
            value={mood}
            onChange={(event) => setMood(event.target.value)}
          />
        </div>
      </section>

      {pick ? (
        <section className="pick-card">
          <p className="eyebrow">Tonight's assignment</p>
          <h2>{pick.canonicalTitle}</h2>
          <p>{pick.reason}</p>
          <div className="chips">
            <span>{titleCase(pick.category)}</span>
            {pick.moods.map((tag) => <span key={tag}>{tag}</span>)}
          </div>
          <div className="status-row">
            {activeStatuses.map((status) => (
              <button
                key={status}
                type="button"
                className={pick.status === status ? 'active' : ''}
                onClick={() => updateStatus(pick.id, status)}
              >
                {titleCase(status)}
              </button>
            ))}
          </div>
        </section>
      ) : (
        <section className="empty panel">
          No matching options. Your taste filter has become too powerful.
        </section>
      )}

      <section className="panel review-inbox" aria-label="Review Inbox">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Agent capture</p>
            <h2>Review Inbox</h2>
          </div>
          <span>{reviewItems.length} unresolved</span>
        </div>
        {reviewItems.length === 0 ? (
          <p className="muted">No ambiguous captures. Suspiciously tidy.</p>
        ) : reviewItems.map((item) => (
          <article key={item.id}>
            <div>
              <strong>{item.canonicalTitle}</strong>
              <p>{titleCase(item.category)} · {item.reason}</p>
              {item.agentConfidence ? <p>{Math.round(item.agentConfidence * 100)}% confidence</p> : null}
            </div>
            <div className="review-actions">
              <button type="button" onClick={() => resolveReviewItem(item.id, 'curious')}>Approve</button>
              <button type="button" onClick={() => resolveReviewItem(item.id, 'shortlist')}>Shortlist</button>
              <button type="button" onClick={() => rejectReviewItem(item.id)}>Reject</button>
            </div>
          </article>
        ))}
      </section>

      <section className="grid">
        <form className="panel add-form" onSubmit={addItem}>
          <h2>Quick capture</h2>
          <label className="sr-only" htmlFor="manual-title">Title</label>
          <input id="manual-title" name="title" placeholder="Title" />
          <label className="sr-only" htmlFor="manual-category">Category</label>
          <select id="manual-category" name="category" defaultValue="movie">
            {categories.map((name) => <option key={name} value={name}>{titleCase(name)}</option>)}
          </select>
          <label className="sr-only" htmlFor="manual-tags">Tags</label>
          <input id="manual-tags" name="mood" placeholder="Tags: funny, short, intense" />
          <label className="sr-only" htmlFor="manual-reason">Reason</label>
          <textarea id="manual-reason" name="reason" placeholder="Why did this catch your eye?" />
          <button type="submit">Add to queue</button>
        </form>

        <section className="panel queue">
          <div className="section-heading">
            <h2>Queue</h2>
            <div className="file-actions">
              <button type="button" onClick={exportItems}>Export JSON</button>
              <button type="button" onClick={() => importInputRef.current?.click()}>Import JSON</button>
              <input
                ref={importInputRef}
                type="file"
                accept="application/json"
                onChange={importItems}
                className="hidden-input"
                aria-label="Import JSON file"
              />
            </div>
          </div>
          {importError ? <p className="error">{importError}</p> : null}
          {queueItems.map((item) => (
            <article key={item.id}>
              <div>
                <strong>{item.canonicalTitle}</strong>
                <p>{titleCase(item.category)} · {titleCase(item.status)}</p>
              </div>
              <div className="chips">
                {item.moods.slice(0, 3).map((tag) => <span key={tag}>{tag}</span>)}
              </div>
            </article>
          ))}
        </section>
      </section>
    </main>
  )
}

export default App
