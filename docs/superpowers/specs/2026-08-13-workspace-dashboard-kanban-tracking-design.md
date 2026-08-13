# Workspace Dashboard, Kanban, Calendar, and Tracking Design

## Goal

Evolve the existing minimalist task manager into a cohesive personal work system with a richer Today dashboard, one customizable Kanban board per project, a month calendar, complete editing, and lightweight progress and time tracking.

The upgrade must preserve the app's quiet visual language and keep tasks as the single shared source of truth across Today, projects, Calendar, and tracking summaries.

## Product Principles

- Preserve the current restrained typography, spacing, color system, sidebar, dark mode, and focus-first tone.
- Prefer useful summaries and direct manipulation over configuration-heavy screens.
- Every user-created object has a visible edit path.
- A task changed in one surface updates every other surface because all views use the same record.
- Ship only one Kanban view per project. Saved or alternative project views are explicitly deferred.
- Keep future planning light: Calendar provides the full month, while Today ends with a compact three-week timeline.
- Avoid opaque productivity scores. Report factual progress, blocked work, estimates, and recorded time.

## Scope

### Included

- Full editing for tasks and projects.
- Customizable project Kanban stages and card ordering.
- A redesigned Today dashboard.
- One autosaved general notepad.
- A separate personal quick to-do checklist with task conversion.
- A month calendar with drag-to-reschedule.
- One active task timer, manual time entry, and editable stopped entries.
- Project progress and time summaries.
- Safe migration of existing projects and tasks.
- Responsive and accessible behavior for all new interactions.

### Deferred

- Multiple or saved Kanban views.
- Week/day calendar modes, external calendar synchronization, and meetings.
- Multi-user collaboration, assignees, comments, notifications, and permissions.
- Dependencies between tasks, full Gantt editing, milestones, and advanced portfolio reporting.
- Billing, productivity scoring, invoicing, and automated time-entry classification.

## Domain Model

### Projects

The existing project record remains the work container. Its name and color are editable. Projects may be archived and restored; permanent deletion remains available behind confirmation and moves surviving tasks to no project.

Creating a project also creates four ordered stages:

1. Backlog
2. In Progress
3. Blocked
4. Done

Each stage belongs to exactly one project and has an ID, name, semantic kind (`backlog`, `active`, `blocked`, or `done`), sort order, and creation time. The semantic kind drives progress and blocked calculations even when a user renames the visible stage.

Users may rename, reorder, add, and remove stages. Removing a non-empty stage requires selecting another stage in the same project as the destination. A project must retain at least one non-done stage and one done stage. At most one stage per project is the canonical done stage.

### Tasks

Tasks retain their existing title, notes, project, tags, scheduled date, optional time, estimate, priority, recurrence, status, subtasks, order, and timestamps. They gain an optional `stageId` and a separate per-stage `boardOrder`.

- A project task must reference a stage belonging to that project.
- A task moved to the canonical done stage is completed and receives `completedAt`.
- Completing a task from any other surface moves it to the project's canonical done stage.
- Reopening a completed project task moves it to the first non-done stage.
- Moving a completed task out of the done stage reopens it.
- A task in a stage whose semantic kind is `blocked` is counted as blocked. No separate boolean can drift from board state.
- Tasks without a project have no stage and continue to work in Today, Calendar, All Tasks, and other smart lists.

Existing project tasks migrate into default stages: completed tasks go to Done and other tasks go to Backlog. Existing unassigned tasks remain unassigned.

### General Note

There is exactly one general note for the owner. It stores plain text plus an update timestamp. Today edits it using debounced autosave with Saved, Saving, and Couldn't save feedback. Rich text, attachments, and daily note history are outside scope.

### Quick To-dos

Quick to-dos are intentionally separate from full tasks. Each has an ID, title, completed state, sort order, and timestamps. Users can add, rename, complete/reopen, reorder, and delete them.

Converting a quick to-do creates a full task scheduled for today with the existing default estimate and priority rules, then removes the source quick to-do only after task creation succeeds. The created task can be edited immediately in the shared task panel.

### Time Entries

A time entry belongs to one task and contains start time, optional end time, computed duration, optional note, and timestamps. A running entry has no end time.

- Only one running entry may exist across the application.
- Starting a timer while another runs requires stopping the current timer first; the UI identifies that task and offers a single stop-and-start action.
- Stopping computes elapsed whole minutes with a minimum recorded duration of one minute.
- Users may create manual entries by date, duration, and optional note.
- Stopped and manual entries are editable and deletable.
- Running entries may be stopped, but not retrospectively edited until stopped.
- Task and project totals include stopped/manual entries only; the live timer displays elapsed time separately.

