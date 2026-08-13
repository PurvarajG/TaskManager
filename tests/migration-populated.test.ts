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
 * The release gate: the upgrade landing on a database with real volume, real
 * customisation, and every task state represented — then running again, the
 * way a cold start on Vercel would.
 */
test("a populated, customised database survives repeated migration", async () => {
  const projectIds = [randomUUID(), randomUUID(), randomUUID()];
  for (const [i, id] of projectIds.entries()) {
    await db.query(`insert into projects (id, name, color, sort_order) values ($1,$2,'#0052ff',$3)`, [
      id,
      `Project ${i}`,
      i,
    ]);
  }

  // 60 tasks spread across projects, states, and the no-project case.
  const taskIds: string[] = [];
  for (let i = 0; i < 60; i++) {
    const id = randomUUID();
    taskIds.push(id);
    const status = ["open", "done", "trashed"][i % 3];
    const projectId = i % 5 === 0 ? null : projectIds[i % projectIds.length];
    await db.query(
      `insert into tasks (id, title, project_id, scheduled, minutes, priority, status, completed_at)
       values ($1,$2,$3,'2026-01-15',30,0,$4,$5)`,
      [id, `Task ${i}`, projectId, status, status === "done" ? new Date().toISOString() : null],
    );
  }

  // Pre-upgrade shape: no stages, no stage assignments.
  await db.query(`delete from project_stages`);
  await db.query(`update tasks set stage_id = null`);

  const { backfill } = await import("../lib/migrate");
  await db.withTransaction(backfill);

  // A user then renames and adds columns, as they would.
  const first = await db.store.listStages(projectIds[0]);
  await db.store.updateStage(first[0].id, { name: "Someday" });
  await db.store.addStage(projectIds[0], { name: "In Review", kind: "active" });

  const snapshot = {
    tasks: (await db.query(`select count(*)::int as n from tasks`))[0],
    stages: (await db.query(`select count(*)::int as n from project_stages`))[0],
  };

  // Cold start, twice.
  await db.withTransaction(backfill);
  await db.withTransaction(backfill);

  assert.deepEqual(
    (await db.query(`select count(*)::int as n from tasks`))[0],
    snapshot.tasks,
    "no task is created or lost",
  );
  assert.deepEqual(
    (await db.query(`select count(*)::int as n from project_stages`))[0],
    snapshot.stages,
    "no duplicate columns",
  );

  const stagesAfter = await db.store.listStages(projectIds[0]);
  assert.equal(stagesAfter[0].name, "Someday", "the rename survives");
  assert.equal(stagesAfter.length, 5, "the added column survives");

  // Every project task has a column of its own project, and completed ones are
  // in Done.
  const misplaced = await db.query(
    `select t.id from tasks t
       join project_stages s on s.id = t.stage_id
      where s.project_id <> t.project_id`,
  );
  assert.equal(misplaced.length, 0, "no task sits in another project's column");

  const unassigned = await db.query(
    `select count(*)::int as n from tasks where project_id is not null and stage_id is null`,
  );
  assert.equal(unassigned[0].n, 0, "every project task has a column");

  const doneElsewhere = await db.query(
    `select count(*)::int as n from tasks t
       join project_stages s on s.id = t.stage_id
      where t.status = 'done' and s.kind <> 'done'`,
  );
  assert.equal(doneElsewhere[0].n, 0, "completed tasks are in a done column");

  const orphaned = await db.query(
    `select count(*)::int as n from tasks where project_id is null and stage_id is not null`,
  );
  assert.equal(orphaned[0].n, 0, "tasks with no project have no column");
});

test("the single-timer index holds after migration re-runs", async () => {
  const task = await db.store.addTask({
    title: "Timed",
    scheduled: "2026-03-01",
    minutes: 30,
    priority: 0,
  });

  await db.store.startTimer(task.id);
  const { backfill } = await import("../lib/migrate");
  await db.withTransaction(backfill);

  await assert.rejects(() =>
    db.query(
      `insert into time_entries (id, task_id, started_at, running_lock) values ($1,$2,now(),true)`,
      [randomUUID(), task.id],
    ),
  );
  await db.store.stopTimer();
});
