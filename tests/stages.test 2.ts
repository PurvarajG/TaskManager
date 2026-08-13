import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import { StageConflict } from "../lib/store/stages";
import { freshDb, type TestDb } from "./helpers/db";

let db: TestDb;

before(async () => {
  db = await freshDb();
});
after(async () => db.close());

async function project(name: string) {
  const { project, stages } = await db.store.addProject({ name });
  return { project, stages };
}

function task(projectId: string, title: string, stageId?: string) {
  return db.store.addTask({
    title,
    projectId,
    stageId,
    scheduled: "2026-03-01",
    minutes: 30,
    priority: 0,
  });
}

test("a new project comes with its four default columns", async () => {
  const { stages } = await project("Fresh");
  assert.deepEqual(
    stages.map((s) => [s.name, s.kind, s.sortOrder]),
    [
      ["Backlog", "backlog", 0],
      ["In Progress", "active", 1],
      ["Blocked", "blocked", 2],
      ["Done", "done", 3],
    ],
  );
});

test("columns rename, reorder, and add", async () => {
  const { project: p, stages } = await project("Board");

  await db.store.updateStage(stages[0].id, { name: "Someday" });
  const review = await db.store.addStage(p.id, { name: "Review", kind: "active" });
  await db.store.reorderStages(p.id, [review.id, ...stages.map((s) => s.id)]);

  const after = await db.store.listStages(p.id);
  assert.deepEqual(after.map((s) => s.name), [
    "Review",
    "Someday",
    "In Progress",
    "Blocked",
    "Done",
  ]);
});

test("a project keeps exactly one done column", async () => {
  const { project: p, stages } = await project("Invariants");

  await assert.rejects(
    () => db.store.addStage(p.id, { name: "Also done", kind: "done" }),
    StageConflict,
  );
  await assert.rejects(
    () => db.store.updateStage(stages[3].id, { kind: "active" }),
    StageConflict,
  );
  await assert.rejects(() => db.store.removeStage(stages[3].id, stages[0].id), StageConflict);
});

test("removing a column moves its tasks to the chosen destination", async () => {
  const { project: p, stages } = await project("Cleanup");
  const t = await task(p.id, "Survivor", stages[1].id);

  await db.store.removeStage(stages[1].id, stages[0].id);

  const moved = await db.store.getTask(t.id);
  assert.equal(moved?.stageId, stages[0].id);
  assert.equal((await db.store.listStages(p.id)).length, 3);
});

test("a destination in another project is refused", async () => {
  const a = await project("A");
  const b = await project("B");
  await assert.rejects(() => db.store.removeStage(a.stages[1].id, b.stages[0].id), StageConflict);
  await assert.rejects(() => db.store.removeStage(a.stages[1].id, a.stages[1].id), StageConflict);
});

test("tasks moved into the done column are completed, and reopened on the way out", async () => {
  const { project: p, stages } = await project("Transitions");
  const t = await task(p.id, "Finish me", stages[0].id);

  const done = await db.store.moveTaskToStage(t.id, stages[3].id, 0);
  assert.equal(done?.status, "done");
  assert.ok(done?.completedAt);

  const reopened = await db.store.moveTaskToStage(t.id, stages[1].id, 0);
  assert.equal(reopened?.status, "open");
  assert.equal(reopened?.completedAt, undefined);
});

test("board order stays dense across moves", async () => {
  const { project: p, stages } = await project("Ordering");
  const first = await task(p.id, "First", stages[0].id);
  const second = await task(p.id, "Second", stages[0].id);
  const third = await task(p.id, "Third", stages[0].id);

  // Drop the last card at the top of its own column.
  await db.store.moveTaskToStage(third.id, stages[0].id, 0);

  const inColumn = (await db.store.allTasks())
    .filter((t) => t.stageId === stages[0].id)
    .sort((a, b) => a.boardOrder - b.boardOrder);

  assert.deepEqual(inColumn.map((t) => t.title), ["Third", "First", "Second"]);
  assert.deepEqual(inColumn.map((t) => t.boardOrder), [0, 1, 2]);
  assert.ok(first.id && second.id);
});
