# Media Compass Architecture

## Product shape

Media Compass is a personal media capture and decision app. The important loop is:

1. User finds a cool thing anywhere.
2. User sends a link, image, forwarded post, screenshot, voice note, or loose text to an AI bot.
3. Bot extracts the likely media item, annotates it, and stores it.
4. React app shows the queue and offers a compass/random picker based on mood, category, time, priority, and status.

Keep the MVP boring: one user, one bot, one web app, one database, one background queue.

## Recommended one-dev stack

- Web app: existing Vite + React + TypeScript.
- Backend/API: Node + TypeScript, preferably Express or Fastify in `server/`.
- Database: Supabase Postgres for easiest auth/storage/admin UI, or plain Postgres with Drizzle. If avoiding hosted services, SQLite/Turso is fine, but Postgres JSONB is useful for annotations.
- Queue: start with a Postgres-backed jobs table. Do not add Redis/BullMQ until needed.
- Bot ingestion: Telegram bot webhook first. Add share extension/PWA capture later.
- File/object storage: Supabase Storage or S3-compatible bucket for screenshots/images/audio.
- Agent/LLM layer: one enrichment service with structured JSON output and confidence fields.
- Metadata providers, in order: OpenGraph/noembed first, then TMDB for movie/TV, Google Books/Open Library for books, RAWG/IGDB for games.

## High-level components

- React app
  - Queue browser: filter by status, category, mood, tags, source.
  - Item detail: original artifact, extracted title, annotation, metadata, confidence, edit controls.
  - Compass picker: constraints in, weighted random result out.
  - Review inbox: ambiguous bot captures needing approval/clarification.

- API server
  - Auth/session for web app.
  - CRUD endpoints for media items.
  - Ingest endpoints for bot webhooks and future web clipper/share targets.
  - Worker process for enrichment jobs.
  - Picker endpoint or shared picker library.

- Telegram bot adapter
  - Receives messages via webhook.
  - Normalizes Telegram payloads into `ingest_events`.
  - Replies quickly: `Got it — processing`.
  - Sends completion/clarification messages when worker finishes.

- Enrichment worker
  - Parses links/text/media.
  - Fetches page metadata when URL is present.
  - Runs LLM extraction into a strict schema.
  - Calls metadata providers based on candidate type.
  - Computes confidence and either saves item, creates clarification, or parks in review.

- Database
  - Source-of-truth for items, artifacts, annotations, jobs, clarification threads, and picker events.

## Data flow

### Bot capture flow

1. Telegram webhook receives message.
2. Server verifies Telegram secret and allowed user ID.
3. Server stores an `ingest_event` with raw message metadata.
4. If message includes file/photo/audio, server downloads it to object storage and creates `source_artifacts` rows.
5. Server creates an `enrichment_job` in `queued` state.
6. Bot immediately replies: `Saved to inbox. I’ll annotate it now.`
7. Worker claims job.
8. Worker extracts candidate media data.
9. Worker enriches candidate with external metadata.
10. Worker computes confidence.
11. If confidence is high, create/update `media_items` and reply with compact confirmation.
12. If medium confidence, create draft item requiring review and ask one clarifying question if useful.
13. If low confidence, create inbox item with raw artifact and ask user what it is.

### Web app flow

1. React app fetches `media_items` plus pending `clarifications`.
2. User can edit any annotation; manual edits become trusted over agent guesses.
3. Compass picker filters eligible items and returns one primary pick plus optional alternates.
4. User accepts, skips, rerolls, starts, or marks done.
5. Picker events are stored for future weighting.

## Core data model

Use UUID primary keys, `created_at`, `updated_at`, and `user_id` on all user-owned tables.

### users

- `id`: uuid
- `telegram_user_id`: text, unique nullable
- `display_name`: text
- `timezone`: text nullable
- `created_at`: timestamptz

For MVP, this can be a single hardcoded user plus Telegram allowlist.

### media_items

The normalized thing the user may watch/read/play.

