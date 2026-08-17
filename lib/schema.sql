-- Idempotent: runs on every cold start, so everything is IF NOT EXISTS.
-- IDs are generated in application code (crypto.randomUUID()), not by the
-- database, so this schema has zero dependency on pgcrypto/uuid-ossp being
-- installed — it works unmodified on Vercel Postgres, Neon, Supabase, or the
-- embedded PGlite fallback used for local dev.
--
-- This file is DDL only, and only DDL that is safe against a populated
-- database: new columns are nullable or defaulted, never NOT NULL without a
-- default. Anything that needs existing rows to be correct first (default
-- stages, stage assignment) lives in lib/migrate.ts and runs after this, with
-- the post-backfill constraints applied last.

create table if not exists projects (
  id uuid primary key,
  name text not null,
  color text not null default '#0052ff',
  archived boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists tasks (
  id uuid primary key,
  title text not null,
  notes text,
  project_id uuid references projects(id) on delete set null,
  tags text[] not null default '{}',
  scheduled date not null,
  due_time text,
  minutes integer not null default 30,
  priority integer not null default 0,
  status text not null default 'open',
  recurrence jsonb,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  deleted_at timestamptz
);

create table if not exists subtasks (
  id uuid primary key,
  task_id uuid not null references tasks(id) on delete cascade,
  title text not null,
  done boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- ── Workspace upgrade ──────────────────────────────────────────────────────

-- Kanban columns. `kind` carries the semantics (progress, blocked, done) so a
-- renamed column never desyncs a summary; `name` is purely what the user sees.
create table if not exists project_stages (
  id uuid primary key,
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  kind text not null default 'active',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table tasks add column if not exists stage_id uuid references project_stages(id) on delete set null;
alter table tasks add column if not exists board_order integer not null default 0;

-- Multi-day task deadlines: an optional start->finish range, gated behind
-- is_complex so ordinary single-day tasks are unaffected. The range invariant
-- (finish_date >= scheduled) is enforced in the store layer, not here.
alter table tasks add column if not exists is_complex boolean not null default false;
alter table tasks add column if not exists finish_date date;

-- Exactly one general note, for the single owner.
create table if not exists general_note (
  id text primary key,
  body text not null default '',
  updated_at timestamptz not null default now()
);

-- Deliberately not tasks: a scratch checklist that can graduate into a task.
create table if not exists quick_todos (
  id uuid primary key,
  title text not null,
  done boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- `running_lock` is true while running and NULL once stopped. A plain unique
-- index over it therefore permits at most one running entry (NULLs never
-- collide), enforcing the single-timer rule in the database rather than in
-- client state. Portable to both Postgres and PGlite.
create table if not exists time_entries (
  id uuid primary key,
  task_id uuid not null references tasks(id) on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz,
  minutes integer,
  note text,
  running_lock boolean,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tasks_scheduled_idx on tasks (scheduled);
create index if not exists tasks_status_idx on tasks (status);
create index if not exists tasks_project_idx on tasks (project_id);
create index if not exists tasks_stage_idx on tasks (stage_id, board_order);
create index if not exists subtasks_task_idx on subtasks (task_id);
create index if not exists project_stages_project_idx on project_stages (project_id, sort_order);
create index if not exists time_entries_task_idx on time_entries (task_id);
create index if not exists time_entries_started_idx on time_entries (started_at);

-- ── Time tracking lab ───────────────────────────────────────────────────────

-- A category is the top-level bucket a segment rolls up into. `kind` lets
-- summaries reason about time without knowing the user's chosen names.
create table if not exists categories (
  id uuid primary key,
  name text not null,
  color text not null,
  kind text not null,            -- 'work' | 'rest' | 'upkeep' | 'unclassified'
  sort_order integer not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

-- A named thing the user actually does. Quick-entry chips are just the
-- activities flagged `is_preset`.
create table if not exists activities (
  id uuid primary key,
  category_id uuid not null references categories(id) on delete cascade,
  name text not null,
  typical_minutes integer,
  is_preset boolean not null default false,
  sort_order integer not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

-- The continuous life timeline. Exactly one of task_id / activity_id may be
-- set; category_id is always present so every minute rolls up somewhere.
create table if not exists segments (
  id uuid primary key,
  started_at timestamptz not null,
  ended_at timestamptz,
  category_id uuid not null references categories(id),
  activity_id uuid references activities(id) on delete set null,
  task_id uuid references tasks(id) on delete cascade,
  note text,
  source text not null default 'timer',   -- 'timer' | 'manual' | 'backfill'
  running_lock boolean,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Single-row settings table, same one-row pattern as general_note.
create table if not exists tracking_settings (
  id uuid primary key,
  day_start_hour integer not null default 4,
  waking_start_hour integer not null default 7,
  waking_end_hour integer not null default 23,
  min_gap_minutes integer not null default 10,
  module_order text[] not null default
    array['now','unaccounted','ribbon','rollups','signals','records'],
  hidden_modules text[] not null default array[]::text[],
  updated_at timestamptz not null default now()
);

create index if not exists segments_started_idx on segments (started_at);
create index if not exists segments_task_idx on segments (task_id);
create index if not exists segments_category_idx on segments (category_id);
create index if not exists activities_category_idx on activities (category_id, sort_order);

-- A project's own timer sessions inherit this category instead of the
-- hardcoded Focus Work default. Nullable + on delete set null so archiving
-- or deleting a category can never orphan a project.
alter table projects add column if not exists default_category_id uuid references categories(id) on delete set null;

-- Which modules the user has collapsed on the tracking dashboard, so the
-- state survives a reload instead of every card re-expanding.
alter table tracking_settings add column if not exists collapsed_modules text[] not null default array[]::text[];
