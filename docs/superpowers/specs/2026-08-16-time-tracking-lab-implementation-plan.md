# Time Tracking Lab — Implementation Plan

Build a continuous, configurable time-tracking dashboard: a stacked control
centre whose job is that **no waking minute goes unaccounted for**. Logging is
not limited to tasks — sleep, travel, meals, exercise, admin and breaks are
first-class. Categories, activities, colours, presets, module order and gap
rules are user data, never hardcoded.

This document is the build brief. Work through the phases in order. Each phase
ends at a checkpoint that must pass before the next begins.

---

## Rules for the builder

1. **Read `node_modules/next/dist/docs/` before writing any Next.js code.**
   This repo runs Next 16.3, which differs from training data. Relevant guides
   live under `01-app/`. Heed deprecation notices.
2. **Work on the `time-lab` branch only.** Never commit to `main`.
3. **Follow the house style.** Read the neighbouring file before adding to it.
   This codebase favours small modules, SQL owned by the store layer, comments
   that explain *why* rather than *what*, and no defensive scaffolding.
4. **Run `npm run lint` and `npm test` at every checkpoint.** Both must pass.
   Run the app only with `npm run dev:lab`. **Never run `npm run build`,
   `npm start`, or any command with `--env-file=.env.local`** — see Phase 0.5
   for why those reach the production database.
5. **Do not modify the existing task/project/calendar features** except where
   this plan explicitly says to. If a change seems needed outside the listed
   files, stop and say so rather than widening the diff.
6. **Commit per phase**, with the phase name in the message.

---

## Phase 0 — Isolation

> **Read this phase in full before running anything.** `.env.local` in this
> repo holds a **production Neon connection string**, and `lib/db.ts` checks
> `POSTGRES_URL` *before* falling back to PGlite. Setting `PGLITE_DIR` alone
> does **not** isolate anything — the app would still connect to production and
> Phase 1's migration would alter real data.

Three layers, because config alone is not enough: env files are gitignored and
therefore shared across branches, so they cannot be trusted to stay lab-only.

### 0.1 Branch

```
git checkout -b time-lab
```

### 0.2 A committed lab script

Add to `package.json` — **do not edit any `.env` file**:

```json
"dev:lab": "LAB_MODE=1 PGLITE_DIR=.data/lab POSTGRES_URL= DATABASE_URL= POSTGRES_URL_NON_POOLING= SESSION_SECRET= next dev -p 3001",
"seed:lab": "LAB_MODE=1 PGLITE_DIR=.data/lab tsx scripts/seed-lab.ts"
```

Shell-provided variables take precedence over `.env` files, and because this
lives in tracked `package.json` it is genuinely branch-scoped: checking out
`main` makes it vanish. Port 3001 lets the real app keep 3000.

The lab runs **only** via `npm run dev:lab`. Plain `npm run dev` continues to
behave exactly as it does today.

### 0.3 The guard that actually matters

In `lib/db.ts`, at the top of `createDriver()`, before the connection-string
branch:

```ts
// The lab is a scratch instance. If a real connection string is in scope —
// .env.local carries the production Neon URL — refuse to start rather than
// migrate somebody's live data.
if (process.env.LAB_MODE === "1" && connectionString) {
  throw new Error("LAB_MODE is set but a remote database is configured — refusing to connect");
}
```

This is the only layer that holds regardless of how env precedence resolves.
Add a test for it in `tests/` asserting the throw.

### 0.4 No-passcode

In `proxy.ts`, as the first thing inside `proxy()`:

```ts
// No secret configured means a local scratch instance — there is nothing to
// protect and no login page worth showing.
const secret = process.env.SESSION_SECRET ?? "";
if (!secret) return NextResponse.next();
```

Today an empty secret makes `verifySessionToken` return `false` forever, which
redirects `/login` → `/login` in a loop. This is a real fix, not only a lab
convenience — but it is why `SESSION_SECRET=` must live in the `dev:lab` script
rather than in a shared env file, which would disable the gate on `main` too.

### 0.5 Commands that must never be run on this branch

- **`npm run build`, `npm start`, `next build`** — production builds do not
  load `.env.development.local`, so they read the Neon URL from `.env.local`
  and would run the Phase 1 migration **against production**. If a production
  build must be verified, use
  `LAB_MODE=1 PGLITE_DIR=.data/lab POSTGRES_URL= DATABASE_URL= npm run build`.
- **anything with `--env-file=.env.local`** (e.g. `scripts/backup.ts` as
  documented) — that targets the live database by design.
- **`vercel`, `vercel deploy`, `git push`** — the lab branch is never deployed.

