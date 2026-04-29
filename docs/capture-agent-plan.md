# Capture Agent Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Make Media Compass primarily a share-to-agent capture system: Arian sends a link, screenshot, social post, voice note, or vague reference to a bot; the agent identifies and annotates the media item; the app stores it for review and compass/random picking.

**Architecture:** Build this as a capture pipeline, not a chat gimmick. Every inbound thing becomes a durable raw artifact first, then an async enrichment job turns it into a structured media item with provenance, confidence, and optional clarification. The web app remains the review/queue/compass surface.

**Tech Stack:** Existing Vite React TypeScript app; Node TypeScript backend; Postgres/Supabase; Telegram Bot API; provider adapters for OpenGraph/oEmbed, TMDB, Google Books/Open Library, RAWG/IGDB; LLM structured JSON extraction; optional OCR/vision later.

---

## Product principle

The north-star interaction is:

1. Arian finds something interesting anywhere.
2. Arian shares it to the bot with near-zero ceremony.
3. Bot says “saved” immediately.
4. Agent figures out what it probably is, why it might matter, what mood it fits, and how much confidence it has.
5. High-confidence items enter the queue automatically.
6. Ambiguous items go to Review or get one concise Telegram clarification.
7. Compass picker chooses from trusted queue items, not random unresolved internet sludge.

Do **not** make capture depend on perfect metadata. Raw capture is the product. Enrichment is gravy with receipts.

---

## Phase 0: Prepare the prototype for real data

### Task 0.1: Extract shared media types

**Objective:** Create reusable TypeScript types that match the future database model.

**Files:**
- Create: `src/lib/types.ts`
- Modify: `src/App.tsx`

**Implementation:**

Define:

```ts
export type MediaCategory = 'movie' | 'tv' | 'book' | 'game' | 'other'
export type MediaStatus = 'inbox' | 'curious' | 'shortlist' | 'in_progress' | 'done' | 'rejected' | 'archived'

export type SourceArtifact = {
  id: string
  type: 'url' | 'text' | 'image' | 'screenshot' | 'telegram_forward' | 'audio' | 'file'
  url?: string
  contentText?: string
  storagePath?: string
  metadata?: Record<string, unknown>
  createdAt: string
}

export type MediaItem = {
  id: string
  canonicalTitle: string
  originalTitle?: string
  category: MediaCategory
  status: MediaStatus
  priority: 1 | 2 | 3 | 4 | 5
  reason?: string
  summary?: string
  creator?: string
  releaseYear?: number
  durationMinutes?: number
  commitmentLevel?: 'snack' | 'evening' | 'weekend' | 'long_term'
  moods: string[]
  themes: string[]
  sourceUrl?: string
  posterUrl?: string
  externalIds?: Record<string, string | number>
  agentConfidence?: number
  confidenceReasons?: string[]
  needsReview: boolean
  sourceArtifacts: SourceArtifact[]
  createdAt: string
  updatedAt: string
  lastPickedAt?: string
  completedAt?: string
}
```

**Verification:**

```bash
npm run lint
npm run build
```

Expected: both pass.

### Task 0.2: Add localStorage persistence

**Objective:** Preserve the queue locally while backend work is pending.

**Files:**
- Modify: `src/App.tsx`
- Create: `src/lib/storage.ts`

**Implementation notes:**
- Store under key `media-compass.items.v1`.
- Validate shape enough to avoid crashing on old data.
- Seed sample items only when storage is empty.

**Verification:**
- Add item.
- Refresh browser.
- Item remains.
- `npm run build` passes.

### Task 0.3: Add Review Inbox UI state

