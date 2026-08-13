# Workspace Upgrade — Implementation Plan

Baseline commit: `d1e9048`. Target: the workspace design (stages/Kanban, Today dashboard,
Calendar, note, quick to-dos, time tracking) on top of the existing Next.js 16 +
Postgres/PGlite app.

## 0. Foundations the design assumes but the codebase lacks

These are prerequisites, not optional polish. Each is a discrete task.

### 0a. Transactions in `lib/db.ts`

`lib/db.ts:67` exposes only `query()`. The design requires five transactional compound
mutations (project+stages, stage removal+task move, quick-todo conversion, timer
stop-and-start, completion+stage+recurrence). Add to the `Driver` interface:

```ts
export async function withTransaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T>;
type Tx = { query<R extends Row = Row>(text: string, params?: unknown[]): Promise<R[]> };
```

- Postgres branch: `sql.begin()` from postgres.js.
- PGlite branch: `db.transaction()`.
Both already exist in the installed versions. Every existing `store` method keeps working
on the non-transactional path; new compound methods take an optional `tx`.

### 0b. Migration becomes DDL + idempotent backfill

`migrate()` currently just `exec`s `lib/schema.sql`. Backfilling default stages for
existing projects and assigning existing tasks to them cannot be expressed as
`IF NOT EXISTS` DDL. Split into `lib/migrate.ts`:

1. `exec(schema.sql)` — all additive `IF NOT EXISTS` DDL, no new NOT NULL/FK constraints
   on populated columns yet.
2. Backfill, inside one transaction, each step guarded by an existence check:
   - for every project with zero stages, insert Backlog/In Progress/Blocked/Done;
   - `update tasks set stage_id = <done stage>` where `project_id is not null and
     stage_id is null and status = 'done'`; the rest to that project's `backlog` stage;
   - seed the singleton note row if absent.
3. `exec` the post-backfill constraint/index DDL (partial unique indexes, check
   constraints), all `IF NOT EXISTS`.

Re-running must be a no-op — the guards are "does this project already have stages",
never "has migration N run", so user-customized stages are never recreated or reset.

### 0c. Single-running-timer constraint

Portable across Postgres and PGlite without expression-index quirks: give `time_entries` a
`running_lock boolean` column, set to `true` while running and `NULL` when stopped, with
`create unique index if not exists time_entries_one_running on time_entries (running_lock)`.
NULLs don't collide in a unique index, so at most one row can hold `true`. A second start
raises a unique violation → API maps it to **409** with the currently-running task id.

### 0d. Database test harness

No test currently touches the DB. `lib/db.ts:38` hardcodes `process.cwd()/.data/pglite`.
Add `PGLITE_DIR` env override (and accept `memory://`), so `tests/` can spin a fresh
throwaway PGlite per suite and reset the module singletons. This unlocks every
migration/store/API test the design asks for.

## 1. Schema additions (`lib/schema.sql`)

```sql
project_stages(id uuid pk, project_id uuid not null → projects on delete cascade,
               name text not null, kind text not null, sort_order int not null,
               created_at timestamptz not null default now())
-- kind ∈ backlog|active|blocked|done; unique partial index: one 'done' per project
tasks    + stage_id uuid → project_stages on delete set null
         + board_order int not null default 0
general_note(id text pk default 'owner', body text not null default '',
             updated_at timestamptz not null default now())
quick_todos(id uuid pk, title text not null, done bool not null default false,
            sort_order int not null default 0, created_at, updated_at)
time_entries(id uuid pk, task_id uuid not null → tasks on delete cascade,
             started_at timestamptz not null, ended_at timestamptz,
             minutes int, note text, running_lock boolean, created_at, updated_at)
```

Indexes: `project_stages(project_id, sort_order)`, `tasks(stage_id, board_order)`,
`time_entries(task_id)`, `time_entries(started_at)`.

## 2. Delivery sequence

Each phase ends with: focused tests → `npm test` → `npm run lint` → `npm run build`.
No deploy until phase 7.

| # | Phase | Files | Verification |
|---|---|---|---|
| 1 | Foundations + domain/API | `lib/db.ts`, `lib/migrate.ts`, `lib/schema.sql`, `lib/types.ts`, `lib/store.ts` (split into `lib/store/{tasks,projects,stages,note,quick-todos,time}.ts`), `lib/validate.ts`, `app/api/{stages,note,quick-todos,time-entries}/**` | migration idempotency on populated PGlite; stage CRUD + invariants; timer 409; totals |
| 2 | Editing surfaces | `components/TaskPanel.tsx`, `components/ProjectSettings.tsx`, store-context split into `lib/store-context/*` | open+edit from every surface; optimistic rollback on API failure |
| 3 | Kanban | `app/projects/[id]/page.tsx` → board, `components/kanban/*`, extend `lib/useDragReorder.ts` for cross-column moves | card move (pointer + keyboard menu), stage removal destination flow |
| 4 | Today dashboard | `components/Today.tsx`, `components/{GeneralNote,QuickTodos,ThreeWeekTimeline}.tsx` | autosave states, conversion transaction, timeline range |
| 5 | Calendar | `app/calendar/page.tsx`, `components/calendar/*`, sidebar entry | drag reschedule, mobile Move Date, day panel |
| 6 | Tracking | `components/TimerStrip.tsx` in `AppChrome`, project/Today summaries, `lib/summary.ts` (pure, unit-tested) | summary math for empty/active/blocked/overdue/completed projects |
| 7 | Hardening + deploy | responsive, a11y, failure states | populated-PGlite migration, light/dark, keyboard-only move, reload persistence, then `npx vercel --prod --yes` |

## 3. Deliberate constraints

- **No new runtime dependencies.** Drag-and-drop extends the existing HTML5-DnD
  `useDragReorder` hook rather than pulling in dnd-kit; keyboard "Move to stage / Move
  date" menu items are the accessible path and carry equal weight.
- **Stage semantics, not booleans.** Blocked and progress derive from `kind`, so renaming
  a column never desyncs a summary. No stored project-health value.
- **Server is authoritative on invariants.** Client optimism is limited to deterministic
  reversals (edits, board moves, calendar drags, checklist toggles); creation, conversion,
  deletion, and timer transitions await confirmation.

## 4. Test stack — decided

Interaction coverage uses **`vitest` + `@testing-library/react` + `jsdom`** as
devDependencies. `npm test` runs both the existing `node:test` suites (auth, rate-limit,
proxy, and the new DB/store/migration suites) and the vitest component suites, so the
panel/drag/focus/autosave cases in the design are gated rather than checked by hand.
