# Today Timeline Defect Fixes — Implementation Plan

> **For agentic workers:** This plan is designed for **parallel subagent execution**. Three
> workstreams (W1, W2, W3) own **disjoint file sets** and can run concurrently in the same
> working tree with no merge conflicts. A fourth phase (W4) integrates and verifies.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix four defects found by live QA of the Today dashboard timeline against the local
dev database, without changing task/scheduling data contracts.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, Vitest +
Testing Library (`npm run test:ui`), node:test (`npm run test:unit`).

---

## Evidence (from live QA at 1440x900 against the PGlite dev DB)

| # | Defect | Root cause | Fixed in |
|---|---|---|---|
| 1 | Two tasks at the same time render **exactly on top of each other**; the lower one is unclickable (Playwright click timed out on it) | `TimeBar` is `absolute top-2` with no collision handling — `components/today/DashboardTimeline.tsx:88-94` | W1 |
| 2 | A task quick-added with a **new** `#project` **vanishes** from the day-scale timeline until a full page reload | POST `/api/tasks` creates the project server-side, but the client `projects` state is never updated, so no lane matches the task's `projectId` — `components/today/DashboardTimeline.tsx:97` + `lib/store-context/use-tasks.ts:36-53` | W2 (+ W1 hardening) |
| 3 | Untimed task chips each take a **full row** instead of packing side by side | `TaskButton` is `block w-full` inside a `flex flex-wrap` strip — `components/today/DashboardTimeline.tsx:107` and `:85` | W1 |
| 4 | Every auto-created project is the **same blue**, defeating the timeline's colour grammar | `findOrCreateProjectByName` → `addProject` hardcodes `"#0052ff"` — `lib/store/projects.ts:28` | W3 |

Measured proof for #1 — both bars returned identical rects:
```
{"title":"Overlap test A","rect":{"x":572,"y":484.8,"width":57,"height":32}}
{"title":"Overlap test B","rect":{"x":572,"y":484.8,"width":57,"height":32}}
```

---

## Global Constraints

- **Frontend + store only.** No schema migrations, no task/scheduling contract changes.
- **Do not change the POST `/api/tasks` response shape.** W2 fixes the client instead (see W2
  Task 1 rationale) — this keeps blast radius off `components/QuickAdd.tsx`,
  `components/calendar/DayPanel.tsx`, and `components/kanban/Column.tsx`.
- Desktop target stays 1440x900 with no document-level scroll; mobile stays normal flow.
- Existing behaviour that must not regress: hour-scale view at spans 1-3, day-scale project
  lanes at spans 5+, `openTask` on chip click, `/calendar?date=` day links.
- **jsdom computes no layout.** `getBoundingClientRect()` returns zeros in Vitest. Assert on
  inline styles and classes, never on measured pixel widths. Visual proof belongs in W4.

## Workstream ownership (respect this — it is what makes parallel execution safe)

| Workstream | Owns exclusively | May read |
|---|---|---|
| **W1** Timeline rendering | `components/today/DashboardTimeline.tsx`, `tests/ui/dashboard-timeline.test.tsx` | everything |
| **W2** Project propagation | `lib/store-context/use-tasks.ts`, `tests/ui/harness.tsx`, `tests/ui/quick-add-project.test.tsx` (new) | everything |
| **W3** Project colours | `lib/store/projects.ts`, `tests/projects.test.ts` (new) | everything |

**No workstream may edit a file owned by another.** If you believe you need to, stop and
report it in your completion summary instead of editing.

---

## W1: Timeline rendering (defects 1 + 3, plus orphan-lane hardening)

**Files:** Modify `components/today/DashboardTimeline.tsx`; modify
`tests/ui/dashboard-timeline.test.tsx`.

### Task 1.1: Stack overlapping timed tasks into columns

- [ ] **Step 1: Write the failing test**