- `id`: uuid
- `user_id`: uuid
- `canonical_title`: text, required
- `original_title`: text nullable
- `category`: enum: `movie`, `tv`, `book`, `game`, `article`, `video`, `podcast`, `music`, `other`
- `status`: enum: `inbox`, `curious`, `shortlist`, `in_progress`, `done`, `rejected`, `archived`
- `priority`: integer 1-5, default 3
- `reason`: text nullable — why user saved it / why agent thinks it matters
- `summary`: text nullable
- `creator`: text nullable — director, author, studio, channel, etc.
- `release_year`: integer nullable
- `duration_minutes`: integer nullable
- `commitment_level`: enum nullable: `snack`, `evening`, `weekend`, `long_term`
- `moods`: text[] — e.g. `cozy`, `weird`, `thoughtful`
- `themes`: text[] — topical/genre tags
- `source_url`: text nullable
- `poster_url`: text nullable
- `external_ids`: jsonb — `{ tmdbId, imdbId, openLibraryId, rawgId }`
- `agent_confidence`: numeric 0-1
- `confidence_reasons`: text[]
- `needs_review`: boolean default false
- `last_picked_at`: timestamptz nullable
- `completed_at`: timestamptz nullable

MVP can keep only: title, category, status, priority, reason, moods, source URL, confidence, needs review.

### source_artifacts

The messy input that led to an item.

- `id`: uuid
- `user_id`: uuid
- `media_item_id`: uuid nullable
- `ingest_event_id`: uuid nullable
- `type`: enum: `url`, `text`, `image`, `screenshot`, `telegram_forward`, `audio`, `file`
- `content_text`: text nullable
- `url`: text nullable
- `storage_path`: text nullable
- `mime_type`: text nullable
- `metadata`: jsonb — Telegram message IDs, forwarded source, dimensions, OCR output, etc.
- `created_at`: timestamptz

Keep artifacts even after enrichment so the app can show “why this was saved.”

### annotations

Agent/user-generated structured notes. This separates mutable notes from canonical item fields.

- `id`: uuid
- `media_item_id`: uuid
- `source`: enum: `agent`, `user`, `metadata_provider`
- `kind`: enum: `extraction`, `summary`, `mood_tags`, `review_note`, `correction`
- `body`: text nullable
- `data`: jsonb nullable
- `confidence`: numeric 0-1 nullable
- `created_at`: timestamptz

### ingest_events

One row per inbound bot/share event.

- `id`: uuid
- `user_id`: uuid
- `channel`: enum: `telegram`, `web`, `manual`, `api`
- `channel_message_id`: text nullable
- `raw_text`: text nullable
- `raw_payload`: jsonb
- `state`: enum: see queue states below
- `error_message`: text nullable
- `created_at`: timestamptz
- `processed_at`: timestamptz nullable

### enrichment_jobs

Postgres-backed queue. A job can point to an ingest event or a media item.

- `id`: uuid
- `user_id`: uuid
- `ingest_event_id`: uuid nullable
- `media_item_id`: uuid nullable
- `type`: enum: `extract`, `fetch_metadata`, `dedupe`, `classify`, `clarify_response`
- `state`: enum: see queue states below
- `attempts`: integer default 0
- `max_attempts`: integer default 3
- `run_after`: timestamptz default now
- `locked_at`: timestamptz nullable
- `locked_by`: text nullable
- `input`: jsonb
- `output`: jsonb nullable
- `error_message`: text nullable
- `created_at`: timestamptz
- `finished_at`: timestamptz nullable

### clarification_requests

Tracks the bot’s one-question-at-a-time clarification behavior.

- `id`: uuid
- `user_id`: uuid
- `ingest_event_id`: uuid nullable
- `media_item_id`: uuid nullable
- `question`: text
- `options`: jsonb nullable — optional quick-reply choices
- `state`: enum: `open`, `answered`, `expired`, `cancelled`
- `answer_text`: text nullable
- `answer_payload`: jsonb nullable
- `created_at`: timestamptz
- `answered_at`: timestamptz nullable

### picker_events

Used to make the compass feel intentional and avoid picking the same item repeatedly.

- `id`: uuid
- `user_id`: uuid
- `media_item_id`: uuid
- `constraints`: jsonb — category, mood, max duration, status preference
- `result_rank`: integer — 1 for primary, 2+ for alternates
- `action`: enum: `shown`, `accepted`, `rerolled`, `skipped`, `started`, `completed`
- `created_at`: timestamptz

## Queue/job states

