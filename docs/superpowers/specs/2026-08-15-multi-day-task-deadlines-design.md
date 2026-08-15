# Multi-Day Task Deadlines Design

## Goal

Most tasks are done in one sitting on `scheduled`, their intended day. Some
tasks genuinely span several days (a report, a multi-step errand). This adds
an optional start→finish range to a task, gated behind a "complex task"
switch so ordinary tasks are completely unaffected.

## Data model

`scheduled` keeps its current meaning — the start day — for every task,
complex or not. Two new fields are added:

```ts
// lib/types.ts
export type Task = {
  ...
  isComplex: boolean;    // the "complex task" switch
  finishDate?: string;   // local YYYY-MM-DD; only meaningful when isComplex
  ...
};

export type TaskInput = {
  ...
  isComplex?: boolean;   // defaults to false on create
  finishDate?: string;
  ...
};
```

`lib/schema.sql` adds two additive, defaulted/nullable columns — no backfill
needed, since every existing row is already correct under the defaults:

```sql
alter table tasks add column if not exists is_complex boolean not null default false;
alter table tasks add column if not exists finish_date date;
```

`lib/store/rows.ts` (`TaskRow`, `rowToTask`) maps `is_complex` → `isComplex`
and `finish_date` → `finishDate` (via the existing `isoDate` helper, undefined
when the column is null).

**Invariant, enforced in the store layer, not the database:** in
`addTask`/`updateTask` (`lib/store/tasks.ts`):
- When the resulting `isComplex` is `true`, `finishDate` must be present and
  `>= scheduled`; violating this throws `TaskInvariantError` (mapped to a 400
  by the existing `handle()` in `lib/api`, the same path used for the
  cross-project column error).
- When the resulting `isComplex` is `false`, `finishDate` and `dueTime` are
  both cleared to `null`, so toggling complex off never leaves a stale range
  or a stale time behind.

This mirrors the existing pattern where `updateTask` already keeps
project/stage/status consistent as one unit rather than relying on the caller
to send a fully-consistent patch.

## Validation & API

No new validation primitives are needed — `v.bool` and `v.isoDate` already
exist in `lib/validate.ts`.

`app/api/tasks/route.ts` (create) and `app/api/tasks/[id]/route.ts` (PATCH)
both gain:

```ts
if (b.isComplex !== undefined) patch.isComplex = v.bool(b.isComplex, "isComplex");
if (b.finishDate !== undefined) {
  patch.finishDate = b.finishDate ? v.isoDate(b.finishDate, "finishDate") : undefined;
}
```

## Task editor UI (`components/TaskPanel.tsx`)

- A new "Complex task" toggle sits near the Scheduled/Time fields.
- When on: a "Finish" date input appears alongside "Scheduled" (which reads as
  the range's start), and the "Time" field is hidden — a time-of-day doesn't
  apply to a multi-day span.
- When off: the panel is pixel-identical to today.

## Display surfaces

**TaskRow / Kanban Card.** Wherever these currently render
`fmtDate(task.scheduled)`, a complex task instead renders
`${fmtDate(task.scheduled)} → ${fmtDate(task.finishDate)}`. Kanban's overdue
check (`task.scheduled < todayISO`) becomes deadline-aware:
`(task.isComplex ? task.finishDate! : task.scheduled) < todayISO` — a complex
task isn't overdue just because its start day passed.

**Calendar month grid** (`app/calendar/page.tsx` → `MonthGrid`).
`tasksByDate` currently does one `map.set(task.scheduled, ...)` per task. For
a complex task, it instead adds the task to every date from `scheduled` to
`finishDate` inclusive, using the existing `shiftDays` helper from
`lib/summary.ts`.

Dragging a task's marker to a new day (`MonthGrid`'s drop handler) currently
does `patchTask(task.id, { scheduled: iso })`. For a complex task, the drop
handler instead computes the day delta between the old `scheduled` and the
drop target (via the existing `daysBetween` helper from `lib/parse.ts`) and
shifts both `scheduled` and `finishDate` by that delta in one patch, so the
span length is preserved and the task can't be dragged into an inverted
range.