Database enforcement must prevent two concurrent running entries, not merely rely on client state.

## Application Structure

### Shared Client State

The existing provider remains the client coordination boundary, but it is split into focused domain modules as it grows. Tasks, projects, stages, quick to-dos, the note, and time entries expose typed operations through one workspace-facing interface.

The database remains authoritative. Direct interactions use optimistic updates where reversal is deterministic, including task edits, Kanban movement, calendar rescheduling, and checklist toggles. A failed request restores the previous value and presents a concise error. Creation, conversion, destructive actions, and timer transitions wait for server confirmation when optimistic behavior could duplicate or lose data.

### API Validation

Every mutation validates required fields, enum values, dates, times, durations, record ownership relationships, and cross-record invariants. Invalid input returns a specific 400 response; missing records return 404; invariant conflicts such as a second active timer return 409; unexpected persistence failures return 500 without exposing database details.

Compound mutations are transactional:

- Project creation plus default stages.
- Stage removal plus movement of its tasks.
- Quick to-do conversion plus source removal.
- Timer stop-and-start transition.
- Task completion/reopening plus stage transition and recurrence creation.

## Interaction Design

### Shared Task Detail Panel

Clicking a task card or row opens a right-side detail panel on desktop and a full-height sheet on small screens. The panel is used from Today, Kanban, Calendar, search, and smart lists.

It exposes editable title, notes, project, stage, scheduled date, optional time, estimate, priority, tags, recurrence, and subtasks. It also contains timer controls, estimate-versus-recorded time, editable time-entry history, completion/reopen, and trash actions.

Common actions such as complete, push to tomorrow, start/stop timer, and Kanban drag remain inline. The panel uses explicit save-on-blur or debounced save depending on the field and shows pending/error state without blocking unrelated fields.

Changing a task's project selects that project's Backlog stage by default. Removing the project clears the stage. Trash is recoverable through the existing Trash surface.

### Project Editing

The project header provides an explicit settings action rather than relying only on clicking the title. Its compact panel edits name, color, and archive state. Permanent deletion requires confirmation and clearly states that tasks become unassigned.

Stage management lives beside the board. Column names edit inline; drag handles reorder columns. Adding a column asks for a name and semantic kind. Removing a column follows the safe destination rule from the domain model.

### Today Dashboard

Today remains the landing page and retains the existing prominent Up Next treatment. On desktop it uses a restrained main-and-utility layout; on smaller screens it becomes a single vertical flow.

The page contains:

- Date, greeting/summary, active count, overdue count, planned time, and remaining capacity.
- Ranked My Tasks area with Up Next and the remaining actionable work.
- Separate Due Today and Blocked summaries, each linking/opening the relevant tasks.
- General autosaved notepad.
- Personal quick to-do checklist and conversion action.
- Compact three-week timeline at the bottom.

The three-week timeline spans one week before today through two weeks after today, places scheduled tasks by date, distinguishes weekends, and marks today. It is an overview and navigation aid: selecting an item opens its task panel and selecting an empty date links to Calendar/day creation. It does not resize durations, create dependencies, or support Gantt editing.

### Project Kanban

Every project route becomes its single Kanban board. The header contains project identity, factual progress summary, Add Task, and stage management. The board scrolls horizontally when necessary.

Each column displays its task count and compact task cards. Cards show title, scheduled/overdue state, priority, estimate, recorded time, subtask progress, and a running-timer indicator when relevant. Users can:

- Add a task directly into a column.
- Drag cards within a column to reorder.
- Drag cards between columns to change stage.
- Open any card in the shared detail panel.
- Complete/reopen through the canonical done-stage rules.

Keyboard users receive equivalent move controls from the card menu. Drag operations announce their result through an accessible live region.

### Calendar

Calendar is a dedicated sidebar destination with one month view. The header supports previous month, next month, and Today navigation. The seven-column grid includes adjacent-month days in a muted style and uses project colors for task markers.

Selecting a date opens a compact day panel listing its tasks and an Add Task action prefilled with that date. Selecting a task opens the shared task detail panel. Dragging a task marker to another date updates its scheduled date while preserving its optional time. Failed moves return the marker to its original date and show an error.

Mobile replaces cross-grid dragging with an accessible Move Date action in the task/day panel while retaining the month overview.

### Tracking Summaries

Tracking is integrated rather than a separate analytics product.

The project header/summary area reports:

