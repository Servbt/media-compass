create extension if not exists pgcrypto;

do $$ begin
  create type media_category as enum ('movie', 'tv', 'book', 'game', 'other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type media_status as enum ('inbox', 'curious', 'shortlist', 'in_progress', 'done', 'rejected', 'archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type source_artifact_type as enum ('url', 'text', 'image', 'screenshot', 'telegram_forward', 'audio', 'file');
exception when duplicate_object then null; end $$;

do $$ begin
  create type ingest_channel as enum ('telegram', 'web', 'manual', 'api');
exception when duplicate_object then null; end $$;

do $$ begin
  create type queue_state as enum (
    'received',
    'queued',
    'locked',
    'extracting',
    'metadata_lookup',
    'deduping',
    'needs_clarification',
    'needs_review',
    'saving',
    'completed',
    'failed_retryable',
    'failed_terminal',
    'cancelled'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type enrichment_job_type as enum ('extract', 'fetch_metadata', 'dedupe', 'classify', 'clarify_response');
exception when duplicate_object then null; end $$;

do $$ begin
  create type clarification_state as enum ('open', 'answered', 'expired', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type picker_action as enum ('shown', 'accepted', 'rerolled', 'skipped', 'started', 'completed');
exception when duplicate_object then null; end $$;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  telegram_user_id text unique,
  display_name text not null,
  timezone text,
  created_at timestamptz not null default now()
);

create table if not exists media_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  canonical_title text not null,
  original_title text,
  category media_category not null default 'other',
  status media_status not null default 'inbox',
  priority integer not null default 3 check (priority between 1 and 5),
  reason text,
  summary text,
  creator text,
  release_year integer,
  duration_minutes integer,
  commitment_level text check (commitment_level in ('snack', 'evening', 'weekend', 'long_term')),
  moods text[] not null default '{}',
  themes text[] not null default '{}',
  source_url text,
  poster_url text,
  external_ids jsonb not null default '{}',
  agent_confidence numeric check (agent_confidence is null or (agent_confidence >= 0 and agent_confidence <= 1)),
  confidence_reasons text[] not null default '{}',
  needs_review boolean not null default true,
  last_picked_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists ingest_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  channel ingest_channel not null,
  channel_message_id text,
  raw_text text,
  raw_payload jsonb not null default '{}',
  state queue_state not null default 'received',
  error_message text,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create table if not exists source_artifacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  media_item_id uuid references media_items(id) on delete set null,
  ingest_event_id uuid references ingest_events(id) on delete set null,
  type source_artifact_type not null,
  content_text text,
  url text,
  storage_path text,
  mime_type text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists enrichment_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  ingest_event_id uuid references ingest_events(id) on delete cascade,
  media_item_id uuid references media_items(id) on delete cascade,
  type enrichment_job_type not null,
  state queue_state not null default 'queued',
  attempts integer not null default 0,
  max_attempts integer not null default 3,
  run_after timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  input jsonb not null default '{}',
  output jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  check (ingest_event_id is not null or media_item_id is not null)
);

create table if not exists clarification_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  ingest_event_id uuid references ingest_events(id) on delete cascade,
  media_item_id uuid references media_items(id) on delete cascade,
  question text not null,
  options jsonb,
  state clarification_state not null default 'open',
  answer_text text,
  answer_payload jsonb,
  created_at timestamptz not null default now(),
  answered_at timestamptz
);

create table if not exists picker_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  media_item_id uuid not null references media_items(id) on delete cascade,
  constraints jsonb not null default '{}',
  result_rank integer not null default 1,
  action picker_action not null,
  created_at timestamptz not null default now()
);

create index if not exists media_items_user_status_idx on media_items(user_id, status);
create index if not exists media_items_user_category_idx on media_items(user_id, category);
create index if not exists source_artifacts_ingest_event_idx on source_artifacts(ingest_event_id);
create index if not exists enrichment_jobs_state_run_after_idx on enrichment_jobs(state, run_after);
create index if not exists clarification_requests_user_state_idx on clarification_requests(user_id, state);
create index if not exists picker_events_item_created_idx on picker_events(media_item_id, created_at desc);