Use the same shape for `ingest_events.state` and `enrichment_jobs.state` where practical.

- `received`: webhook accepted and persisted.
- `queued`: ready for worker.
- `locked`: worker has claimed it.
- `extracting`: parsing raw text/link/media/OCR/transcript.
- `metadata_lookup`: querying OpenGraph/provider APIs.
- `deduping`: checking existing queue for same title/source/external ID.
- `needs_clarification`: blocked on user answer.
- `needs_review`: saved as draft/inbox, visible in app, not fully trusted.
- `saving`: writing final item/annotations.
- `completed`: item saved/enriched.
- `failed_retryable`: transient error; retry with backoff.
- `failed_terminal`: cannot process automatically; keep artifact in inbox.
- `cancelled`: user/admin intentionally discarded.

Implementation note: jobs should usually have a single `state` plus typed progress messages. Do not build a complex distributed workflow engine for MVP.

## Confidence and clarification logic

### Confidence dimensions

Compute a simple weighted score from 0 to 1:

- `identity_confidence`: Do we know what exact work this is?
- `category_confidence`: Do we know if it is movie/TV/book/game/etc.?
- `metadata_confidence`: Did an external provider confirm it?
- `user_intent_confidence`: Did the user clearly intend to save this item?
- `dedupe_confidence`: Are we sure it is not an existing item?

Suggested MVP formula:

```ts
confidence =
  0.35 * identity_confidence +
  0.20 * category_confidence +
  0.20 * metadata_confidence +
  0.15 * user_intent_confidence +
  0.10 * dedupe_confidence
```

### Thresholds

- `>= 0.82`: auto-save as `curious` or `shortlist`; no clarification.
- `0.60 - 0.81`: save as `inbox` with `needs_review = true`; ask one clarifying question if it would resolve the uncertainty.
- `< 0.60`: store artifact only; ask “What should I save this as?”

### Clarification rules

Ask at most one question per ingest event unless the user continues the conversation. Prefer multiple choice.

Ask only if the answer changes the saved item materially:

- Multiple candidates found:
  - “Did you mean *Dune* the 2021 movie, *Dune* the book, or something else?”
- Category uncertain:
  - “Is this a book, movie, show, game, or article?”
- Screenshot/social post without clear title:
  - “What’s the title I should save from this?”
- Duplicate likely:
  - “This looks like *Outer Wilds*, already in your queue. Add a new note or ignore?”

Do not ask for nonessential fields like mood tags. The agent can guess them and the user can edit later.

### Bot confirmation examples

High confidence:

> Added *Arrival* — movie, thoughtful/sci-fi/quiet. Reason: smart emotional sci-fi. Confidence 91%.

Medium confidence:

> I saved this to Review: *Dune*. Did you mean the 2021 movie, the 1965 book, or something else?

Low confidence:

> I saved the screenshot, but I can’t tell what media item to add. What title should this become?

## Compass/random picker logic

The picker should be random, but biased toward useful choices.

Eligibility:

- Include statuses: `curious`, `shortlist`, optionally `in_progress`.
- Exclude: `done`, `rejected`, `archived`, and usually `inbox`/`needs_review`.
- Apply hard filters first: category, mood, max duration/commitment, available platform if added later.

Weight formula for MVP:

```ts
weight = 1
weight *= status === 'shortlist' ? 2.0 : 1.0
weight *= priority / 3
weight *= ageBoost(created_at)        // slowly boosts neglected items up to 1.5x
weight *= recencyPenalty(last_picked_at) // avoid immediate repeats, 0.2x-1x
weight *= moodMatchScore              // 1.0 exact/no mood filter, 0.5 partial
```

Return:

- One primary pick.
- Two alternates if enough candidates exist.
- Explanation: “Picked because it matches quiet/sci-fi and has been waiting 42 days.”

MVP can compute this client-side from fetched items. Move it server-side when picker events/learning matter.

## API surface

Minimal endpoints:

- `GET /api/items?status=&category=&q=`
- `POST /api/items`
- `PATCH /api/items/:id`
- `DELETE /api/items/:id` or soft archive
- `POST /api/pick` — constraints in, primary/alternates out
- `GET /api/inbox` — items/artifacts needing review
- `POST /api/inbox/:id/resolve`
- `POST /api/webhooks/telegram`
- `POST /api/clarifications/:id/answer`

