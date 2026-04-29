import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'

type Category = 'Movie' | 'TV' | 'Book' | 'Game'
type Status = 'Curious' | 'Shortlist' | 'In progress' | 'Done'

type MediaItem = {
  id: number
  title: string
  category: Category
  mood: string[]
  reason: string
  status: Status
}

const seedItems: MediaItem[] = [
  {
    id: 1,
    title: 'Arrival',
    category: 'Movie',
    mood: ['thoughtful', 'sci-fi', 'quiet'],
    reason: 'Smart, emotional sci-fi that rewards actually paying attention.',
    status: 'Shortlist',
  },
  {
    id: 2,
    title: 'Severance',
    category: 'TV',
    mood: ['weird', 'mystery', 'prestige'],
    reason: 'For when you want a puzzle box instead of another doomscroll box.',
    status: 'Curious',
  },
  {
    id: 3,
    title: 'Project Hail Mary',
    category: 'Book',
    mood: ['fun', 'science', 'page-turner'],
    reason: 'Competence porn in space. Very legal, very cool.',
    status: 'Curious',
  },
  {
    id: 4,
    title: 'Outer Wilds',
    category: 'Game',
    mood: ['exploration', 'mystery', 'wonder'],
    reason: 'Best if you know almost nothing and let curiosity drive.',
    status: 'Shortlist',
  },
]

const categories: Category[] = ['Movie', 'TV', 'Book', 'Game']
const statuses: Status[] = ['Curious', 'Shortlist', 'In progress', 'Done']

function parseMood(input: string) {
  return input
    .split(',')
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean)
}

function App() {
  const [items, setItems] = useState<MediaItem[]>(seedItems)
  const [category, setCategory] = useState<Category | 'Any'>('Any')
  const [mood, setMood] = useState('')
  const [pick, setPick] = useState<MediaItem | null>(null)

  const filteredItems = useMemo(() => {
    const moodNeedles = parseMood(mood)

    return items.filter((item) => {
      const categoryMatch = category === 'Any' || item.category === category
      const moodMatch =
        moodNeedles.length === 0 ||
        moodNeedles.every((needle) =>
          item.mood.some((tag) => tag.includes(needle)) ||
          item.reason.toLowerCase().includes(needle),
        )
      return categoryMatch && moodMatch && item.status !== 'Done'
    })
  }, [category, items, mood])

  function chooseOne() {
    if (filteredItems.length === 0) {
      setPick(null)
      return
    }

    const index = Math.floor(Math.random() * filteredItems.length)
    setPick(filteredItems[index])
  }

  function addItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const title = String(form.get('title') || '').trim()
    const reason = String(form.get('reason') || '').trim()
    const newCategory = String(form.get('category')) as Category
    const newMood = parseMood(String(form.get('mood') || ''))

    if (!title) return

    setItems((current) => [
      {
        id: Date.now(),
        title,
        category: newCategory,
        mood: newMood.length ? newMood : ['unsorted'],
        reason: reason || 'Added because it caught your attention.',
        status: 'Curious',
      },
      ...current,
    ])
    event.currentTarget.reset()
  }

  function updateStatus(id: number, status: Status) {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, status } : item)),
    )
    setPick((current) => (current?.id === id ? { ...current, status } : current))
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
          <span>{filteredItems.length} playable options match</span>
        </div>
      </section>

      <section className="chooser panel">
        <div>
          <label htmlFor="category">Category</label>
          <select
            id="category"
            value={category}
            onChange={(event) => setCategory(event.target.value as Category | 'Any')}
          >
            <option>Any</option>
            {categories.map((name) => <option key={name}>{name}</option>)}
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
          <h2>{pick.title}</h2>
          <p>{pick.reason}</p>
          <div className="chips">
            <span>{pick.category}</span>
            {pick.mood.map((tag) => <span key={tag}>{tag}</span>)}
          </div>
          <div className="status-row">
            {statuses.map((status) => (
              <button
                key={status}
                type="button"
                className={pick.status === status ? 'active' : ''}
                onClick={() => updateStatus(pick.id, status)}
              >
                {status}
              </button>
            ))}
          </div>
        </section>
      ) : (
        <section className="empty panel">
          No matching options. Your taste filter has become too powerful.
        </section>
      )}

      <section className="grid">
        <form className="panel add-form" onSubmit={addItem}>
          <h2>Quick capture</h2>
          <input name="title" placeholder="Title" />
          <select name="category" defaultValue="Movie">
            {categories.map((name) => <option key={name}>{name}</option>)}
          </select>
          <input name="mood" placeholder="Tags: funny, short, intense" />
          <textarea name="reason" placeholder="Why did this catch your eye?" />
          <button type="submit">Add to queue</button>
        </form>

        <section className="panel queue">
          <h2>Queue</h2>
          {items.map((item) => (
            <article key={item.id}>
              <div>
                <strong>{item.title}</strong>
                <p>{item.category} · {item.status}</p>
              </div>
              <div className="chips">
                {item.mood.slice(0, 3).map((tag) => <span key={tag}>{tag}</span>)}
              </div>
            </article>
          ))}
        </section>
      </section>
    </main>
  )
}

export default App
