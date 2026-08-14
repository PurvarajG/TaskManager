# Today Timeline Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a compact, adjustable day timeline on the Today dashboard that fits a 1440 x 900 desktop viewport without page scrolling.

**Architecture:** Replace the fixed `ThreeWeekTimeline` grid with a self-contained client component that owns range-slider and date-window state while consuming the existing task store. Adjust Today’s desktop layout to create a bounded workspace, retaining its normal-flow layout below the `lg` breakpoint.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, Vitest, Testing Library.

## Global Constraints

- Frontend-only: no task, project, scheduling, or database contract changes.
- Desktop target is a 1440 x 900 viewport with no document-level scrolling; content-heavy panels use internal overflow.
- Mobile remains vertically scrollable and usable.
- Timeline range snap points are exactly `1, 2, 3, 5, 7, 10, 14` days.
- Use existing task store actions (`openTask`) and calendar route (`/calendar?date=YYYY-MM-DD`).
- Respect reduced motion through the project’s existing CSS.

---

### Task 1: Interactive timeline component

**Files:**
- Create: `components/today/DashboardTimeline.tsx`
- Delete: `components/today/ThreeWeekTimeline.tsx`
- Test: `tests/ui/dashboard-timeline.test.tsx`

**Interfaces:**
- Consumes: `todayISO: string`; `useTasks(): { tasks, projects, openTask }`; `shiftDays(iso: string, offset: number): string`.
- Produces: `DashboardTimeline({ todayISO }: { todayISO: string }): JSX.Element`.

- [ ] **Step 1: Write the failing UI tests**

```tsx
it("renders a seven-day span and changes it with the range control", () => {
  render(<DashboardTimeline todayISO="2026-08-14" />, { wrapper: StoreHarness });
  expect(screen.getByText("7 days")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Timeline range"), { target: { value: "0" } });
  expect(screen.getByText("1 day")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:ui -- tests/ui/dashboard-timeline.test.tsx`

Expected: FAIL because `DashboardTimeline` does not exist.

- [ ] **Step 3: Write the minimal component**

```tsx
const SPANS = [1, 2, 3, 5, 7, 10, 14] as const;
const [rangeIndex, setRangeIndex] = useState(4);
const [startISO, setStartISO] = useState(todayISO);
const span = SPANS[rangeIndex];
```

Render `span` day columns from `startISO`, use project-coloured task chips, call `openTask(task.id)` from task chips, and use a `Link` to the date query for each day. Previous and next buttons have accessible labels containing the current span.

- [ ] **Step 4: Run focused tests and lint**

Run: `npm run test:ui -- tests/ui/dashboard-timeline.test.tsx && npm run lint`

Expected: all checks pass.

- [ ] **Step 5: Commit the self-contained timeline**

```bash
git add components/today/DashboardTimeline.tsx components/today/ThreeWeekTimeline.tsx tests/ui/dashboard-timeline.test.tsx
git commit -m "feat: add adjustable Today timeline"
```

### Task 2: Bounded desktop Today workspace

**Files:**
- Modify: `components/Today.tsx`
- Modify: `components/today/DashboardTimeline.tsx`
- Test: `tests/ui/dashboard-timeline.test.tsx`

**Interfaces:**
- Consumes: `DashboardTimeline({ todayISO: string })` from Task 1.
- Produces: an `lg` Today layout with a bounded content region and timeline below utility panels.

- [ ] **Step 1: Extend the failing UI test for the layout contract**

```tsx
expect(container.querySelector("[data-testid=\"today-workspace\"]")).toBeInTheDocument();
expect(container.querySelector("[data-testid=\"today-timeline\"]")).toBeInTheDocument();
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:ui -- tests/ui/dashboard-timeline.test.tsx`

Expected: FAIL because the Today workspace and timeline markers do not exist.

- [ ] **Step 3: Replace the old grid and bound the desktop layout**

In `components/Today.tsx`, import `DashboardTimeline`, replace the `ThreeWeekTimeline` mount, and structure desktop content as a grid with `min-h-0`. Add `overflow-y-auto` only to desktop task and utility regions; keep non-`lg` classes as normal flow. Add `data-testid="today-workspace"` and `data-testid="today-timeline"` markers.

- [ ] **Step 4: Run complete automated checks**

Run: `npm run test && npm run lint && npm run build`

Expected: exit code 0 for all commands.

- [ ] **Step 5: Visually verify in the local app**

At `http://localhost:3001`, inspect Today at 1440 x 900 and mobile width. Confirm desktop does not scroll; all slider spans and arrows work; task chips open their panel; and spare day space opens its calendar date.

- [ ] **Step 6: Commit the dashboard layout**

```bash
git add components/Today.tsx components/today/DashboardTimeline.tsx tests/ui/dashboard-timeline.test.tsx
git commit -m "feat: fit Today dashboard into desktop workspace"
```

## Self-review

- Spec coverage: Task 1 implements the adjustable timeline, every snap point, navigation, task interaction, colours, and calendar links. Task 2 implements the bounded desktop layout and mobile fallback.
- Placeholder scan: no deferred implementation items or unspecified error handling.
- Type consistency: `DashboardTimeline` is consistently declared and consumed with `{ todayISO: string }`; task data stays in existing contracts.