**Objective:** Visually separate trusted queue items from ambiguous captures.

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.css`

**Implementation notes:**
- Show an “Inbox / Needs review” section for items with `status === 'inbox'` or `needsReview === true`.
- Compass picker must exclude inbox items by default.
- Add quick buttons: `Approve`, `Shortlist`, `Reject`.

**Verification:**
- Add a sample inbox item.
- Confirm it appears in Review, not eligible picker results.

---

## Phase 1: Add the backend shell

### Task 1.1: Create server TypeScript app

**Objective:** Add a minimal API server without disturbing the Vite app.

**Files:**
- Create: `server/package.json` or extend root package scripts
- Create: `server/src/index.ts`
- Create: `server/src/env.ts`
- Modify: root `package.json`

**Implementation notes:**
- Use Fastify or Express. Pick one; Fastify is clean, Express is boring. Boring is fine.
- Add scripts:
  - `dev:server`
  - `build:server`
  - `start:server`
- Add health endpoint: `GET /healthz` returns `{ ok: true }`.

**Verification:**

```bash
npm run build
npm run build:server
npm run dev:server
curl http://localhost:3001/healthz
```

Expected: `{ "ok": true }`.

### Task 1.2: Add database schema

**Objective:** Create durable storage for items, artifacts, ingest events, jobs, clarifications, and picker events.

**Files:**
- Create: `server/src/db/schema.ts`
- Create: `server/src/db/migrate.ts`
- Create: `server/migrations/0001_initial.sql`
- Create: `.env.example`

**Tables:**
- `users`
- `media_items`
- `source_artifacts`
- `ingest_events`
- `enrichment_jobs`
- `clarification_requests`
- `picker_events`

**Verification:**
- Run migration against local Postgres or Supabase dev DB.
- Confirm tables exist.

### Task 1.3: Add item CRUD API

**Objective:** Make the web app capable of reading/writing real items.

**Files:**
- Create: `server/src/routes/items.ts`
- Create: `src/lib/api.ts`
- Modify: `src/App.tsx`

**Endpoints:**
- `GET /api/items`
- `POST /api/items`
- `PATCH /api/items/:id`
- `POST /api/items/:id/archive`

**Verification:**
- Create item via API.
- See it in app.
- Edit status in app.
- Refresh and confirm persistence.

---

## Phase 2: Prove the capture loop with Telegram, no AI yet

### Task 2.1: Add Telegram webhook route

**Objective:** Accept inbound Telegram bot updates securely.

**Files:**
- Create: `server/src/routes/telegram.ts`
- Create: `server/src/services/telegram.ts`
- Modify: `server/src/index.ts`
- Modify: `.env.example`

**Environment variables:**

```bash
TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_SECRET=
TELEGRAM_ALLOWED_USER_ID=
APP_BASE_URL=
```

**Security rules:**
- Verify Telegram secret header if using `setWebhook` secret token.
- Reject messages from non-allowlisted Telegram user IDs.
- Store raw payload before attempting enrichment.

**Verification:**
- Send a text message to bot.
- Confirm `ingest_events` row exists.
- Bot replies quickly: “Saved to inbox. I’ll annotate it now.”

### Task 2.2: Store source artifacts

**Objective:** Preserve the original thing Arian sent.

**Files:**
- Create: `server/src/services/artifacts.ts`
- Modify: `server/src/routes/telegram.ts`

**Implementation notes:**
- Text message: create `source_artifacts` type `text`.
- URL entity: create `source_artifacts` type `url`.
- Photo/document/audio: store Telegram `file_id`; download later in a separate task.
- Forwarded message: preserve forward metadata in `metadata`.

**Verification:**
- Send plain text, URL, forwarded post, and image.
- Confirm each creates an `ingest_event` and one or more `source_artifacts`.

### Task 2.3: Create basic inbox draft items

**Objective:** Make every capture visible in the app before sophisticated enrichment exists.

**Files:**
- Create: `server/src/services/basicExtraction.ts`
- Modify: `server/src/routes/telegram.ts`
- Modify: `src/App.tsx`

**Rules:**
- If text contains URL, use URL hostname/title placeholder.
- If plain text, first line becomes provisional title.
- Category defaults to `other`.
- Status defaults to `inbox`.
- `needsReview = true`.
- Reason: `Captured from Telegram; needs review.`

**Verification:**
- Send “Outer Wilds looks cool”.
- Item appears in Review Inbox in app.

---

## Phase 3: Add URL unfurling and provider metadata

### Task 3.1: Add URL normalization

**Objective:** Clean and canonicalize shared links.

**Files:**
- Create: `server/src/services/url/normalize.ts`
- Create: `server/src/services/url/normalize.test.ts`

**Behavior:**
- Expand redirects where possible.
- Strip common tracking params: `utm_*`, `fbclid`, `gclid`, `igshid`.
- Preserve meaningful params like YouTube video ID.

**Verification:**

```bash
npm test -- normalize
```

### Task 3.2: Add OpenGraph/oEmbed unfurler

**Objective:** Extract page-level metadata from ordinary URLs.

**Files:**
- Create: `server/src/services/url/unfurl.ts`
- Create: `server/src/services/url/oembed.ts`

**Extract:**
- `title`
- `description`
- canonical URL
- OpenGraph title/description/image/type
- Twitter card metadata
- JSON-LD if present
- oEmbed result if available

**Safety:**
- Timeout fetches.
- Limit content size.
- Do not follow infinite redirects.

**Verification:**
- Test YouTube, Wikipedia, Steam, Goodreads/OpenLibrary, Letterboxd-like URL if accessible.
- Store extracted metadata in `source_artifacts.metadata`.

### Task 3.3: Add metadata provider adapters

**Objective:** Ground agent guesses in actual catalogs.

**Files:**
- Create: `server/src/services/providers/tmdb.ts`
- Create: `server/src/services/providers/books.ts`
- Create: `server/src/services/providers/games.ts`
- Create: `server/src/services/providers/types.ts`

**Order:**
1. TMDB for movie/TV.
2. Google Books + Open Library for books.
3. RAWG first for games; IGDB later if needed.
4. Wikidata later for cross-linking.

**Verification:**
- Query one known title per category.
- Confirm candidates include title/year/creator/poster/external IDs.

---

## Phase 4: Add agent enrichment

### Task 4.1: Define extraction schema

**Objective:** Force the LLM to return strict JSON that can be trusted only as evidence, not truth.

**Files:**
- Create: `server/src/services/enrichment/schema.ts`

**Schema fields:**
- `title`
- `category`
- `creator`
- `releaseYear`
- `reason`
- `summary`
- `moods`
- `themes`
- `commitmentLevel`
- `durationMinutes`
- `candidates`
- `confidence`
- `clarificationQuestion`

**Verification:**
- Type-check schema.
- Add sample parse tests.

### Task 4.2: Add enrichment worker

**Objective:** Process capture jobs asynchronously.

**Files:**
- Create: `server/src/workers/enrichmentWorker.ts`
- Create: `server/src/services/jobs.ts`
- Create: `server/src/services/enrichment/enrich.ts`

**Workflow:**
1. Claim queued job.
2. Load ingest event + artifacts.
3. Run URL unfurl/OCR placeholder/provider lookup as applicable.
4. Call LLM structured extraction.
5. Score confidence.
6. Update item or create clarification.
7. Mark job completed/failed.

**Verification:**
- Insert a queued job manually.
- Run worker.
- Confirm item gets enriched or parked in Review.

### Task 4.3: Add confidence scoring

**Objective:** Decide auto-save vs review vs clarification consistently.

**Files:**
- Create: `server/src/services/enrichment/confidence.ts`
- Create: `server/src/services/enrichment/confidence.test.ts`

**Formula:**

```ts
overall =
  0.35 * identity +
  0.20 * category +
  0.20 * metadata +
  0.15 * userIntent +
  0.10 * dedupe