For one-dev MVP, the React app can initially call Supabase directly for CRUD and use server routes only for bot webhooks/enrichment. Longer-term, keep all writes behind API routes for consistency.

## Agent enrichment contract

Have the LLM return strict JSON. Store the raw LLM response in `annotations.data` for debugging.

```ts
type ExtractedMediaCandidate = {
  title: string | null
  category: 'movie' | 'tv' | 'book' | 'game' | 'article' | 'video' | 'podcast' | 'music' | 'other' | 'unknown'
  creator?: string | null
  releaseYear?: number | null
  sourceUrl?: string | null
  reason?: string | null
  summary?: string | null
  moods: string[]
  themes: string[]
  commitmentLevel?: 'snack' | 'evening' | 'weekend' | 'long_term' | null
  durationMinutes?: number | null
  candidates?: Array<{
    title: string
    category: string
    year?: number
    provider?: string
    externalId?: string
    confidence: number
  }>
  confidence: {
    identity: number
    category: number
    metadata: number
    userIntent: number
    dedupe: number
    overall: number
    reasons: string[]
  }
  clarificationQuestion?: string | null
}
```

## MVP implementation sequence

### Phase 0: Stabilize current prototype

- Keep existing Vite React app.
- Add localStorage persistence and JSON import/export.
- Update local item type toward the future DB model: string IDs, lowercase enums, `sourceUrl`, `priority`, `createdAt`, `updatedAt`, `needsReview`.
- Add a basic weighted picker in a pure utility function with small tests.

### Phase 1: Add backend and database

- Add `server/` TypeScript app with Express/Fastify.
- Add Supabase/Postgres schema migrations for `media_items`, `source_artifacts`, `ingest_events`, `enrichment_jobs`, `clarification_requests`, `picker_events`.
- Implement CRUD API or Supabase client integration.
- Move seed/localStorage data into a migration/import path.
- Deploy web + API together somewhere simple: Render/Fly/Railway/Vercel plus Supabase.

### Phase 2: Telegram ingestion without fancy enrichment

- Create Telegram bot and webhook route.
- Allowlist one Telegram user ID.
- Accept text and URLs.
- Create `ingest_events`, `source_artifacts`, and a basic item draft.
- Rule-based extraction first:
  - URL title from OpenGraph.
  - Plain text title from message body.
  - Default category `other`/`unknown`, status `inbox`, `needs_review=true`.
- Confirm in Telegram and show inbox in React.

This proves the capture loop end-to-end.

### Phase 3: Agent enrichment

- Add worker process polling `enrichment_jobs`.
- Add LLM structured extraction.
- Add confidence scoring and one-question clarification logic.
- Auto-save high-confidence items; route the rest to Review.
- Add manual resolve UI in React.

### Phase 4: Metadata providers

- Add provider lookup in this order:
  1. OpenGraph/noembed for any URL.
  2. TMDB for movie/TV.
  3. Google Books/Open Library for books.
  4. RAWG or IGDB for games.
- Use provider IDs for dedupe.
- Add poster/cover images.

### Phase 5: Compass polish

- Add picker constraints: category, moods, max commitment, status preference.
- Store picker events.
- Return primary plus alternates.
- Add “accept / reroll once / skip / mark done.”
- Tune weights based on picker events, not complex recommendation ML.

## Suggested repository shape

```text
media-compass/
  src/
    App.tsx
    api/
    components/
    lib/
      picker.ts
      types.ts
  server/
    index.ts
    routes/
      items.ts
      telegram.ts
      pick.ts
    services/
      enrich.ts
      metadata.ts
      confidence.ts
      telegram.ts
    workers/
      enrichmentWorker.ts
    db/
      schema.ts
      migrations/
  docs/
    product-brief.md
    implementation-plan.md
    architecture.md
```

## Practical constraints

- Do not build full multi-user auth until the personal flow works. Use one allowed Telegram user and one app account.
- Do not require perfect metadata. A correct title plus useful reason/mood tags is enough.
- Do not ask too many bot questions. Save first, review later.
- Do not add Redis, vector DB, or recommendation ML in MVP.
- Keep user edits authoritative: if the user changes category/title/moods, never overwrite them automatically.