### 0.6 Take a backup first

Before Phase 1, snapshot the real database so there is a rollback path:

```
npx tsx --env-file=.env.local scripts/backup.ts
```

**Checkpoint 0:**
- `npm run dev:lab` serves an empty, login-free app on port 3001.
- `npm run dev` (separately) still serves the real app with its data and login.
- `ls -la .data/` shows a new `lab/` directory and an unmodified `pglite/`.
- Temporarily running `LAB_MODE=1 POSTGRES_URL=postgres://x npm run dev:lab`
  throws instead of connecting. Confirm, then revert.

> **Note on tests:** `tests/helpers/db.ts` already deletes `POSTGRES_URL` and
> `DATABASE_URL` and gives each suite a throwaway `mkdtemp` directory, so
> `npm test` is safe on any branch and needs no changes.

---

## Phase 1 — Schema

`segments` becomes the single source of truth for elapsed time. The existing
`time_entries` table is superseded: its rows are migrated into `segments`, and
task-level time is read back through a derived view so `TaskTime`, `TimerButton`
and `TimerStrip` keep working unchanged.

### 1.1 Append to `lib/schema.sql`

Follow the existing file's style: `create table if not exists`, uuid primary
keys, `timestamptz`, `created_at`/`updated_at` defaults.

```sql
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
```

### 1.2 Append to `lib/constraints.sql`

```sql
-- At most one running segment across the whole app, using the same NULL
-- non-collision trick as time_entries_one_running.
create unique index if not exists segments_one_running
  on segments (running_lock);

-- A segment points at a task or an activity, never both.
alter table segments drop constraint if exists segments_one_subject;
alter table segments add constraint segments_one_subject
  check (task_id is null or activity_id is null);

-- A finished segment never ends before it starts.
alter table segments drop constraint if exists segments_ordered;
alter table segments add constraint segments_ordered
  check (ended_at is null or ended_at >= started_at);
```

> **Duration is derived, never stored.** Minutes come from
> `ended_at - started_at` at read time. Storing a rounded `minutes` column is
> what creates phantom sub-minute holes in a continuous timeline.
> `MIN_TRACKED_MINUTES` flooring does **not** apply to segments.

### 1.3 Backfill in `lib/migrate.ts`

Add to `backfill()`, after `seedGeneralNote`, following the existing
"is this already true?" guard style — every step must be a no-op on re-run.

- `seedTrackingSettings` — insert the single row `on conflict do nothing`.
- `seedDefaultCategories` — only when `categories` is empty. Seed from a new
  `DEFAULT_CATEGORIES` constant in `lib/types.ts` (see below). These are
  starting points: the user can rename, recolour or delete any of them.
- `seedDefaultActivities` — only for categories that have none, from
  `DEFAULT_ACTIVITIES`.
- `migrateTimeEntriesToSegments` — for every `time_entries` row with no
  matching segment, insert a segment with `task_id` set, `source = 'timer'`,
  `category_id` = the seeded "Focus Work" category, and
  `ended_at = coalesce(ended_at, started_at + make_interval(mins => minutes))`.
  Guard on `not exists (select 1 from segments s where s.id = t.id)` and reuse
  the same id so the migration is idempotent.

Leave the `time_entries` table in place as a rollback net, but nothing may
write to it after this phase.

### 1.4 Types in `lib/types.ts`

```ts
export type CategoryKind = "work" | "rest" | "upkeep" | "unclassified";
export type SegmentSource = "timer" | "manual" | "backfill";

export type Category = { id, name, color, kind, sortOrder, archived, createdAt };
export type Activity = { id, categoryId, name, typicalMinutes?, isPreset, sortOrder, archived, createdAt };
export type Segment = {
  id: string;
  startedAt: string;
  endedAt?: string;
  categoryId: string;
  activityId?: string;
  taskId?: string;
  note?: string;
  source: SegmentSource;
};
/** Derived on read, never persisted. */
export type Gap = { startedAt: string; endedAt: string; minutes: number };
export type TrackingSettings = { dayStartHour, wakingStartHour, wakingEndHour, minGapMinutes, moduleOrder: string[], hiddenModules: string[] };
```

Plus `DEFAULT_CATEGORIES` and `DEFAULT_ACTIVITIES`:

| Category | kind | colour token | Preset activities |
|---|---|---|---|
| Focus Work | work | `cat-indigo` | Deep work, Meetings, Email |
| Admin | upkeep | `cat-slate` | Admin, Finances, Planning |
| Sleep | rest | `cat-violet` | Sleep, Nap |
| Health | upkeep | `cat-emerald` | Exercise, Meals, Hygiene |
| Travel | upkeep | `cat-amber` | Commute, Travel |
| Personal | rest | `cat-rose` | Family, Social, Leisure |
| Unclassified | unclassified | `cat-neutral` | — |

