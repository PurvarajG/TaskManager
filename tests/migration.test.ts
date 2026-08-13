import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after, before } from "node:test";
import { freshDb, type TestDb } from "./helpers/db";

let db: TestDb;

before(async () => {
  db = await freshDb();
});
after(async () => db.close());

/**
 * The interesting case is not a clean install — it's the upgrade landing on a
 * database that already has projects and tasks from before stages existed.
 */
async function seedLegacyData() {
  const projectId = randomUUID();
  await db.query(`insert into projects (id, name, color) values ($1, 'Legacy', '#0052ff')`, [
    projectId,
  ]);

  const openTask = randomUUID();
  const doneTask = randomUUID();
  const looseTask = randomUUID();
  await db.query(
    `insert into tasks (id, title, project_id, scheduled, minutes, priority, status)
     values ($1, 'Open one', $4, '2026-01-01', 30, 0, 'open'),
            ($2, 'Done one', $4, '2026-01-01', 30, 0, 'done'),
            ($3, 'No project', null, '2026-01-01', 30, 0, 'open')`,
    [openTask, doneTask, looseTask, projectId],
  );

  // Undo the upgrade for these rows so the backfill has real work to do.
  await db.query(`update tasks set stage_id = null where id = any($1)`, [
    [openTask, doneTask, looseTask],
  ]);
  await db.query(`delete from project_stages where project_id = $1`, [projectId]);

  return { projectId, openTask, doneTask, looseTask };
}

test("backfills default stages and assigns existing tasks", async () => {
  const seeded = await seedLegacyData();
  const { backfill } = await import("../lib/migrate");
  await db.withTransaction(backfill);

  const stages = await db.store.listStages(seeded.projectId);
  assert.deepEqual(
    stages.map((s) => s.kind),
    ["backlog", "active", "blocked", "done"],
  );

  const open = await db.store.getTask(seeded.openTask);
  const done = await db.store.getTask(seeded.doneTask);
  const loose = await db.store.getTask(seeded.looseTask);

  assert.equal(open?.stageId, stages[0].id, "open tasks land in the first column");
  assert.equal(done?.stageId, stages[3].id, "completed tasks land in Done");
  assert.equal(loose?.stageId, undefined, "tasks with no project stay unassigned");
});

test("re-running migration neither duplicates stages nor undoes customization", async () => {
  const { projectId } = await seedLegacyData();
  const { backfill } = await import("../lib/migrate");
  await db.withTransaction(backfill);

  const before = await db.store.listStages(projectId);
  await db.store.updateStage(before[0].id, { name: "Icebox" });
  await db.store.addStage(projectId, { name: "Review", kind: "active" });

  await db.withTransaction(backfill);
  await db.withTransaction(backfill);

  const after = await db.store.listStages(projectId);
  assert.equal(after.length, 5, "no duplicate default stages");
  assert.equal(after[0].name, "Icebox", "a renamed column stays renamed");
});

test("seeds exactly one general note", async () => {
  const { backfill } = await import("../lib/migrate");
  await db.withTransaction(backfill);
  await db.withTransaction(backfill);

  const rows = await db.query(`select id from general_note`);
  assert.equal(rows.length, 1);
  assert.equal((await db.store.getNote()).body, "");
});
