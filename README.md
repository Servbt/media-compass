# Media Compass

A personal media queue and decision engine for movies, TV shows, books, and video games.

The core problem: finding more things to watch/read/play is easy. Actually choosing one is weirdly hard. Media Compass captures recommendations and passing interests, annotates why they matter, and then forces a useful decision based on category and mood.

## Opinionated take

This should not become another giant tracking database. Letterboxd, Trakt, StoryGraph, Backloggd, and Likewise already cover pieces of logging, discovery, and recommendation. The useful wedge here is narrower:

- **Capture anything fast** from chat, links, screenshots, or notes.
- **Annotate the intent**: why it caught your eye, mood fit, friction level, runtime/commitment.
- **Reduce choice**, not expand it. The app should end in a small shortlist or one assignment.
- **Close the loop**: after finishing something, record whether it was worth it so future picks improve.

## Categories

- Movies
- TV shows
- Books
- Video games

## MVP

- Add an item with title, category, tags/mood, and reason.
- Filter by category and mood.
- Randomly pick one unfinished item.
- Move items through `Curious`, `Shortlist`, `In progress`, and `Done`.

This repo currently contains:

- a Vite + React prototype with localStorage fallback,
- a Review Inbox for ambiguous captures,
- a minimal Node/Fastify API server,
- a file-backed local data store for development,
- a Postgres/Supabase migration for the real capture pipeline tables.

## Product direction

The important next step is the capture-agent loop. See:

- [`docs/architecture.md`](docs/architecture.md) — system architecture for bot/share ingestion, enrichment, review, and compass picking.
- [`docs/capture-agent-plan.md`](docs/capture-agent-plan.md) — implementation plan for turning shared links/images/social posts/vague references into annotated queue items.

### Capture flow

1. User sends a title, link, screenshot, trailer, TikTok, tweet, Steam page, Goodreads page, etc. to an agent.
2. Agent identifies the IP/media object.
3. Agent normalizes metadata:
   - title
   - category
   - creator/director/author/studio when available
   - release year
   - length/commitment estimate
   - where to watch/read/play if available
4. Agent adds a short annotation:
   - why Arian might like it
   - what mood it fits
   - what could make it a bad pick tonight
5. App stores it in the queue.

### Decision flow

1. User opens the app or asks the bot: "pick something cozy", "movie under 2 hours", "game but not exhausting".
2. App filters by hard constraints.
3. App shows one primary pick plus up to two alternates.
4. User accepts, rejects, or defers.
5. App learns from the outcome.

## Suggested data model

```ts
type MediaCategory = 'movie' | 'tv' | 'book' | 'game'
type MediaStatus = 'curious' | 'shortlist' | 'in_progress' | 'done' | 'rejected'

type MediaItem = {
  id: string
  title: string
  category: MediaCategory
  status: MediaStatus
  sourceUrl?: string
  year?: number
  creator?: string
  commitmentMinutes?: number
  moods: string[]
  tags: string[]
  reason: string
  antiReason?: string
  priority?: 1 | 2 | 3 | 4 | 5
  createdAt: string
  updatedAt: string
}
```

## Tech stack

- React + TypeScript + Vite for the web app.
- Future backend: Supabase or SQLite/Turso. Start boring; novelty is not a feature.
- Future bot ingestion: Telegram first because that is already how the idea naturally arrives.
- Future metadata APIs:
  - TMDB for movies/TV
  - Open Library or Google Books for books
  - IGDB or RAWG for games

## Local development

Web app only, using localStorage fallback:

```bash
npm install
npm run dev
```

API server only, using `.data/media-compass.json`:

```bash
cp .env.example .env
npm run dev:server
curl http://localhost:3001/healthz
```

Web app backed by the API:

```bash
# terminal 1
npm run dev:server

# terminal 2
VITE_API_BASE_URL=http://localhost:3001 npm run dev
```

Postgres/Supabase schema migration:

```bash
DATABASE_URL=postgres://... npm run migrate:server
```

## Checks

```bash
npm test
npm run lint
npm run build
npm run build:server
```
