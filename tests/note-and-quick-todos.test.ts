import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import { freshDb, type TestDb } from "./helpers/db";

let db: TestDb;

before(async () => {
  db = await freshDb();
});
after(async () => db.close());

test("the general note is a singleton that saves and reloads", async () => {
  assert.equal((await db.store.getNote()).body, "");

  const saved = await db.store.saveNote("Ship the board");
  assert.equal(saved.body, "Ship the board");
  assert.equal((await db.store.getNote()).body, "Ship the board");

  await db.store.saveNote("Ship the board, then the calendar");
  assert.equal((await db.query(`select id from general_note`)).length, 1);
});

test("quick to-dos add, edit, complete, reorder, and delete", async () => {
  const first = await db.store.addQuickTodo("Call the bank");
  const second = await db.store.addQuickTodo("Water the plants");

  assert.deepEqual(
    (await db.store.listQuickTodos()).map((t) => t.title),
    ["Call the bank", "Water the plants"],
  );

  await db.store.updateQuickTodo(first.id, { done: true });
  await db.store.updateQuickTodo(second.id, { title: "Water the ferns" });
  await db.store.reorderQuickTodos([second.id, first.id]);

  const after = await db.store.listQuickTodos();
  assert.deepEqual(after.map((t) => t.title), ["Water the ferns", "Call the bank"]);
  assert.equal(after[1].done, true);

  assert.equal(await db.store.deleteQuickTodo(first.id), true);
  assert.equal((await db.store.listQuickTodos()).length, 1);
});

test("converting a quick to-do creates the task and removes the source", async () => {
  const { project, stages } = await db.store.addProject({ name: "Errands" });
  const todo = await db.store.addQuickTodo("Book the dentist");

  const task = await db.store.convertQuickTodo(todo.id, {
    projectId: project.id,
    scheduled: "2026-03-05",
    minutes: 30,
    priority: 0,
  });

  assert.equal(task?.title, "Book the dentist");
  assert.equal(task?.stageId, stages[0].id);
  assert.equal(
    (await db.store.listQuickTodos()).find((t) => t.id === todo.id),
    undefined,
  );
});

test("a failed conversion leaves the checklist untouched", async () => {
  const todo = await db.store.addQuickTodo("Survives failure");

  await assert.rejects(() =>
    db.store.convertQuickTodo(todo.id, {
      // No such date: the insert fails, so the delete must roll back with it.
      scheduled: "not-a-date",
      minutes: 30,
      priority: 0,
    }),
  );

  const survivor = (await db.store.listQuickTodos()).find((t) => t.id === todo.id);
  assert.equal(survivor?.title, "Survives failure");
});

test("converting a missing to-do reports not found rather than creating a task", async () => {
  const before = (await db.store.allTasks()).length;
  const result = await db.store.convertQuickTodo("00000000-0000-4000-8000-000000000000", {
    scheduled: "2026-03-05",
    minutes: 30,
    priority: 0,
  });
  assert.equal(result, null);
  assert.equal((await db.store.allTasks()).length, before);
});