**Checkpoint 1:** Add `tests/segments-schema.test.ts` alongside the existing
`tests/migration.test.ts` pattern (they use `PGLITE_DIR=memory://`). Assert:
migrations run twice with no duplicate categories; two running segments are
rejected; a segment with both `task_id` and `activity_id` is rejected; existing
`time_entries` rows land in `segments` exactly once.

---

## Phase 2 — Store layer

New modules under `lib/store/`, each owning its own SQL, exported through
`lib/store/index.ts` the way `time.ts` already is.

### `lib/store/categories.ts`
`listCategories`, `addCategory`, `updateCategory`, `archiveCategory`,
`reorderCategories`. Deleting a category with segments must be refused — throw
a `CategoryInUse` error and map it to 409 in `lib/api.ts` next to
`StageConflict`. Archiving is the soft path.

### `lib/store/activities.ts`
`listActivities`, `addActivity`, `updateActivity`, `archiveActivity`,
`reorderActivities`.

### `lib/store/segments.ts`
The heart of the feature.

- `listSegments(fromISO, toISO)` — ordered by `started_at`.
- `runningSegment(q)` — `where ended_at is null limit 1`.
- `startSegment({ categoryId, activityId?, taskId?, note? })` — transactional,
  throws `TimerConflict` if one is running (reuse the existing error class).
- `switchSegment(input)` — atomic stop-and-start, mirroring `switchTimer`, so
  the timeline is never briefly tracking nothing.
- `stopSegment()`.
- `addManualSegment({ startedAt, endedAt, ... })` — used by gap backfill.
- `updateSegment(id, patch)` / `deleteSegment(id)`.
- `fillGap({ startedAt, endedAt, categoryId, activityId?, note? })` — a manual
  insert with `source = 'backfill'` that **must reject any overlap** with an
  existing segment. Check inside the transaction with
  `where tstzrange(started_at, coalesce(ended_at, now())) && tstzrange($1, $2)`.
- `recordedMinutesByTask()` — replaces the `time_entries` version:
  `select task_id, sum(extract(epoch from (ended_at - started_at)) / 60) …
   where task_id is not null and ended_at is not null group by task_id`.

**Gap derivation — `findGaps(dayISO, settings)`.** Gaps are computed, never
stored. That is what makes last night's untracked span still visible tomorrow
morning without anything having run overnight.

```sql
with bounds as (select $1::timestamptz as day_start, $2::timestamptz as day_end),
     ordered as (
       select started_at, ended_at,
              lag(ended_at) over (order by started_at) as prev_end
         from segments, bounds
        where started_at < bounds.day_end
          and coalesce(ended_at, now()) > bounds.day_start
     )
select coalesce(prev_end, (select day_start from bounds)) as gap_start,
       started_at as gap_end
  from ordered
 where started_at > coalesce(prev_end, (select day_start from bounds))
```

Then, in TypeScript: clamp each gap to the waking window, drop anything shorter
than `minGapMinutes`, and append a trailing gap from the last `ended_at` to
`min(now, day_end)`. A day with no segments at all yields one gap covering the
whole waking window.

`dayStartHour` defines the day boundary — a "day" runs `04:00 → 04:00`, so a
late night belongs to the day it started in.

### `lib/store/tracking-settings.ts`
`getTrackingSettings`, `updateTrackingSettings`.

### Rewire `lib/store/time.ts`
Keep the module and its exported `TimeEntry`-shaped API so existing task UI is
untouched, but have every function read and write `segments`. `listTimeEntries`
maps segments with a `task_id` into `TimeEntry` objects, computing `minutes`
from the timestamps. Delete the SQL that touches `time_entries`.

**Checkpoint 2:** `tests/segments.test.ts` and `tests/gaps.test.ts`. Cover: a
fully-tracked day yields zero gaps; a day with three holes yields three; a
9-hour overnight hole survives into the next day's view; sub-`minGapMinutes`
holes are suppressed; overlapping `fillGap` is rejected; `switchSegment` leaves
exactly one running row. Existing `tests/time-entries.test.ts` must still pass
unchanged — that is the proof the derived view works.

---

## Phase 3 — API routes

Follow `app/api/time-entries/route.ts` exactly: `handle()` from `lib/api.ts`,
validators from `lib/validate.ts`, no try/catch in the route.