- Open and completed task counts.
- Percentage complete, calculated as completed non-trashed tasks divided by all non-trashed project tasks.
- Counts by stage.
- Overdue open tasks.
- Blocked tasks.
- Total estimated minutes versus recorded minutes.
- Recorded time today and over the trailing seven days.

The Today header shows planned task estimates, capacity remaining, recorded time today, and the currently running task. A persistent compact timer strip appears when a timer is active so it can be stopped from any page.

These summaries are derived from tasks, stage semantics, and time entries. No separate project-health value is stored.

## Navigation and Responsive Behavior

The sidebar destinations become Today, Calendar, Next 7 Days, All Tasks, Completed, and Trash, followed by projects. Search remains available. The current desktop sidebar and mobile drawer patterns remain.

Desktop task details use a right-side panel without navigating away. Mobile uses a modal sheet with focus trapping, escape/back dismissal, and restoration of focus to the triggering control. Kanban permits horizontal scrolling; Today and Calendar avoid desktop-only fixed widths.

## Accessibility

- All editing controls have visible labels or programmatic names.
- Panels and confirmation dialogs manage focus correctly.
- Drag-and-drop has keyboard alternatives.
- Autosave, timer, and drag results use polite live announcements.
- Color is never the sole indicator of project, stage, priority, overdue, or completion state.
- Touch targets are at least 44 by 44 CSS pixels for primary mobile controls.
- Existing reduced-motion behavior applies to all new transitions.

## Persistence and Migration

The idempotent schema gains project stages, the task stage/order fields, the singleton note, quick to-dos, and time entries. Migration statements must work in both external Postgres and PGlite.

Migration is additive and preserves all existing records. Default stages are created for every existing project before project tasks are assigned. Constraints and indexes are added only after backfill succeeds. Re-running startup migration must not duplicate stages or change existing user customization.

The application must tolerate the migration running on a populated database. Migration/backfill behavior receives automated coverage against a temporary PGlite database.

## Error and Empty States

- Empty Today keeps the current encouraging tone and still shows the notepad, quick to-dos, and timeline.
- Empty projects show their stages and an obvious first-task action.
- Empty calendar days offer task creation rather than a blank dead end.
- Autosave failure preserves unsaved text locally and offers retry.
- Timer conflicts identify the currently running task.
- Stage deletion cannot proceed until a valid destination is selected.
- Recoverable task deletion continues to use Trash; permanent deletion remains confined to Trash.

## Testing and Verification

### Automated Domain and API Coverage

- Idempotent migration and backfill for existing projects/tasks.
- Stage CRUD, ordering, semantic constraints, and safe removal.
- Task edits and project/stage invariants.
- Completion, reopening, recurrence, and canonical done-stage transitions.
- General note loading and autosave updates.
- Quick to-do CRUD, ordering, and transactional conversion.
- Calendar date updates.
- Single-active-timer database constraint, start/stop transition, manual entries, edits, and totals.
- Project summary calculations for empty, active, blocked, overdue, and completed projects.

### Interaction Coverage

- Opening and editing a task from each major surface.
- Optimistic edit rollback on API failure.
- Kanban card movement and keyboard alternative.
- Calendar drag rescheduling and mobile Move Date fallback.
- General-note save states.
- Quick to-do editing and conversion.
- Active timer strip and conflicting timer flow.
- Stage removal destination flow.
- Responsive panel/sheet behavior and focus management.

### Release Gates

Each implementation phase must pass its focused tests, the full test suite, lint, and a production build. Final verification also exercises a populated PGlite database, desktop and mobile layouts, light and dark themes, keyboard-only task movement, and persistence after reload.

## Delivery Sequence

1. Add migration-safe domain types, schema, stores, validation, and APIs for stages, note, quick to-dos, and time entries.
2. Add the shared task detail panel and explicit project editing so every existing object is editable before new views depend on it.
3. Replace project lists with customizable single-view Kanban boards.
4. Build the richer Today dashboard, general note, quick to-dos, and three-week timeline.
5. Add the month Calendar with day inspection and rescheduling.
6. Complete timer surfaces and project/Today tracking summaries.
7. Run responsive, accessibility, failure-state, migration, and production-build hardening.

## Execution Recommendation

Use GPT-5.6 Terra at Medium reasoning for task-by-task implementation. The implementation plan must use small independent tasks, exact interfaces, focused tests, and verification checkpoints. Raise only the final cross-feature review—or a genuinely tangled migration/debugging task—to High. Max and Ultra are unnecessary for this scope.
