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

### `components/Sidebar.tsx` (Phase 1) — status: untouched
- Search submits to `/search?q=`.
- `NAV` list filtered by `settings.hiddenNavItems`.
- `UNHIDEABLE_NAV_KEY = "settings"` always visible regardless of hide state.
- Inline project create: Enter to submit, Escape to cancel, blur to cancel,
  auto-colour from `PROJECT_COLORS`, redirect to the new project on create.
- Hover `×` delete per project, with confirm.
- `ThemeToggle` and `TempoMark` render inside the rail.
- Drag-region contract: titlebar band keeps `.drag-region`; every interactive
  child (search, nav buttons, project links, delete button, theme toggle)
  keeps `.no-drag` (see `app/globals.css:215-283`'s drag-region comment,
  numbering may shift after Phase 0's additions).

### `components/ui/PageShell.tsx` (Phase 2) — status: untouched
- Props: `label`, `title`, `pulse`, `actions`, `headerExtra`, `rail`,
  `maxWidth`, `workspaceTestId` (all required by `tests/ui/page-shell.test.tsx`
  and every route using `PageShell`).
- Two named variants: `shell:` (900px custom variant) and `rail:` (1200px
  custom variant, two-column grid with `stretch` alignment) — arithmetic
  documented in `app/globals.css`.

### `app/projects/[id]/page.tsx` (Phases 2, 3) — status: untouched
- Currently renders its own header rather than `PageShell` (moves onto it in
  Phase 2).
- Board (`components/kanban/`): `useBoardDrag`, column rename, WIP limits,
  `STAGE_KINDS`, add-column, `RemoveStageDialog`'s required-destination
  behaviour, card move menu (Phase 3 restyles `Board`/`Column`/`Card` without
  touching these).

### `lib/focus.ts` (Phase 3, new file) — status: untouched
- To be extracted from the stale/waiting logic currently living in
  `components/TaskRow.tsx`; `TaskRow` must import from the extracted module
  rather than keep a duplicate.

### `components/calendar/*`, `components/time/HourGrid.tsx` (Phase 4) — status: untouched
- `useDragReschedule` and its a11y announcements.
- `?view=` / `?date=` URL contract.
- Multi-day complex-task spans.
- iCloud external-event overlay rendered as a distinct neutral chip.
- `tests/ui/calendar.test.tsx` behavioural contract.

### `components/tracking/*` (Phase 5) — status: untouched
- `TaskPicker` / `CategoryPicker` portal behaviour (clipping fix from the
  prior plan's Phase 5 must not regress).
- `ModuleCard` collapse state + its backfill migration.
- User module order and visibility.
- Gap-fill one-tap action.
- Editable `RecordsModule` table.
- Empty state when no categories exist.
- Tracking-day boundary paging.
- `tests/ui/tracking-pickers.test.tsx` contract.

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
