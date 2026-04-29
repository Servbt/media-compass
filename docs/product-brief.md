# Product Brief: Media Compass

## One-liner

A personal decision engine that turns "stuff I might want to watch/read/play someday" into a concrete pick for tonight.

## Why this should exist

The pain is not discovery. Discovery is too good. The pain is converting vague interest into action before the phone scroll eats the evening like a tiny glowing tapeworm.

## Comparable products

- **Letterboxd**: excellent movie logging and social taste graph, weak for cross-media decisions.
- **Trakt**: strong TV/movie tracking, less useful for books/games and personal intention capture.
- **StoryGraph / Goodreads**: book-focused tracking and recommendations, no cross-media chooser.
- **Backloggd**: game backlog/logging, category-specific.
- **Likewise**: cross-media recommendations, but not a personal agent-driven queue with decision pressure.

## Differentiated wedge

Media Compass is not primarily a recommendation app. It is a personal queue plus chooser.

The agent layer matters because most recommendations arrive messily: links, comments, screenshots, half-remembered titles, "that show with the guy from...". The bot can normalize that mess and add useful context.

## Core loops

### 1. Capture loop

- User sends media artifact to bot.
- Bot identifies candidate item.
- Bot enriches with metadata.
- Bot asks at most one clarifying question only if needed.
- Bot saves item with reason, moods, and commitment estimate.

### 2. Choice loop

- User declares optional mood/constraint.
- System filters queue.
- System picks one primary assignment.
- User can accept, reject, or reroll once.
- System records outcome.

### 3. Reflection loop

- After completion, user gives a quick rating and note.
- System updates taste signals.
- Future picks improve.

## MVP acceptance criteria

- User can add a media item manually.
- User can categorize it as movie, TV, book, or game.
- User can add mood tags and a reason.
- User can filter by category and mood.
- User can get one random unfinished pick.
- User can mark item status.

## V1 acceptance criteria

- Persistent auth-backed storage.
- Telegram bot command: `/add <anything>`.
- Agent enrichment for at least title/category/reason/moods.
- Metadata lookup for movies/TV/books/games.
- Mobile-first PWA.
- Export/import JSON.

## Non-goals for now

- Social network features.
- Public reviews.
- Perfect recommendation algorithm.
- Tracking every episode/chapter/achievement. That way lies enterprise software, which is how joy dies.
