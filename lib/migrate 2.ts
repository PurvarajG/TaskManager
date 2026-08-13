import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Driver, Tx } from "./db";
import { DEFAULT_STAGES, GENERAL_NOTE_ID } from "./types";

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
  await driver.exec(sql("schema.sql"));
  await driver.transaction(backfill);
  await driver.exec(sql("constraints.sql"));
}

export async function backfill(tx: Tx): Promise<void> {
  await backfillProjectStages(tx);
  await backfillTaskStages(tx);
  await seedGeneralNote(tx);
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
