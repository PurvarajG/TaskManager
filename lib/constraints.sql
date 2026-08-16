-- Applied only after lib/migrate.ts has backfilled existing rows, because each
-- of these would reject a populated database that predates the workspace
-- upgrade. Still fully idempotent, so cold starts after the first are no-ops.

-- At most one canonical done stage per project.
create unique index if not exists project_stages_one_done
  on project_stages (project_id) where kind = 'done';

-- At most one running time entry across the whole app: `running_lock` is true
-- while running, NULL otherwise, and NULLs do not collide in a unique index.
create unique index if not exists time_entries_one_running
  on time_entries (running_lock);

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