```tsx
test("stacks tasks that share a time slot instead of overlapping them", async () => {
  const a = makeTask({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", scheduled: "2026-08-14", dueTime: "11:00", minutes: 60, title: "Overlap A" });
  const b = makeTask({ id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", scheduled: "2026-08-14", dueTime: "11:00", minutes: 60, title: "Overlap B" });
  const view = renderWorkspace(<DashboardTimeline todayISO="2026-08-14" />, emptyWorkspace({ tasks: [a, b] }));

  await screen.findByRole("button", { name: "Overlap A" });
  fireEvent.change(screen.getByLabelText("Timeline range"), { target: { value: "0" } });

  const bars = view.container.querySelectorAll<HTMLElement>('[data-testid="timeline-bar"]');
  expect(bars).toHaveLength(2);
  // Same horizontal slot, different vertical slot.
  expect(bars[0].style.left).toBe(bars[1].style.left);
  expect(bars[0].style.top).not.toBe(bars[1].style.top);
});
```

- [ ] **Step 2: Run it and confirm it fails** — `npm run test:ui -- tests/ui/dashboard-timeline.test.tsx`.
      Expected failure: both bars have the same `top`.

- [ ] **Step 3: Implement column assignment in `HourLane`**

Add a pure helper above `HourLane` and unit-drive it from the component:

```tsx
/** Greedy interval colouring: each task takes the lowest column free at its start. */
function assignColumns(tasks: Task[]): { task: Task; column: number; columns: number }[]
```

Algorithm:
1. Sort by start minute (`minutesAt(task.dueTime!)`), tie-break by end minute then `id` so
   ordering is deterministic across renders.
2. Walk the sorted list keeping `columnEnds: number[]`. Place each task in the first column
   whose recorded end `<= task.start`; otherwise open a new column.
