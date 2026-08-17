import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Driver, Tx } from "./db";
import {
  AUTH_SETTINGS_ID,
  DEFAULT_ACTIVITIES,
  DEFAULT_CATEGORIES,
  DEFAULT_STAGES,
  FOCUS_WORK_CATEGORY_ID,
  GENERAL_NOTE_ID,
  TRACKING_SETTINGS_ID,
} from "./types";

/** The one default category with a fixed id — see FOCUS_WORK_CATEGORY_ID. */
const FIXED_CATEGORY_IDS: Record<string, string> = { "Focus Work": FOCUS_WORK_CATEGORY_ID };

function sql(file: string): string {
  return readFileSync(path.join(process.cwd(), "lib", file), "utf8");
}

/**
 * Startup migration, in three passes:
 *
 *   1. additive DDL that is safe on a populated database (schema.sql)
 *   2. backfill of rows the new model requires (this file)
 *   3. constraints that would have rejected the pre-backfill data
 *
 * Every step is guarded by "is this already true?" rather than by a version
 * number, so re-running never duplicates a stage, resets a renamed column, or
 * overwrites anything the user has customised.
 */
export async function runMigrations(driver: Driver): Promise<void> {
  // Held across all three passes: on Postgres, two instances running the
  // additive DDL at the same time deadlock on AccessExclusiveLock.
  await driver.withMigrationLock(async () => {
    await driver.exec(sql("schema.sql"));
    await driver.transaction(backfill);
    await driver.exec(sql("constraints.sql"));
  });
}

export async function backfill(tx: Tx): Promise<void> {
  await backfillProjectStages(tx);
  await backfillTaskStages(tx);
  await seedGeneralNote(tx);
  await seedTrackingSettings(tx);
  await seedAuthSettings(tx);
  await seedDefaultCategories(tx);
  await seedDefaultActivities(tx);
  await migrateTimeEntriesToSegments(tx);
  await backfillPinnedActivities(tx);
}

/** Every project needs its four default stages — but only if it has none. */
async function backfillProjectStages(tx: Tx): Promise<void> {
  const projects = await tx.query<{ id: string }>(
    `select p.id from projects p
      where not exists (select 1 from project_stages s where s.project_id = p.id)`,
  );

  for (const project of projects) {
    for (const [i, stage] of DEFAULT_STAGES.entries()) {
      await tx.query(
        `insert into project_stages (id, project_id, name, kind, sort_order)
         values ($1, $2, $3, $4, $5)`,
        [randomUUID(), project.id, stage.name, stage.kind, i],
      );
    }
  }
}

/**
 * Existing project tasks land in Done if they are already completed and in the
 * first non-done stage otherwise. Tasks with no project keep no stage.
 */
async function backfillTaskStages(tx: Tx): Promise<void> {
  await tx.query(
    `update tasks t set stage_id = s.id
       from project_stages s
      where t.stage_id is null
        and t.project_id is not null
        and s.project_id = t.project_id
        and s.kind = 'done'
        and t.status = 'done'`,
  );

  await tx.query(
    `update tasks t set stage_id = s.id
       from (
         select distinct on (project_id) project_id, id
           from project_stages
          where kind <> 'done'
          order by project_id, sort_order asc, created_at asc
       ) s
      where t.stage_id is null
        and t.project_id is not null
        and s.project_id = t.project_id
        and t.status <> 'done'`,
  );
}

async function seedGeneralNote(tx: Tx): Promise<void> {
  await tx.query(
    `insert into general_note (id, body) values ($1, '')
     on conflict (id) do nothing`,
    [GENERAL_NOTE_ID],
  );
}

async function seedTrackingSettings(tx: Tx): Promise<void> {
  await tx.query(
    `insert into tracking_settings (id) values ($1)
     on conflict (id) do nothing`,
    [TRACKING_SETTINGS_ID],
  );
}

async function seedAuthSettings(tx: Tx): Promise<void> {
  await tx.query(
    `insert into auth_settings (id) values ($1)
     on conflict (id) do nothing`,
    [AUTH_SETTINGS_ID],
  );
}

/** Starting points only — the user can rename, recolour, or delete any of them. */
async function seedDefaultCategories(tx: Tx): Promise<void> {
  const existing = await tx.query<{ n: number }>(`select count(*)::int as n from categories`);
  if (existing[0].n > 0) return;

  for (const [i, category] of DEFAULT_CATEGORIES.entries()) {
    await tx.query(
      `insert into categories (id, name, color, kind, sort_order)
       values ($1, $2, $3, $4, $5)`,
      [FIXED_CATEGORY_IDS[category.name] ?? randomUUID(), category.name, category.color, category.kind, i],
    );
  }
}

/** Only for categories that have no activities yet, so a user's own additions never get clobbered. */
async function seedDefaultActivities(tx: Tx): Promise<void> {
  const categories = await tx.query<{ id: string; name: string }>(
    `select c.id, c.name from categories c
      where not exists (select 1 from activities a where a.category_id = c.id)`,
  );

  for (const category of categories) {
    const presets = DEFAULT_ACTIVITIES[category.name];
    if (!presets) continue;
    for (const [i, name] of presets.entries()) {
      await tx.query(
        `insert into activities (id, category_id, name, is_preset, pinned, sort_order)
         values ($1, $2, $3, true, $4, $5)`,
        [randomUUID(), category.id, name, i === 0, i],
      );
    }
  }
}

/**
 * Existing installs get `pinned = false` on every row from the column
 * default, which would render an empty pinned row on the NOW card. Run once:
 * if nothing is pinned anywhere yet, pin the lowest-sort_order preset
 * activity per category.
 */
async function backfillPinnedActivities(tx: Tx): Promise<void> {
  const pinned = await tx.query<{ n: number }>(`select count(*)::int as n from activities where pinned`);
  if (pinned[0].n > 0) return;

  await tx.query(
    `update activities a set pinned = true
       from (
         select distinct on (category_id) id
           from activities
          where is_preset and not archived
          order by category_id, sort_order asc, created_at asc
       ) first
      where a.id = first.id`,
  );
}

/**
 * Superseded by `segments`, but existing time_entries rows must land there
 * once — reusing the same id keeps the migration idempotent, and the fixed
 * Focus Work category id gives every migrated row somewhere to roll up.
 */
async function migrateTimeEntriesToSegments(tx: Tx): Promise<void> {
  await tx.query(
    `insert into segments (id, started_at, ended_at, category_id, task_id, note, source, running_lock, created_at, updated_at)
     select t.id, t.started_at,
            coalesce(t.ended_at, t.started_at + make_interval(mins => t.minutes)),
            $1,
            t.task_id, t.note, 'timer',
            case when t.ended_at is null then true else null end,
            t.created_at, t.updated_at
       from time_entries t
      where not exists (select 1 from segments s where s.id = t.id)`,
    [FOCUS_WORK_CATEGORY_ID],
  );
}