```

**Thresholds:**
- `>= 0.82`: auto-save.
- `0.60 - 0.81`: inbox/review; ask one useful question if available.
- `< 0.60`: artifact-only inbox; ask what title/category to save.

**Verification:**
- Unit tests for thresholds.
- Confirm no low-confidence item enters compass picker.

### Task 4.4: Add Telegram clarification replies

**Objective:** Let the bot resolve ambiguity conversationally without becoming annoying.

**Files:**
- Modify: `server/src/routes/telegram.ts`
- Create: `server/src/services/clarifications.ts`

**Rules:**
- One open clarification per ingest event.
- Prefer inline buttons when options are known.
- Free-text replies map to the latest open clarification.
- User can say “skip”, “ignore”, or “save anyway”.

**Verification:**
- Send ambiguous “Dune”.
- Bot asks movie/book/something else.
- Reply resolves the inbox item.

---

## Phase 5: Add image/screenshot support

### Task 5.1: Download Telegram files

**Objective:** Store screenshots/images/audio files durably.

**Files:**
- Modify: `server/src/services/telegram.ts`
- Modify: `server/src/services/artifacts.ts`

**Implementation notes:**
- Use Telegram `getFile` then download from Bot API file path.
- Store in object storage under `users/{userId}/artifacts/{artifactId}`.
- Keep Telegram `file_id` and storage path.

**Verification:**
- Send screenshot.
- Confirm object exists and artifact row references it.

### Task 5.2: Add OCR/vision extraction

**Objective:** Turn screenshots and images into evidence for the resolver.

**Files:**
- Create: `server/src/services/enrichment/vision.ts`

**MVP options:**
- Use multimodal LLM if already available.
- Or OCR via Tesseract/local first if privacy matters.
- Store extracted text and visual summary in artifact metadata.

**Verification:**
- Screenshot of a recommendation post produces extracted title candidates.
- Low-confidence screenshots still save as Review artifacts.

---

## Phase 6: Compass integration

### Task 6.1: Extract picker utility

**Objective:** Make compass randomness testable and intentional.

**Files:**
- Create: `src/lib/picker.ts`
- Create: `src/lib/picker.test.ts`
- Modify: `src/App.tsx`

**Rules:**
- Exclude `inbox`, `needsReview`, `done`, `rejected`, `archived`.
- Apply hard filters first.
- Weighted random by status, priority, age, mood match, and recency penalty.
- Return primary + two alternates.

**Verification:**
- Unit tests for eligibility and weighting.
- Manual picker still works in app.

### Task 6.2: Store picker events

**Objective:** Capture feedback so the app can stop recommending things Arian keeps rejecting.

**Files:**
- Create: `server/src/routes/pick.ts`
- Modify: `src/App.tsx`

**Events:**
- `shown`
- `accepted`
- `rerolled`
- `skipped`
- `started`
- `completed`

**Verification:**
- Pick item.
- Accept/reroll/skip.
- Confirm event rows exist.

---

## The elegant part

The right abstraction is not “bot adds item.” It is:

```text
Capture -> Evidence -> Candidate -> Decision -> Queue Item -> Picker Event
```

That keeps the system honest:

- Capture preserves what Arian actually sent.
- Evidence stores what machines extracted.
- Candidate admits uncertainty.
- Decision records whether the system auto-saved, asked, or parked it.
- Queue Item is what the compass can choose from.
- Picker Event teaches the chooser what Arian actually does.

This avoids the classic AI-app faceplant where the model confidently hallucinates a title and corrupts the database. We are building a librarian with receipts, not a vibes goblin with write access.