| Route | Methods |
|---|---|
| `app/api/segments/route.ts` | `GET` (`?from=&to=`, returns `{ segments, running }`), `POST` (start / switch / manual, three shapes on one endpoint like the existing time-entries route) |
| `app/api/segments/stop/route.ts` | `POST` |
| `app/api/segments/[id]/route.ts` | `PATCH`, `DELETE` |
| `app/api/segments/gaps/route.ts` | `GET` (`?date=`) |
| `app/api/segments/fill/route.ts` | `POST` |
| `app/api/categories/route.ts` + `[id]` | `GET`, `POST`, `PATCH`, `DELETE` |
| `app/api/activities/route.ts` + `[id]` | `GET`, `POST`, `PATCH`, `DELETE` |
| `app/api/tracking-settings/route.ts` | `GET`, `PATCH` |

Add validators to `lib/validate.ts` as needed: `categoryKind`, `hour` (0–23),
`stringList`. Reuse `uuid`, `optionalUuid`, `isoTimestamp`, `optionalStr`,
`minutes`.

**Checkpoint 3:** Route-level tests following `tests/time-entries.test.ts`.
Assert the 409 on a second start and the 400 on an overlapping fill.

---

## Phase 4 — Client store

Add `lib/store-context/use-segments.ts` and `use-tracking-config.ts`, following
`use-time.ts` exactly: `request()` from `./request`, optimistic local state,
errors surfaced through the `onError` callback. Wire both into
`lib/store-context/index.tsx` next to the existing hooks.

Expose: `segments`, `runningSegment`, `gaps`, `categories`, `activities`,
`settings`, and the actions. Derive daily roll-ups with `useMemo`, the way
`use-time.ts` derives `totals`.

**Checkpoint 4:** `npm run lint` and `npm test` pass; a temporary debug render
of the raw segment list shows seeded data.

---

## Phase 5 — Design system

Do this **before** building modules, so six modules cannot each re-derive it.

### 5.1 The existing language (extracted — follow it exactly)

- **Mono is the metadata voice.** `font-mono text-[10px] uppercase
  tracking-[0.1em] text-muted-foreground` for every label, hour, date and
  count. Sans is for user content only. This single rule carries most of the
  app's character.
- **Hierarchy comes from border opacity, not shadow.** Outer frame
  `border-border/70`, inner dividers `/60`, gridlines
  `color-mix(in srgb, var(--color-border) 55%, transparent)`. Shadows are only
  for things that float.
- **Accent is rationed hard.** Today's tint is `bg-accent/[0.035]`. The now-line
  is a single `w-px`. `SectionLabel` is the only accent fill, at 5%.
  `--color-accent` means *live now* or *action* — nothing else.
- **Module shell:** `rounded-xl border border-border bg-card`, `bg-muted/30`
  header row, fixed label gutter + `minmax(0,1fr)` grid.
- **Wide content scrolls** behind a `min-w-[48rem]` floor; it never compresses.
- **Motion** is 140–300ms on `--ease-out-soft`, guarded with `motion-safe:`.
- **Numbers use `tabular-nums`** so live clocks don't jitter.

### 5.2 Three resolutions this feature needs

1. **Colour at density.** The existing bar rule (solid fill, white text) works
   because task timelines are sparse. The ribbon is not — a tracked day is 20+
   contiguous blocks, and solid fills there read as a paintbox. So: **sparse
   contexts keep solid fill; the continuous ribbon uses a 12% tint with a 3px
   saturated left rule and foreground-coloured text.** Same palette, two
   treatments, one written rule for which applies.
2. **Absence.** Gaps are the only dashed border in the system: dashed
   `border-border` on transparent, mono label, no fill. Missing time must never
   look like another category.
3. **Liveness.** Two competing pulses exist today — `animate-pulse-dot` and
   Tailwind's `animate-pulse` in `TimerStrip.tsx`. Keep `pulse-dot`, change
   `TimerStrip` to use it, so "live" has exactly one form.

### 5.3 Category palette tokens

Add to the `@theme` block in `app/globals.css`, and to both dark blocks (the
`prefers-color-scheme` one and `:root[data-theme="dark"]`). Dark values are
lighter and less saturated so tints stay legible on `#0b0d10`.

```
--color-cat-indigo, --color-cat-slate, --color-cat-violet,
--color-cat-emerald, --color-cat-amber, --color-cat-rose,
--color-cat-cyan, --color-cat-neutral
```

Categories store the **token name** (`"cat-indigo"`), not a hex value, so
colours follow the theme. Existing `PROJECT_COLORS` hexes stay as they are.

### 5.4 Primitives

Create `components/tracking/`:

- `ModuleCard.tsx` — shell + `SectionLabel` header + optional right-side action
  slot + collapse. Every module uses it; none hand-roll the shell.
