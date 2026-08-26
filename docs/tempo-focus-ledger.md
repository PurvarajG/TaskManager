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

### `app/projects/[id]/page.tsx` (Phases 2, 3) — status: Phase 2, done
- Now renders through `PageShell` instead of its own hand-rolled header —
  eyebrow "Project", serif `h1` carrying the colour dot + project name
  (moved into `title`, unchanged markup/classes), Settings button moved into
  `actions` (`.no-drag`-wrapped automatically by `PageShell`), both stat rows
  moved into `headerExtra` via two `MetricStrip`s — **preserved**, same
  values/labels/conditionals (`overdue`/`blocked` only shown when > 0).
- Board (`components/kanban/`): `useBoardDrag`, column rename, WIP limits,
  `STAGE_KINDS`, add-column, `RemoveStageDialog`'s required-destination
  behaviour, card move menu — **untouched**, `Board` still receives the same
  `project`/`todayISO` props (Phase 3 restyles `Board`/`Column`/`Card`
  without touching these).
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
