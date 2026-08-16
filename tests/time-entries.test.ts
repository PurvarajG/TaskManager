import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after, before } from "node:test";
import { TimerConflict } from "../lib/store/time";
import { FOCUS_WORK_CATEGORY_ID } from "../lib/types";
import { freshDb, type TestDb } from "./helpers/db";

let db: TestDb;

before(async () => {
  db = await freshDb();
});
after(async () => db.close());

function task(title = "Timed work") {
  return db.store.addTask({ title, scheduled: "2026-03-01", minutes: 30, priority: 0 });
}

test("only one timer may run, and the database is what enforces it", async () => {
  const a = await task("First");
  const b = await task("Second");

  await db.store.startTimer(a.id);
  await assert.rejects(() => db.store.startTimer(b.id), TimerConflict);

  // Bypassing the store entirely still fails: the unique index is the guard.
  // (Time is tracked in `segments` now — see lib/store/segments.ts.)
  await assert.rejects(() =>
    db.query(
      `insert into segments (id, started_at, category_id, task_id, running_lock)
       values ($1, now(), $2, $3, true)`,
      [randomUUID(), FOCUS_WORK_CATEGORY_ID, b.id],
    ),
  );

  await db.store.stopTimer();
});

test("a conflict names the task that is already running", async () => {
  const a = await task("Running");
  const b = await task("Blocked");
  await db.store.startTimer(a.id);

  await assert.rejects(
    () => db.store.startTimer(b.id),
    (error: TimerConflict) => {
      assert.equal(error.runningTaskId, a.id);
      return true;
    },
  );
  await db.store.stopTimer();
});

test("stopping records at least a minute and clears the running slot", async () => {
  const t = await task();
  await db.store.startTimer(t.id);

  const stopped = await db.store.stopTimer();
  assert.equal(stopped?.minutes, 1, "a few seconds of real work still counts as a minute");
  assert.ok(stopped?.endedAt);
  assert.equal(await db.store.runningEntry(), null);
});

test("switching hands the timer over in one step", async () => {
  const a = await task("Was running");
  const b = await task("Now running");
  await db.store.startTimer(a.id);

  const { stopped, started } = await db.store.switchTimer(b.id);
  assert.equal(stopped?.taskId, a.id);
  assert.equal(started.taskId, b.id);
  assert.equal((await db.store.runningEntry())?.taskId, b.id);

  await db.store.stopTimer();
});

test("manual entries are editable and deletable; running entries are not", async () => {
  const t = await task();
  const entry = await db.store.addManualEntry({
    taskId: t.id,
    startedAt: "2026-03-01T09:00:00.000Z",
    minutes: 45,
    note: "Offline work",
  });
  assert.equal(entry.minutes, 45);
  assert.equal(entry.endedAt, "2026-03-01T09:45:00.000Z");

  const edited = await db.store.updateTimeEntry(entry.id, { minutes: 90 });
  assert.equal(edited?.minutes, 90);
  assert.equal(edited?.endedAt, "2026-03-01T10:30:00.000Z", "end time follows the duration");

  await db.store.startTimer(t.id);
  const running = await db.store.runningEntry();
  assert.equal(
    await db.store.updateTimeEntry(running!.id, { minutes: 5 }),
    null,
    "a running entry can't be edited retrospectively",
  );
  await db.store.stopTimer();

  assert.equal(await db.store.deleteTimeEntry(entry.id), true);
});

test("totals count stopped and manual entries only", async () => {
  const t = await task("Totals");
  await db.store.addManualEntry({
    taskId: t.id,
    startedAt: "2026-03-01T09:00:00.000Z",
    minutes: 20,
  });
  await db.store.addManualEntry({
    taskId: t.id,
    startedAt: "2026-03-02T09:00:00.000Z",
    minutes: 25,
  });
  await db.store.startTimer(t.id);

  const totals = await db.store.recordedMinutesByTask();
  assert.equal(totals[t.id], 45, "the live timer stays out of the total");
  await db.store.stopTimer();
});