- `MetaLabel.tsx` — the mono idiom, so it stops being retyped.
- `TimeBlock.tsx` — a segment block, `density="sparse" | "continuous"`,
  implementing resolution 1.
- `GapBlock.tsx` — resolution 2, with its fill affordance.
- `CategoryDot.tsx` / `CategoryPicker.tsx`.

**Checkpoint 5:** Lint passes and the primitives render in isolation in both
themes.

---

## Phase 6 — The dashboard

New route `app/tracking/page.tsx`. Add `{ label: "Tracking", href: "/tracking" }`
to `NAV` in `components/Sidebar.tsx`, after "Calendar".

Modules render in `settings.moduleOrder`, skipping `hiddenModules`. Build them
**in this order**, checking each in the browser before starting the next.

1. **Now** — running segment, elapsed (`tabular-nums`, `useNow`), stop/switch,
   and preset chips from `activities where is_preset`. Starting a preset while
   one runs calls `switchSegment`, never stop-then-start.
2. **Unaccounted** — gap rows with duration, time range, and one-tap preset
   fill. Collapses to a single "All accounted for" line when empty. Overnight
   gaps are labelled as such. This is the module the whole feature exists for.
3. **Day ribbon** — vertical continuous timeline, hour rail on the left in the
   mono idiom, blocks proportional to duration. Click a block to edit, click a
   gap to fill. Now-line as a 1px accent rule. Reuse the geometry approach in
   `components/today/DashboardTimeline.tsx` (`HourLane`, percentage offsets,
   repeating-linear-gradient gridlines) — rotated to vertical.
4. **Roll-ups** — minutes per category, plus coverage: tracked minutes ÷ waking
   minutes elapsed so far today.
5. **Signals** — coverage %, longest unbroken stretch, most-fragmented hour,
   time by category `kind`. Read `kind`, never category names.
6. **Records** — plain editable table of the day's segments: sort, filter,
   inline edit, delete.

Date navigation (prev / next / today) at the page head drives all modules.

**States to build, not retrofit:** empty day (no segments at all — the whole
waking window is one gap), first-run (no categories yet — link to settings),
and load failure (the app's existing `ErrorToast` path).

**Responsive:** below `lg`, modules stack full-width and the ribbon keeps its
vertical form with a narrower hour rail. The records table scrolls
horizontally inside its own container.

**Checkpoint 6:** Verify at 1440×900 and 390×844, in light and dark, against
three seeded days: fully tracked, 60% holes, and one with a 9-hour overnight
gap.

---

## Phase 7 — Configuration

`app/tracking/settings/page.tsx`, matching the existing `app/settings/page.tsx`
and `components/settings/` idiom.

- Categories: add, rename, recolour, reorder, archive.
- Activities: add, rename, assign category, set typical duration, toggle preset.
- Gap rules: day start hour, waking window, minimum gap.
- Module order and visibility.

Nothing in the taxonomy may be hardcoded in a component. If a module needs a
category by name, that is a bug — use `kind`.

**Checkpoint 7:** Rename and recolour a seeded category; confirm the ribbon,
roll-ups and signals all follow with no code change.

---

## Phase 8 — Seed data and verification

Add `scripts/seed-lab.ts`, following `scripts/backup.ts` conventions, wired as
`npm run seed:lab` (Phase 0.2). It must **refuse to run** unless `LAB_MODE=1`,
`PGLITE_DIR` is set to a path not ending in `pglite`, and no connection string
is present — three guards against ever seeding the real database.

Generate fictional data across the last 14 days: an ADHD-realistic mix of
fragmented and clean days, sleep segments crossing midnight, a few tasks with
timed work, and at least one deliberately untracked afternoon.

**Final verification:**
- `npm run lint` and `npm test` pass.
- `ls -la .data/` shows the real `pglite` directory unmodified.
- No login prompt anywhere in the lab.
- Every page of the original app still works — tasks, projects, kanban,
  calendar, and especially task timers, which now run on `segments`.
- Full pass at desktop and mobile, light and dark.

---

## Out of scope

Editing time by dragging block edges, week/month views, imports from calendar
or external sources, notifications or nudges, and any merge back to `main`.
Those come after the first round of use.

> **When this eventually does merge:** `schema.sql` runs on every startup,
> including production, so merging Phase 1 will create the new tables and
> backfill `segments` on the live Neon database. That merge needs its own
> review, a fresh `scripts/backup.ts` snapshot, and `TABLES` in that script
> extended to cover `segments`, `categories`, `activities`, and
> `tracking_settings`. It is explicitly not part of this build.