3. Cut the list into clusters (a cluster ends when a task starts at or after every open
   column's end) and give every task in a cluster the same `columns` value = that cluster's
   column count. This keeps a lone 09:00 task full-height even if 14:00 is triple-booked.

Then in `HourLane`:
- Replace the fixed `h-12` track height with `style={{ height: Math.max(48, maxColumns * 26 + 8) }}`.
- Pass `column` and `columns` into `TimeBar`.

In `TimeBar`, replace `top-2 h-8` with inline geometry:
```tsx
style={{ left: `${left}%`, width: `${Math.max(right - left, 2)}%`, top: 4 + column * 26, height: 22 }}
```
Keep the existing `left`/`right` clamping and the `if (right <= 0 || left >= 100) return null`
guard exactly as they are — the current-time marker and the existing positioning test depend
on that maths.

- [ ] **Step 4:** `npm run test:ui -- tests/ui/dashboard-timeline.test.tsx` — all green,
      including the pre-existing "positions timed tasks by their due time and duration" test
      (its `left`/`width` assertions must still pass unchanged).

### Task 1.2: Let untimed chips pack side by side

`TaskButton` is shared by the unscheduled strip (`flex flex-wrap`, wants intrinsic width) and
by `DayTimeline` cells (stacked, wants full width). Fixing one must not break the other.

- [ ] **Step 1: Write the failing test**

```tsx
test("packs untimed chips side by side rather than one per row", async () => {
  const a = makeTask({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", scheduled: "2026-08-14", title: "Chip A" });
  const b = makeTask({ id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", scheduled: "2026-08-14", title: "Chip B" });
  renderWorkspace(<DashboardTimeline todayISO="2026-08-14" />, emptyWorkspace({ tasks: [a, b] }));

  await screen.findByRole("button", { name: "Chip A" });
  fireEvent.change(screen.getByLabelText("Timeline range"), { target: { value: "0" } });

  const strip = screen.getByLabelText("Unscheduled tasks for 2026-08-14");
  for (const chip of strip.querySelectorAll('[data-testid="timeline-bar"]')) {
    expect(chip).not.toHaveClass("w-full");
  }
});
```

- [ ] **Step 2:** Run it, confirm it fails on `w-full`.

- [ ] **Step 3:** Give `TaskButton` a `fill?: boolean` prop. `DayTimeline` cells pass
      `fill`; the unscheduled strip does not. When `fill` is false, use
      `inline-block max-w-[12rem] truncate` in place of `block w-full`. Everything else
      (colour, `line-through` on done, `data-testid`, `title`, `onOpenTask`) stays identical.

- [ ] **Step 4:** Run the file's tests; the existing day-scale test must still pass.

### Task 1.3: Never silently drop a task with an unknown project

Safety net for defect 2 — even with W2 landed, a task must never disappear because client
state is momentarily stale.

- [ ] **Step 1: Write the failing test**

```tsx
test("shows tasks whose project is not loaded yet instead of dropping them", async () => {
  const task = makeTask({ scheduled: "2026-08-14", projectId: "99999999-9999-4999-8999-999999999999", title: "Orphaned work" });
  renderWorkspace(<DashboardTimeline todayISO="2026-08-14" />, emptyWorkspace({ tasks: [task] }));

  await screen.findByRole("button", { name: "Orphaned work" });
  fireEvent.change(screen.getByLabelText("Timeline range"), { target: { value: "3" } });
  expect(screen.getByTestId("day-scale-timeline")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Orphaned work" })).toBeInTheDocument();
});
```

- [ ] **Step 2:** Run it. It fails — the task renders in no lane at span 5.

- [ ] **Step 3:** In `DayTimeline`, treat "has a `projectId` we don't know about" the same as
      "has no project":

```tsx
const known = new Set(projects.map((p) => p.id));
const isOrphan = (task: Task) => !task.projectId || !known.has(task.projectId);
```
Use `isOrphan` both to decide whether the `Unassigned` lane exists and to fill its cells.
Keep the lane's existing name and colour.

- [ ] **Step 4:** `npm run test:ui -- tests/ui/dashboard-timeline.test.tsx && npm run lint`.

- [ ] **Step 5: Commit**
```bash
git add components/today/DashboardTimeline.tsx tests/ui/dashboard-timeline.test.tsx
git commit -m "fix: stack overlapping timeline bars and keep orphaned tasks visible"
```

---

## W2: New quick-add projects reach client state (defect 2)

**Files:** Modify `lib/store-context/use-tasks.ts`, `tests/ui/harness.tsx`; create
`tests/ui/quick-add-project.test.tsx`.

**Rationale for the chosen fix:** `POST /api/tasks` returns a bare `Task`
(`app/api/tasks/route.ts:38`) and three call sites plus the Telegram path depend on that
shape. Rather than widen the response, `addTask` detects a `projectId` it has never seen and
refreshes projects + stages. The extra round trip only happens the first time a `#project`
name is used, which is rare.

### Task 2.1: Make the harness able to mock a *later* response for an already-loaded URL

The existing `respondWith` is checked before the initial-load branch and matches on any
method, so canning `/api/projects` would corrupt the initial workspace load. Add a one-shot
mechanism instead.

- [ ] **Step 1:** Add to `MockFetch`:
```ts
/** Serve `value` for the next single request matching `fragment`, then fall through. */
respondNext: (urlFragment: string, value: unknown, method?: string) => void;
```
Back it with an array of `{ fragment, value, method }`. In the fetch stub, check it **before**
the `failures` loop; on a match, splice that entry out and return `Response.json(value)`.
A `method` of `undefined` matches any method.

- [ ] **Step 2:** Do not change the signature or behaviour of `respondWith`, `failNext`, or
      `calls` — W1 and W3 and five existing test files depend on them. Run the full UI suite
      (`npm run test:ui`) to prove the harness change is inert for existing tests.

### Task 2.2: Refresh projects and stages when an unseen project appears

- [ ] **Step 1: Write the failing test** in `tests/ui/quick-add-project.test.tsx`

Register the canned responses **after** the initial load has settled, otherwise the one-shots
get consumed by the workspace boot fetches.

```tsx
test("a task quick-added with a new #project gets its lane without a reload", async () => {
  const view = renderWorkspace(
    <>
      <QuickAdd />
      <DashboardTimeline todayISO="2026-08-14" />
    </>,
    emptyWorkspace(),
  );

  // Wait for the workspace boot fetches to finish before canning anything.
  await screen.findByPlaceholderText("What needs doing?");

  const project = makeProject({ id: "44444444-4444-4444-8444-444444444444", name: "ops", color: "#db2777" });
  const task = makeTask({ id: "55555555-5555-4555-8555-555555555555", scheduled: "2026-08-14", projectId: project.id, title: "Client call" });

  view.mock.respondNext("/api/tasks", task, "POST");
  view.mock.respondNext("/api/projects", [project], "GET");
  view.mock.respondNext("/api/stages", makeStages(project.id), "GET");

  await userEvent.type(screen.getByPlaceholderText("What needs doing?"), "Client call #ops{Enter}");

  fireEvent.change(screen.getByLabelText("Timeline range"), { target: { value: "3" } });
  expect(await screen.findByText("ops")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Client call" })).toBeInTheDocument();
});
```

- [ ] **Step 2:** Run it, confirm it fails — no `ops` lane appears.

- [ ] **Step 3:** In `useTasksState.addTask`, after `setTasks((prev) => [...prev, created])`:

```ts
if (created.projectId && !projects.some((p) => p.id === created.projectId)) {
  const [freshProjects, freshStages] = await Promise.all([
    request<Project[]>("/api/projects"),
    request<ProjectStage[]>("/api/stages"),
  ]);
  setProjects(freshProjects);
  setStages(freshStages);   // via onStagesCreated-style callback, see below
}
```

Constraints on the implementation:
- **No stale closures.** `addTask`'s `useCallback` deps are currently `[onError]`; add
  `projects` (and whatever stage setter you use). Do not read `projects` from a stale capture.
- `useTasksState` currently receives `onStagesCreated(created: ProjectStage[])`, which
  *appends*. A wholesale replace is wrong for that callback. Either (a) filter the fetched
  stages down to the new project's and pass those to `onStagesCreated`, or (b) thread a
  replace-capable setter through. **Prefer (a)** — it leaves `lib/store-context/index.tsx`
  untouched, which is not a file this workstream owns.
- The refresh must not fail the task creation. Wrap it so a failed refresh logs through
  `onError` but still returns the created task.

- [ ] **Step 4:** `npm run test:ui && npm run lint` — the whole UI suite, not just the new file.

- [ ] **Step 5: Commit**
```bash
git add lib/store-context/use-tasks.ts tests/ui/harness.tsx tests/ui/quick-add-project.test.tsx
git commit -m "fix: load a newly created project into client state after quick-add"
```

---

## W3: Auto-created projects cycle the palette (defect 4)

**Files:** Modify `lib/store/projects.ts`; create `tests/projects.test.ts`.

`PROJECT_COLORS` already exists at `lib/types.ts:141`, and `components/Sidebar.tsx:40` already
cycles it with `PROJECT_COLORS[projects.length % PROJECT_COLORS.length]`. This task moves the
same rule server-side so the quick-add `#project` path matches the sidebar's behaviour.

- [ ] **Step 1: Write the failing test** in `tests/projects.test.ts`, following the
      `node:test` + `freshDb()` shape used by `tests/tasks.test.ts`:

```ts
test("auto-created projects cycle through the palette", async () => {
  const made = [];
  for (let i = 0; i < PROJECT_COLORS.length + 1; i++) {
    made.push((await db.store.addProject({ name: `Project ${i}` })).project);
  }
  assert.deepEqual(
    made.slice(0, PROJECT_COLORS.length).map((p) => p.color),
    [...PROJECT_COLORS],
  );
  // Wraps around rather than running out.
  assert.equal(made[PROJECT_COLORS.length].color, PROJECT_COLORS[0]);
});

test("an explicit colour still wins", async () => {
  const { project } = await db.store.addProject({ name: "Custom", color: "#123456" });
  assert.equal(project.color, "#123456");
});
```

- [ ] **Step 2:** `npm run test:unit` — confirm it fails (every colour comes back `#0052ff`).

- [ ] **Step 3:** In `addProject`, inside the existing `withTransaction`, derive the default
      colour from the current project count before the insert:

```ts
const [{ count }] = await tx.query<{ count: number }>(`select count(*)::int as count from projects`);
const color = input.color ?? PROJECT_COLORS[count % PROJECT_COLORS.length];
```
Pass `color` into the existing insert in place of `input.color ?? "#0052ff"`. Import
`PROJECT_COLORS` from `../types` (that module is already imported here for its types and has
no client-only code).

- [ ] **Step 4:** Verify the `::int` cast actually yields a JS number under PGlite — if the
      driver still hands back a string, coerce with `Number(count)` rather than removing the
      cast. Then run the **full** unit suite: `npm run test:unit`. Pay attention to
      `tests/tasks.test.ts`, `tests/stages.test.ts`, and both migration tests; none should
      assert the old hardcoded default, but confirm rather than assume.

- [ ] **Step 5: Commit**
```bash
git add lib/store/projects.ts tests/projects.test.ts
git commit -m "fix: cycle palette colours for auto-created projects"
```

---

## W4: Integration and verification (runs after W1-W3 report done)

- [ ] **Step 1: Full automated gate**
```bash
npm run test && npm run lint && npm run build
```
Expected: exit 0 for all three. Investigate any failure at the seam between workstreams before
touching individual fixes.

- [ ] **Step 2: Reset the dev database.** The QA session that produced this plan left ~10
      probe tasks and three projects (`design`, `ops`, `eng`) in the local PGlite DB.
```bash
rm -rf .data/pglite   # or: VS Code task "reset dummy db"
```

- [ ] **Step 3: Live visual verification** at `http://localhost:3001`, viewport 1440x900,
      signed in with the dev `APP_PASSWORD` from `.env.development.local`. Re-run the exact
      scenarios that produced the defects:

  1. Quick-add `Overlap A 1h today 11am #design` and `Overlap B 1h today 11am #ops`.
     Set the range slider to 1-3 days. **Expect:** two visibly stacked bars, both clickable,
     each opening its own task panel. (Defect 1)
  2. Watch the new `#design` lane appear at span 5+ **without reloading**. (Defect 2)
  3. Quick-add two untimed tasks on the same day. **Expect:** chips packed on one row.
     (Defect 3)
  4. Confirm `design`, `ops`, and `eng` render in three **different** palette colours in both
     the sidebar and the timeline. (Defect 4)
  5. Re-check mobile width (390x844) still scrolls normally and desktop still fits without
     document-level scroll.

- [ ] **Step 4:** Report results with screenshots. If everything passes, summarise the four
      commits; if anything regressed, name the workstream and file.

---

## Self-review

- **Coverage:** every defect in the evidence table maps to a task, and every task has a failing
  test written before its implementation.
- **Parallelism:** W1/W2/W3 file sets are disjoint, so three subagents can run concurrently in
  one tree without conflicts. W4 is strictly serial after them.
- **Blast radius:** no API contract change, no schema change, no edits to
  `lib/store-context/index.tsx`, `components/QuickAdd.tsx`, `components/calendar/DayPanel.tsx`,
  or `components/kanban/Column.tsx`.
- **Known trap called out inline:** jsdom has no layout engine, so W1's tests assert inline
  style and class values, and pixel proof is deferred to W4's browser pass.
- **Second known trap called out inline:** the harness's canned-response map is consulted
  before the initial-load branch, which is why W2 adds a one-shot `respondNext` and registers
  it only after boot fetches settle.
