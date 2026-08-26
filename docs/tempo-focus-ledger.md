# Tempo-focus feature-preservation ledger

Written before Phase 1 per the plan
(`.claude/plans/here-is-a-design-cosmic-pebble.md`, "The feature-preservation
ledger"). For each component the plan touches: the capabilities it provides
today. Each later phase appends to its component's row, marking capabilities
`preserved` or `moved to <file>`. The continuity auditor treats this file as
its checklist — a capability listed here that no longer appears in any
shipped file, with no `moved to` note, is an automatic BLOCK.

Status key: `untouched` = not yet reached by any phase. `Phase N` = last
phase that touched it, followed by the outcome.

---

## Phase 0 — new/changed in this phase

### `app/globals.css`
- Existing tokens (`--color-accent`, `--color-background`, category palette,
  etc.) — **preserved**, values unchanged.
- Both dark-mode selectors (`@media (prefers-color-scheme: dark)
  :root:not([data-theme="light"])` and `:root[data-theme="dark"]`) still list
  every property in lockstep — **preserved**, new nav/ink/attention roles
  added to both.
- New tokens added: `--color-nav`, `--color-nav-foreground`,
  `--color-nav-hover`, `--color-nav-active`, `--color-ink`,
  `--color-attention`, `--color-attention-surface`,
  `--color-attention-border`, each with a `--dark-*` counterpart wired
  through both dark selectors. **Additive only** — nothing renders
  differently yet; no call site references them.
- `--color-accent` (#0052ff) and `--font-display` (Calistoga) — **preserved
  unchanged** per the plan's explicit instruction not to swap them for the
  prototype's #075cf6 / Georgia.

### `components/SectionLabel.tsx`
- Default (`variant="plain"`, implicit) render path — **preserved byte-for-byte**:
  accent-tinted pill, `.no-drag` opt-out, `pulse` dot. `PageShell` and every
  existing call site use this path untouched.
- New: `variant="eyebrow"` — bordered pill matching the prototype's
  `.eyebrow`, same `.no-drag` wrapper and `pulse` support. Additive; no
  existing call site passes `variant` yet, so nothing visually changes.

### `components/ui/Panel.tsx` (new)
- Generalises the card chrome previously duplicated in `ModuleCard` and
  `RailPanel`: header row (title via `SectionLabel`, optional `action` slot,
  collapse toggle with `aria-expanded`/`aria-label`), collapsed/expanded
  body, and the dashed-line empty state.
- Props: `title`, `action?`, `collapsible?` (default true), `defaultCollapsed?`,
  `collapsed?` + `onToggleCollapse?` (controlled pair), `empty?`, `emptyText?`,
  `children`.

### `components/tracking/ModuleCard.tsx`
- Now a thin wrapper over `Panel` — **preserved**: identical prop shape
  (`title`, `action`, `collapsible`, `defaultCollapsed`, `collapsed`,
  `onToggleCollapse`, `children`), identical rendered markup/classes, so
  every tracking module call site is unaffected.
- Collapse persistence contract (callers own it via `collapsed` +
  `onToggleCollapse`, using `collapsedModules` / `patchSettings` from
  `lib/store-context/use-tracking-config.ts` and the `collapsed_modules` DB
  column) — **preserved**, untouched by this phase; `ModuleCard` itself never
  owned persistence.

### `components/ui/RailPanel.tsx`
- Now a thin wrapper over `Panel` — **preserved**: identical prop shape
  (`title`, `collapsed`, `onToggleCollapse`, `empty`, `emptyText`,
  `children`), identical rendered markup, `tests/ui/rail-panel.test.tsx`
  passes unmodified against the new implementation.

### `components/ui/MetricStrip.tsx` (new)
- Inline mono uppercase stat row, `items: { value, label, key? }[]`. No
  existing call site wired in yet — introduced as the shared primitive that
  Phase 2 and later route the ad-hoc stat rows in `Today.tsx`,
  `app/projects/[id]/page.tsx`, `app/tracking/page.tsx` and
  `app/upcoming/page.tsx` through.

### `components/ui/CollapsedBar.tsx` (new)
- Single-line disclosure bar (`label`, `count`, `onExpand`, `expandLabel?`).
  No existing call site yet — introduced for Phase 3's kanban backlog
  collapse.

### `package.json`
- New `typecheck` script (`tsc --noEmit`) — additive, does not change `build`,
  `test`, or any existing script.

---

## Components reached by later phases (not yet touched — reference only)

Recorded now so later phases inherit the checklist instead of re-deriving it
from the plan. Capabilities below are read off the plan text and the current
tree; the phase that actually touches the file must verify and update this
list against the real code at that time.

### `components/Sidebar.tsx` (Phase 1) — status: Phase 1, done
- Search submits to `/search?q=` — **preserved**, unchanged handler; input
  now sits on `bg-nav-hover` with `text-nav-foreground`/`placeholder`, and
  carries `.no-drag`.
- `NAV` list filtered by `settings.hiddenNavItems` — **preserved**, unchanged
  filter logic, only className restyled.
- `UNHIDEABLE_NAV_KEY = "settings"` always visible regardless of hide state —
  **preserved**, untouched (this constant lives in `NavVisibility`'s
  consumer, `Sidebar.tsx` only exports it; no logic here to regress).
- Inline project create: Enter to submit, Escape to cancel, blur to cancel,
  auto-colour from `PROJECT_COLORS`, redirect to the new project on create —
  **preserved**, unchanged handlers; the input field restyled to
  `bg-nav-hover`/`text-white` to match the dark rail.
- Hover `×` delete per project, with confirm — **preserved**, unchanged
  `confirm()` call, restyled to `text-nav-foreground` / `hover:bg-nav-hover`.
- `ThemeToggle` and `TempoMark` render inside the rail — **preserved**.
  `ThemeToggle` (only ever mounted here, verified via repo-wide search) had
  its hardcoded `text-muted-foreground` / `hover:bg-muted` / `hover:text-
  foreground` classes swapped for `text-nav-foreground` / `hover:bg-nav-hover`
  / `hover:text-white` so it's legible against the now-opaque charcoal rail
  in all three theme states — no behavioural change, `cycle()` and the
  `useSyncExternalStore` wiring untouched.
- Drag-region contract: titlebar band keeps `.drag-region` (`pt-9` on the
  branding wrapper); the branding row keeps `.no-drag` as a whole per the
  contract comment. Added `.no-drag` defensively to nav links, project rows,
  the search input/icon, the "+" button, and the inline project-create input
  — none of these overlap the `pt-9` drag band today, but keeping them
  explicit avoids a future layout shift silently making them drag-live.
- New surface: `aside` is now `bg-nav text-nav-foreground` (opaque charcoal,
  paints over the Electron vibrancy per the plan's decision 1); wordmark
  `Link` text set to `text-white`; active nav/project pill is
  `bg-nav-active` with `text-sm font-semibold text-white` (bumped from
  `text-[13px]` — see contrast fix below); project dot + open-count badge
  preserved, restyled to `text-nav-foreground/70` (inactive) /
  `text-white/70` (active).
- `tests/ui/sidebar.test.tsx` and `tests/ui/nav-visibility.test.tsx` pass
  unmodified.

**Contrast fix (Phase 0 auditor finding 3):** `--dark-nav-active` (`#4d7cff`)
under white text measured 3.72:1 — below the 4.5:1 small-text threshold.
Chose to enlarge and weight the active pill's label (`text-sm font-semibold`,
14px+ semibold) rather than darken the pill, so the same active-pill token
and blue read stays identical between light and dark mode. 14px semibold
white-on-`#4d7cff` clears the WCAG large-text (14pt bold / 18pt regular)
3:1 threshold with margin.

**Other Phase 0 auditor findings fixed in this phase:**
- `app/globals.css`: the dark-palette block comment said "the same 17
  properties each" — corrected to 25 (9 base + 8 category + 8
  nav/ink/attention roles), matching the current two dark-selector bodies.
- `components/ui/CollapsedBar.tsx`: added an explicit
  `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40`
  to its button, matching the focus-visible ring style used elsewhere in
  `components/ui/`.

### `components/ui/PageShell.tsx` (Phase 2) — status: Phase 2, done
- Props: `label`, `title`, `pulse`, `actions`, `headerExtra`, `rail`,
  `maxWidth`, `workspaceTestId` — **preserved**, unchanged shape;
  `tests/ui/page-shell.test.tsx` passes unmodified. New `subtitle?` prop
  added (optional, additive).
- Two named variants: `shell:` (900px custom variant) and `rail:` (1200px
  custom variant, two-column grid with `stretch` alignment) — **untouched**,
  arithmetic and classes byte-for-byte as documented in `app/globals.css`.
- Header render path changed to the prototype's language: the internal
  `SectionLabel` call for `label` now passes `variant="eyebrow"` (added in
  Phase 0) instead of the default plain pill; serial order is now eyebrow →
  serif `h1` → optional `subtitle` paragraph → `headerExtra`. No call site
  needed updating for this — `label`/`headerExtra` still work exactly as
  before, `subtitle` is opt-in.
- **Deferred decision:** no route was given a `subtitle` this phase. The
  prototype's per-screen subtitle copy ("Outcome: complete the move with
  every dependency confirmed...", "Track the present first, then understand
  where the day went.", etc.) is either fabricated per-project narrative text
  with no backing field on `Project` (no `description`/`outcome` column
  exists) or generic filler not tied to actual route state. Per the phase's
  explicit instruction not to invent marketing copy, `subtitle` ships as
  available plumbing only; a later phase may fill it in only where a truthful,
  data-derived line exists (e.g. Phase 3's focus-band work may surface a real
  per-project outcome once one is captured).

### `components/ui/MetricStrip.tsx` (Phase 2) — status: Phase 2, wired
- First call sites: `components/Today.tsx` (Active/Overdue/Planned/Capacity
  left/Recorded today/Timing) and `app/projects/[id]/page.tsx` (Complete/
  Open/Done/Overdue/Blocked/Estimated/Recorded/Today/Last 7 days, plus a
  second strip for the per-stage counts). Every stat previously shown is
  still shown, same value, same label; only the value/label order flipped
  (MetricStrip renders `<strong>value</strong> label`, the old hand-rolled
  `<dl>` rendered `label value`) to match the shared primitive's own
  convention consistently across the app.
- `app/tracking/page.tsx` and `app/upcoming/page.tsx`, both named in the plan
  as conversion targets, were checked and currently have **no** hand-rolled
  stat row of this kind in the live tree (`app/tracking/page.tsx` only has
  toolbar nav buttons in its header; `app/upcoming/page.tsx` has no header
  stats at all) — the plan's snapshot predates whatever removed them. Nothing
  to convert on either route; noted here so a later phase doesn't assume this
  was missed.

### `app/projects/[id]/page.tsx` (Phases 2, 3) — status: Phase 3, done
- Now renders through `PageShell` instead of its own hand-rolled header —
  eyebrow "Project", serif `h1` carrying the colour dot + project name
  (moved into `title`, unchanged markup/classes), Settings button moved into
  `actions` (`.no-drag`-wrapped automatically by `PageShell`), both stat rows
  moved into `headerExtra` via two `MetricStrip`s — **preserved**, same
  values/labels/conditionals (`overdue`/`blocked` only shown when > 0).
- Board (`components/kanban/`): `useBoardDrag`, column rename, WIP limits,
  `STAGE_KINDS`, add-column, `RemoveStageDialog`'s required-destination
  behaviour, card move menu — **untouched**; `Board` still receives the same
  `project`/`todayISO` props (Phase 3 restyled `Board`/`Column`/`Card` and
  added backlog-collapse state internal to `Board`, without changing this
  call site's props).
- `ProjectSettings` side panel — **preserved**, same `settingsOpen` state and
  `onClose` handler, now opened via the `PageShell` `actions` button.
- Missing-id handling (`if (!project) return null;`) — **preserved**, unchanged;
  there has never been a "Project not found" message, just a silent `null` render.

### `app/tracking/settings/page.tsx` (Phase 2) — status: Phase 2, done
- Now renders through `PageShell` (`label="Tracking settings"`, serif title
  "Configure your taxonomy") instead of a hand-rolled header div — the four
  sections (Categories, Activities, Gap rules, Module order & visibility),
  their descriptive copy, and the loading skeleton before `ready && settings`
  are **preserved** unchanged, only re-parented under `PageShell`'s children.
  Drag-reorder behaviour inside `ModuleOrderSection` etc. is untouched (no
  edits made to any `components/tracking/settings/*` file).

### `lib/focus.ts` (Phase 3, new file) — status: Phase 3, done
- `taskAge`/`isStale` extracted verbatim from `components/TaskRow.tsx`'s
  inline `age`/`stale` computation (`daysBetween(scheduled, today) >
  STALE_AFTER_DAYS`, open tasks only). `TaskRow` now imports both from here
  instead of computing them inline — its visible banner ("Sat here N days." /
  "Still doing it" / "Let it go") is byte-for-byte unchanged, verified by
  `tests/ui/board.test.tsx`'s and `tests/ui/task-panel.test.tsx`'s existing
  overdue/date assertions plus a new `tests/focus.test.ts` unit suite (10
  tests, `npx tsx --test`).
- `getFocusTask(tasks, projectId, running, todayISO)` — running-timer task if
  it belongs to the project, else the lowest-`rank()` (highest-priority) open
  task due today or overdue in that project; `null` when nothing qualifies.
- `getAttentionItems(tasks, stages, projectId, todayISO)` — two disjoint
  buckets rather than a naive union: tasks in a **non**-waiting-kind stage
  that are overdue by the scheduled-date rule (reason `"overdue"`), plus
  tasks in a **waiting**-kind (`kind === "blocked"`) stage that are stale by
  `isStale` (reason `"stalled-waiting"`). **Deferred decision:** a task can
  satisfy both rules at once (staleness always implies its scheduled date has
  passed), so waiting-kind stages are judged on staleness only and excluded
  from the date-overdue bucket — otherwise every stalled-waiting item would
  double as "overdue" and the two labels the plan asks for would never be
  visually distinct. No schema change; both functions are pure and derive
  everything from existing `Task`/`ProjectStage` fields.

### `components/TaskRow.tsx` (Phase 3 touch, ahead of Phase 8) — status: preserved
- Only the `age`/`stale` computation lines changed (now call `taskAge`/
  `isStale` from `lib/focus.ts`); the stale banner's markup, copy, and the
  "Still doing it" (`patchTask(id, { scheduled: todayISO })`) / "Let it go"
  (`trashTask(id)`) handlers are untouched. Phase 8 still owns the rest of
  this file's token sweep.

### `components/Today.tsx` (Phase 3 touch, reuse) — status: preserved
- The inline "Up next" hero block (inverted `bg-foreground` card, dot
  texture, tag pill, serif title, meta row, "Mark done"/"Not today" actions)
  is now rendered through the new `components/ui/FocusCard.tsx` with
  `surface="foreground"` (its prior token) and `density="regular"` (its prior
  `lg:` breakpoint classes) — the extraction reproduces the exact previous
  class list, so Today's visual output and behaviour (`completeTask`,
  `patchTask(id, { scheduled: addDays(todayISO, 1) })`) are unchanged. No
  other part of `Today.tsx` was touched.

### `components/ui/FocusCard.tsx` (new) — status: Phase 3, done
- Extracted, parameterised version of Today's former inline "Up next" card:
  `tag`, `title`, `meta` (array), `primaryLabel`/`onPrimary`,
  `secondaryLabel`/`onSecondary`, `surface` (`"foreground" | "ink"`),
  `density` (`"regular" | "compact"`). `surface="ink"` uses the Phase 0
  `--color-ink` token (`bg-ink`); `density="compact"` swaps the `lg:`
  breakpoint rules for `shell:` ones so the project workspace's copy fits the
  one-viewport budget. Call sites: `Today.tsx` (`foreground`/`regular`,
  unchanged output) and `app/projects/[id]/page.tsx` (`ink`/`compact`, new).

### `components/ui/AttentionPanel.tsx` (new) — status: Phase 3, done
- The prototype's warm `.attention` card: Phase 0's `--color-attention` /
  `--color-attention-surface` / `--color-attention-border` tokens, a left
  accent border, one row per `AttentionItem` (dot + title + reason detail),
  each row opening the shared task panel via `openTask` — the same click
  pattern `components/today/TaskGroup.tsx` uses elsewhere, not a new one.
  Renders a quiet empty-state line when `items` is empty. No hardcoded
  colours; the reason text uses `text-muted-foreground` (no attention-specific
  muted token exists yet in Phase 0's palette).

### `app/projects/[id]/page.tsx` — Phase 3 additions (continued from above)
- New focus band above "Active work": `SectionLabel` "Do next", then a
  `focus-grid`-style two-column row (`FocusCard` `surface="ink"` +
  `AttentionPanel`) built from `getFocusTask`/`getAttentionItems`. "Start Nm"
  goes through the existing `startTimer`/`stopTimer` store actions (the same
  path `components/TimerButton.tsx` uses, not a new one) — toggles to "Stop
  timing" while that task is running; "Mark done" calls the existing
  `completeTask`. When nothing qualifies for focus, a quiet dashed
  placeholder renders instead and the whole band is omitted when there is
  also nothing to flag (`focusTask === null && attentionItems.length === 0`).
  The band, the new "Active work" `SectionLabel`, and the board's own
  `-mx-6.../px-6...` bleed comment/classes (fixed in Phase 2) are all
  **preserved** unchanged.
- Viewport fit: children are now wrapped in `shell:flex shell:h-full
  shell:min-h-0 shell:flex-col`; the focus band and "Active work" head are
  `shell:shrink-0`, and only the board's own wrapper div is
  `shell:min-h-0 shell:flex-1 shell:overflow-y-auto` — so at `shell:` and up
  only the board scrolls internally while the rest of the page stays fixed,
  without editing `PageShell`'s own `shell:`/`rail:` arithmetic (unmodified;
  its outer `shell:overflow-y-auto` becomes inert here because the inner
  column now exactly fills the available height instead of overflowing it).
  Below `shell:`, everything is ordinary document flow, unchanged.
- All 9 header stats (`Complete`/`Open`/`Done`/`Overdue`/`Blocked`/
  `Estimated`/`Recorded`/`Today`/`Last 7 days`), the per-stage `MetricStrip`,
  the colour dot + project name, `Board`, and `ProjectSettings` — **preserved**
  verbatim from Phase 2; only new JSX was added around them, none of their
  props or conditionals changed.
- New tests: `tests/ui/project-focus.test.tsx` (5 tests) covering
  focus-task selection (priority fallback, running-task precedence),
  attention-list contents, the empty-state placeholder, and that the board's
  columns/counts still render alongside the new band.

### `components/kanban/Board.tsx` (Phase 3) — status: Phase 3, done
- Backlog-kind (`stage.kind === "backlog"`) columns can now collapse into the
  new `components/ui/CollapsedBar.tsx` via a per-stage toggle, persisted
  through the **same** `settings.collapsedModules`/`patchSettings` path
  `Today.tsx`'s rail panels already use (key: `` `board-backlog-${stageId}` ``)
  — not a second collapse mechanism. Nothing is collapsed by default, so
  `tests/ui/board.test.tsx` (which asserts the Backlog column renders as a
  normal region with a visible rename input and remove button) passes
  **unmodified** — verified by running it after this change.
- `useBoardDrag`, `moveTask`/`onMove`, column rename, WIP limits, the
  over-limit warning (unchanged — this file never implemented one; noted in
  case a later phase assumes it exists here), `STAGE_KINDS`, add-column,
  `RemoveStageDialog`'s required-destination rule, and the card move menu —
  all **untouched**, same props/handlers passed to `Column`/`Card`.
- The bleed comment and its `-mx-6.../sm:-mx-10.../shell:-mx-8.../xl:-mx-10...`
  breakpoint-matched steps (fixed in Phase 2) are **preserved** byte-for-byte.

### `components/kanban/Column.tsx` (Phase 3) — status: Phase 3, done
- New optional `onCollapse?: () => void` prop, set by `Board` only for
  backlog-kind stages; renders one extra `‹›` icon button in the header
  (labelled `Collapse ${stage.name} column`) next to the existing rename
  input and `×` remove button — both **preserved**, unchanged handlers.
  `rounded-2xl` → `rounded-xl` and `bg-muted/40` → `bg-muted/50` (soft-grey
  column treatment per the prototype); no other class or behaviour changed.

### `components/kanban/Card.tsx` (Phase 3) — status: Phase 3, done
- Purely cosmetic: `rounded-xl` → `rounded-lg` and added
  `motion-safe:hover:-translate-y-0.5` (the prototype's `.task:hover
  {transform:translateY(-1px)}`). `openTask`, `TimerButton`, the move menu,
  overdue-in-words, complex-task range display, and subtask/priority/running
  meta are all **untouched**.

### `components/ui/CollapsedBar.tsx` (Phase 0 → wired in Phase 3)
- First call site: `components/kanban/Board.tsx`'s collapsed backlog-kind
  column (`label`=stage name, `count`=stage task count, `onExpand`=the same
  `patchSettings` toggle used to collapse it). `expandLabel` left at its
  default ("Expand").

### `components/calendar/*`, `components/time/HourGrid.tsx` (Phase 4) — status: restyled, capabilities preserved
- `useDragReschedule` and its a11y announcements — **preserved**, untouched
  (`components/calendar/useDragReschedule.ts` not edited; `MonthGrid`/`WeekGrid`
  still call it identically).
- `?view=` / `?date=` URL contract in `app/calendar/page.tsx` — **preserved**,
  untouched.
- Multi-day complex-task spans — **preserved** (`tasksByDate` construction in
  `app/calendar/page.tsx` untouched).
- iCloud external-event overlay rendered as a distinct neutral chip —
  **preserved**: `data-external-event` markers keep their dashed-border,
  no-drag, no-click, muted-text treatment in `MonthGrid`, `WeekGrid`, `DayGrid`.
- `tests/ui/calendar.test.tsx` behavioural contract — **preserved unmodified**,
  all 18 tests pass, including the `.min-h-6` untimed-chip-strip selector and
  the `2026-03-12, 0 tasks` aria-label WeekGrid's test depends on.
- `tests/ui/external-events-hook.test.tsx` — **preserved unmodified**, 6 tests
  pass.
- `components/time/HourGrid.tsx` `HourGridBox`/`HourGrid`/`HourRail` — **moved
  to**: same file, now also gives the box an explicit `bg-card` (previously
  transparent) and restyles the now-line to a `bg-now` 1px line with a small round dot, matching the prototype's `.nowline`.
  `components/tracking/modules/RibbonModule.tsx` (the ribbon call site) was
  re-checked before and after: unchanged props, unchanged behaviour, only
  inherits the restyled box/now-line — its geometry, gap/segment blocks and
  waking-hours crop toggle are untouched.
- `components/calendar/WeekGrid.tsx` — restyled: outer `calendar-shell`
  treatment (bordered, rounded, card-background wrapper around the sticky
  hour rail + day columns), today's day-head at `bg-accent/10`, timed event
  chips now render with a 3px left accent bar in the task's project colour
  over a tinted (`color-mix`) card background instead of a solid fill —
  closer to the prototype's `.event`/`.event.orange` chip while still
  encoding each task's own project colour rather than only two hardcoded
  hues. Untimed dot markers, the `.min-h-6` chip strip, drag/drop wiring,
  and the sticky hour rail are all unchanged.
- `components/calendar/DayGrid.tsx` — restyled: the hour-rail + hour-grid-box
  row now sits inside a bordered/rounded/card-background wrapper (the
  `.calendar-day`/`.day-agenda` shell), and timed task chips get the same
  left-accent-bar + tinted-background treatment as `WeekGrid`. The untimed
  task list, "Add a task on this day" button (now focuses the rail's
  `[data-day-add-input]` in day view, falling back to `onSelectDay`; it never
  adds inline), and the no-drag/no-`useDragReschedule` behaviour for
  this view are all unchanged — verified by `tests/ui/calendar.test.tsx`'s
  "day calendar" describe block.
- `components/calendar/MonthGrid.tsx` — restyled: today cell background
  bumped from `bg-accent/5` to `bg-accent/10` for consistency with the other
  two grids; drag/drop, complex-task span rendering across days, and the
  external-event dashed chips are unchanged.
- `components/calendar/DayPanel.tsx` — its interior (add input, task list,
  "Move date" control, and the read-only "From Apple Calendar" section) is
  now factored into a new named export `DayPanelBody`, with the default
  `DayPanel` export unchanged in behaviour: it still wraps that body in
  `SidePanel` exactly as before (`role="dialog"`, focus trap, Escape-to-close,
  same test ids/labels) — verified by `tests/ui/calendar.test.tsx`'s "day
  panel" and "imported Apple Calendar events" describe blocks, all passing
  unmodified.
- **New**: Day view (`?view=day`) now uses `PageShell`'s existing `rail` prop
  — `app/calendar/page.tsx` passes a `Panel`-chromed (`components/ui/Panel.tsx`,
  from Phase 0) rail containing `DayPanelBody` for the day currently shown,
  giving the day screen the prototype's "agenda column + side rail" shape
  (`.calendar-day`/`.day-side`) without a second implementation of the
  add/list/move-date affordances. `PageShell`'s `shell:`/`rail:` grid
  arithmetic was not touched. Month and week views pass no `rail`, so their
  layout is unchanged; the click-to-open `DayPanel` modal still exists for
  month and week (clicking a day opens it). In DAY view it is deliberately
  suppressed: the rail renders the same `DayPanelBody` for the day on screen,
  so mounting the modal too would put two copies of the day's add input in
  one document. Nothing the modal offered is lost — the rail carries the task
  list, add, "Move date" and the read-only Apple Calendar section.

### `components/tracking/*` (Phase 5) — status: restyled, capabilities preserved
- `TaskPicker` / `CategoryPicker` — **untouched**, not edited by this phase.
  Portal behaviour (clipping fix from the prior plan's Phase 5) verified
  still intact; `tests/ui/tracking-pickers.test.tsx` passes unmodified.
- `ModuleCard` collapse state + its backfill migration — **untouched**
  (`ModuleCard` was already a thin `Panel` wrapper from Phase 0; not edited
  this phase). Module chrome for every tracking module still goes through
  `Panel`/`ModuleCard`, never a parallel implementation.
- User module order and visibility (`app/tracking/page.tsx`'s
  `moduleOrder`/`hiddenModules` split, `MODULE_COLUMN`/`MODULE_TITLE`) —
  **preserved**, `app/tracking/page.tsx` not edited this phase.
- Gap-fill one-tap action (`UnaccountedModule` → `fillGap`) — **preserved**:
  the per-gap quick-fill buttons still call `fillGap` with the same
  arguments, now rendered as `ActivityPill` (new, see below) inside a
  `PanelRow` instead of the previous bespoke button markup. "Something
  else…" still expands `GapFillForm` inline.
- Editable `RecordsModule` table — **untouched**, not edited this phase.
- Empty state when no categories exist (`app/tracking/page.tsx`'s
  `categories.length === 0` branch) — **preserved**, not edited.
- Tracking-day boundary paging (`app/tracking/page.tsx`'s `‹ / Today / ›`) —
  **preserved**, not edited.
- `tests/ui/tracking-pickers.test.tsx` — **preserved unmodified**, passes.

**New**: `components/tracking/ActivityPill.tsx` — the prototype's `.pill`
treatment (bordered, `bg-card`, compact), factored out of the duplicated
button markup previously hand-rolled in both `NowModule`'s quick-start row
and `UnaccountedModule`'s per-gap fill row. Both now render this one
component; `active`/`disabled` and the `onClick` contract (start an
activity, or fill a gap) are unchanged.

**New**: `components/ui/PanelRow.tsx` — the prototype's `.panel-row`
treatment (headline + quiet detail line, top-border-separated, no border on
the first row). Shared by `UnaccountedModule` (one row per gap: time range,
duration + reason, quick-fill pills, and the "Something else…" expansion)
and `SignalsModule` (one row per signal: Coverage, Longest stretch, Most
fragmented, By kind).

- `components/tracking/modules/NowModule.tsx` — the running/idle summary
  row is now the prototype's `.timer` block: a `bg-ink`/`text-ink-foreground`
  surface (Phase 0's ink tokens; no `text-background` used against it) with
  a round play/stop control on the left and a large `font-mono text-xl`
  elapsed readout on the right. Stop is now an icon button
  (`aria-label="Stop"`) instead of a text button — same `stopSegment()` call.
  Idle state keeps the identical block shape with a disabled-looking play
  glyph, "Start a focused activity" / "Pick a task or a category below" in
  place of the live label, and "00:00". The task picker (`TaskPicker`,
  `size="lg"`) and quick-start chips below are unchanged in structure, only
  the chips now render via `ActivityPill`.
- `components/tracking/modules/RollupsModule.tsx` — gains the prototype's
  "Today at a glance" three-up `.stat-row` at the top (`Stat`, a new
  file-local component: `font-display` value over a `MetaLabel`, on a
  `bg-muted` card) showing Accounted (sum of `recordedMinutesForCategory`
  across categories with recorded time), Focus (`minutesByKind(...).work`),
  and Unaccounted (sum of the day's `gaps[].minutes` from `useTasks()`). The
  existing coverage bar, per-category rundown and per-project rundown below
  it are **unchanged** — this is additive, not a replacement.
- `components/tracking/modules/SignalsModule.tsx` — restyled from a 2×4 stat
  grid to four `PanelRow`s (Coverage, Longest stretch, Most fragmented, By
  kind), same underlying `coveragePercent`/`longestStretchMinutes`/
  `mostFragmentedHour`/`minutesByKind` calls, values now shown as each row's
  headline with a plain-language detail line beneath (e.g. "62% of waking
  hours accounted for") in place of the previous label/value pairing.
- `components/tracking/modules/UnaccountedModule.tsx` — each gap is now one
  `PanelRow` (dashed-box-per-gap list replaced with the shared panel-row
  list), keeping the clock-range headline, duration + overnight/reason
  detail line, the quick-fill `ActivityPill`s, the "Something else…" toggle,
  and the inline `GapFillForm` expansion all intact.
- `components/tracking/modules/RibbonModule.tsx`, `components/time/HourGrid.tsx`
  — **not touched this phase**; Phase 4 already gave the ribbon box its
  `bg-card` surface and `bg-now` now-line, and `RibbonModule` already renders
  it inside `ModuleCard`/`Panel` chrome with the hour rail beside the track,
  matching the prototype's `.ribbon`/`.ribbon-hours`/`.ribbon-track` shape —
  verified, no changes required.

### `app/upcoming/page.tsx` (Phase 6) — status: untouched
- Grouped-list rendering (kept as the narrow-viewport form).
- `QuickAdd` and its `lib/parse.ts` hint string.

### `app/settings/page.tsx` (Phase 7) — status: untouched
- Server component today; Phase 7 introduces a client child for the nav
  rather than converting the whole page.
- Calendar feed subscribe URL + copy affordance.
- iCloud connected/not-connected states and instructions.
- Sidebar nav visibility controls, including the `UNHIDEABLE_NAV_KEY`
  guarantee.
- `tests/ui/settings.test.tsx` and `tests/ui/nav-visibility.test.tsx` contracts.

### `components/TaskRow.tsx`, `components/TaskPanel.tsx` (Phase 8) — status: untouched
- Inline subtasks, stale banner, hover actions, timer button, recurrence,
  tags, trash/restore — token sweep only, no behavioural change permitted.

### `electron/main.js` and packaging (Phase 9) — status: untouched
- Window vibrancy configuration, traffic-light position, splash background
  in both appearances, `.drag-region` behaviour, `⌘1–5 / ⌘N / ⌘F / ⌘, / ⌘⇧T`
  menu accelerators via `DesktopBridge`.
- `electron-builder` afterPack `.next/node_modules` symlink recreation and
  ad-hoc codesign (`scripts/electron-after-pack.js`).
- User-data path and `migrateLegacyUserData`.

---

## Deferred decisions

None yet — Phase 0 had no undecidable ambiguity requiring a default choice.

## Carried into Phase 8

- **Single-source the project palette.** Phase 4 added `--color-project-1..7`
  (with dark counterparts) and `projectColorVar()` in `lib/types.ts`, but only
  `WeekGrid` and `DayGrid` route through it. Every other project-colour
  surface still paints the raw stored hex, so in dark mode one project shows a
  deep swatch in the sidebar and a lighter bar on the calendar. Phase 8's
  token sweep must extend `projectColorVar()` to the remaining call sites:
  `components/Sidebar.tsx`, `components/TaskRow.tsx`,
  `components/today/TaskGroup.tsx`, `components/calendar/DayPanel.tsx`,
  `app/projects/[id]/page.tsx`, `components/ProjectSettings.tsx`,
  `components/tracking/TaskPicker.tsx`,
  `components/tracking/modules/RecordsModule.tsx`,
  `components/tracking/modules/RollupsModule.tsx` and
  `components/today/DashboardTimeline.tsx` — the last one first, since it
  still paints a solid raw-hex bar with inverted text, the exact pattern
  Phase 4 removed from the calendar.
- **`Move date` buttons share one accessible name.** `DayPanel` renders N
  buttons whose entire accessible name is "Move date". Pre-existing, not
  introduced by this plan; cheap to fix during the Phase 8 sweep.

## Corrections to the plan

- **Phase 3's "WIP limits and the over-limit warning" does not exist.** The
  plan named WIP limits as board behaviour that must survive the Phase 3
  restyle. The layout auditor's Phase 3 review confirmed there is no
  WIP-limit feature anywhere in the codebase — not in `Column.tsx`,
  `Board.tsx`, `useBoardDrag.ts`, `ProjectStage`/`StageKind` types, or any
  test. Nothing was lost during Phase 3; the plan's premise was simply wrong.
  A later phase should not go looking for a WIP-limit mechanism to preserve.
