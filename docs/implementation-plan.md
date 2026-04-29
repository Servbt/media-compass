# Media Compass Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Build a small personal media queue that captures movies, TV, books, and games, then helps Arian pick one based on mood.

**Architecture:** Start as a mobile-first React app with local state. Add persistence and bot ingestion only after the core choice loop feels right.

**Tech Stack:** React, TypeScript, Vite. Future: Supabase or Turso, Telegram bot, metadata APIs.

---

## Task 1: Prototype the manual queue

**Objective:** Replace the starter Vite page with a functional queue and random chooser.

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.css`
- Modify: `src/index.css`

**Verification:**

```bash
npm run lint
npm run build
```

Expected: both pass.

## Task 2: Add persistence

**Objective:** Persist queue items between sessions.

**Files:**
- Modify: `src/App.tsx`
- Test manually in browser.

**Implementation notes:**
- Start with `localStorage`.
- Use `useEffect` to load once and save when items change.
- Keep seed data only when storage is empty.

**Verification:**
- Add item.
- Refresh.
- Confirm item remains.

## Task 3: Add import/export

**Objective:** Make the personal queue portable before adding backend accounts.

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.css`

**Verification:**
- Export JSON.
- Clear local storage.
- Import JSON.
- Confirm items return.

## Task 4: Add Telegram ingestion endpoint

**Objective:** Let Arian send media finds to a bot and save them.

**Files:**
- Create: `server/telegram.ts` or equivalent backend route after backend choice.
- Create: `server/enrich.ts`

**Implementation notes:**
- Accept raw text/link.
- Use agent enrichment to infer title/category/tags/reason.
- Store `sourceUrl` if present.
- Return a concise confirmation.

**Verification:**
- Send bot a title.
- Confirm item appears in app.

## Task 5: Add metadata providers

**Objective:** Enrich items with useful metadata without bloating the UX.

**Providers:**
- TMDB: movies/TV.
- Open Library or Google Books: books.
- IGDB or RAWG: games.

**Verification:**
- Add one item in each category.
- Confirm title/category/year/creator are reasonable.

## Task 6: Improve chooser logic

**Objective:** Make random selection feel intentional.

**Approach:**
- Weighted random by priority and age.
- Prefer `Shortlist` over `Curious`.
- Allow hard constraints: category, max commitment, mood.
- Show one pick plus two alternates.

**Verification:**
- Given fixed test data, confirm high-priority shortlist items are selected more often.