**DashboardTimeline day-scale view**
(`components/today/DashboardTimeline.tsx`, `DayTimeline`). This is the
motivating surface. Today, each day-column independently filters
`tasks.filter(t => t.scheduled === iso)` and renders one `TaskButton` chip per
matching task, per day. A complex task instead needs to render as a single
continuous bar across the day-columns it spans, within its project's lane.

Concretely: a lane's row becomes an absolutely-positioned overlay for its
complex tasks (the same technique `HourLane`'s `TimeBar` already uses at hour
granularity, applied at day granularity instead) — for each complex task,
`left`/`width` are computed as fractions of the visible day range, clamped to
the visible window since a span can start or end outside it, and rendered as
one bar. Non-complex tasks are unaffected: they keep rendering as individual
per-day chips exactly as today.

The hour-scale view (span ≤ 3 days) is untouched. Complex tasks don't appear
there positioned by time (consistent with hiding `dueTime` in the editor);
they fall into the same "unscheduled" chip strip used today for any task
without a `dueTime`.

## Summary / overdue logic (`lib/summary.ts`)

Both `todaySummary` and `projectSummary` change their per-task date checks
from exact-match to range-aware, but only for complex tasks:

```ts
function isDueOn(task: Task, iso: string): boolean {
  if (!task.isComplex) return task.scheduled === iso;
  return task.scheduled <= iso && iso <= task.finishDate!;
}

function isOverdue(task: Task, todayISO: string): boolean {
  const deadline = task.isComplex ? task.finishDate! : task.scheduled;
  return deadline < todayISO;
}
```

`dueToday`/`openToday` uses `isDueOn(task, todayISO)`; `overdue` uses
`isOverdue`. These two helpers replace the inline `t.scheduled === todayISO` /
`t.scheduled < todayISO` checks in both functions. A non-complex task gets
byte-for-byte the same result as today.

`TaskRow`'s "stale" / "Nd waiting" logic (`daysBetween(task.scheduled,
todayISO)`) stays keyed on `scheduled` — a task still hasn't been picked up
from when it was supposed to *start*, complex or not, so that reading is
correct as-is.

## Testing

- `tests/validate.test.ts` — `isComplex`/`finishDate` validation, including
  rejecting a `finishDate` before `scheduled`.
- `tests/tasks.test.ts` (store) — create/patch with `isComplex`, the
  clear-on-toggle-off behavior, the range-invariant rejection.
- `tests/summary.test.ts` — range-aware `dueToday`/`overdue` for: a complex
  task spanning today, one whose `finishDate` was yesterday (overdue), one
  starting tomorrow (not due yet).
- `tests/ui/dashboard-timeline.test.tsx` — a complex task renders one spanning
  bar in day-scale view, correctly clipped at the visible window's edges.
- `tests/ui/calendar.test.tsx` — a complex task is listed on every day in its
  range; dragging it shifts the whole range and preserves span length.
- `tests/ui/board.test.tsx` — the range badge renders instead of a single
  date for a complex task.

## Out of scope for v1

- QuickAdd shorthand for setting a finish date inline while typing a new
  task. Creating or editing the range happens in the task panel only.
- A database-level `CHECK` constraint for the range invariant. It's enforced
  in the store layer only, consistent with how the codebase already handles
  the project/stage cross-check (`TaskInvariantError`), not with SQL
  constraints.

## Self-review

- `scheduled` never changes meaning for any task — non-complex tasks are
  byte-for-byte unaffected across every surface touched here (summary,
  timeline, calendar, rows).
- The range invariant (`finishDate >= scheduled`, cleared together with
  `isComplex`) is enforced in exactly one place — the store layer — so no
  surface can produce an inconsistent task.
- Rendering changes are scoped to the day-scale timeline, the calendar month
  grid, and compact badges elsewhere; the hour-scale timeline and QuickAdd
  are explicitly untouched.
