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
