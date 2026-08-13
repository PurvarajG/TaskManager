-- Idempotent: runs on every cold start, so everything is IF NOT EXISTS.
-- IDs are generated in application code (crypto.randomUUID()), not by the
-- database, so this schema has zero dependency on pgcrypto/uuid-ossp being
-- installed — it works unmodified on Vercel Postgres, Neon, Supabase, or the
-- embedded PGlite fallback used for local dev.

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

create index if not exists tasks_scheduled_idx on tasks (scheduled);
create index if not exists tasks_status_idx on tasks (status);
create index if not exists tasks_project_idx on tasks (project_id);
create index if not exists subtasks_task_idx on subtasks (task_id);
