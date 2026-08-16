import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import { SegmentOverlap, TimerConflict } from "../lib/store/segments";
import { freshDb, type TestDb } from "./helpers/db";

let db: TestDb;
let categoryId: string;
let activityId: string;

before(async () => {
  db = await freshDb();
  categoryId = (await db.query<{ id: string }>(`select id from categories limit 1`))[0].id;
  activityId = (await db.query<{ id: string }>(`select id from activities where category_id = $1 limit 1`, [
    categoryId,
  ]))[0].id;
});
after(async () => db.close());

test("starting a segment while one runs is rejected, and switching hands it over atomically", async () => {
  const first = await db.store.startSegment({ categoryId, activityId });
  await assert.rejects(() => db.store.startSegment({ categoryId, activityId }), TimerConflict);

  const { stopped, started } = await db.store.switchSegment({ categoryId, note: "next thing" });
  assert.equal(stopped?.id, first.id);
  assert.ok(stopped?.endedAt);
  assert.equal(started.note, "next thing");

  const running = await db.store.runningSegment();
  assert.equal(running?.id, started.id, "exactly one segment is running after the switch");

  await db.store.stopSegment();
  assert.equal(await db.store.runningSegment(), null);
});

test("a manual segment overlapping an existing one is rejected", async () => {
  await db.store.addManualSegment({
    startedAt: "2026-03-05T09:00:00.000Z",
    endedAt: "2026-03-05T10:00:00.000Z",
    categoryId,
  });

  await assert.rejects(
    () =>
      db.store.addManualSegment({
        startedAt: "2026-03-05T09:30:00.000Z",
        endedAt: "2026-03-05T11:00:00.000Z",
        categoryId,
      }),
    SegmentOverlap,
  );
});

test("fillGap rejects a span that overlaps a tracked segment", async () => {
  await db.store.addManualSegment({
    startedAt: "2026-03-06T09:00:00.000Z",
    endedAt: "2026-03-06T10:00:00.000Z",
    categoryId,
  });

  await assert.rejects(
    () => db.store.fillGap({ startedAt: "2026-03-06T08:30:00.000Z", endedAt: "2026-03-06T09:30:00.000Z", categoryId }),
    SegmentOverlap,
  );

  const filled = await db.store.fillGap({
    startedAt: "2026-03-06T10:00:00.000Z",
    endedAt: "2026-03-06T11:00:00.000Z",
    categoryId,
  });
  assert.equal(filled.source, "backfill");
});

test("fillGap accepts a taskId, resolving its category and forcing source: backfill", async () => {
  const admin = await db.store.addCategory({ name: "Fill Gap Admin", color: "cat-slate", kind: "work" });
  const { project } = await db.store.addProject({ name: "Fill Gap Project", defaultCategoryId: admin.id });
  const task = await db.store.addTask({
    title: "Fill gap task",
    scheduled: "2026-03-06",
    minutes: 30,
    priority: 0,
    projectId: project.id,
  });

  const filled = await db.store.fillGap({
    startedAt: "2026-03-06T13:00:00.000Z",
    endedAt: "2026-03-06T14:00:00.000Z",
    taskId: task.id,
  });
  assert.equal(filled.source, "backfill");
  assert.equal(filled.taskId, task.id);
  assert.equal(filled.categoryId, admin.id, "the task's project category wins, not a caller-supplied one");
  assert.equal(filled.activityId, undefined, "a task-linked fill is never also an activity");
});

test("retro-linking a task onto an activity segment clears the activity", async () => {
  const task = await db.store.addTask({ title: "Retro-link task", scheduled: "2026-03-07", minutes: 30, priority: 0 });
  const seg = await db.store.addManualSegment({
    startedAt: "2026-03-07T15:00:00.000Z",
    endedAt: "2026-03-07T16:00:00.000Z",
    categoryId,
    activityId,
  });
  assert.equal(seg.activityId, activityId);

  const linked = await db.store.updateSegment(seg.id, { taskId: task.id, activityId: "" });
  assert.equal(linked?.taskId, task.id);
  assert.equal(linked?.activityId, undefined);

  const unlinked = await db.store.updateSegment(seg.id, { taskId: "" });
  assert.equal(unlinked?.taskId, undefined);
});

test("segments are editable and deletable", async () => {
  const seg = await db.store.addManualSegment({
    startedAt: "2026-03-07T09:00:00.000Z",
    endedAt: "2026-03-07T10:00:00.000Z",
    categoryId,
    note: "Original",
  });

  const edited = await db.store.updateSegment(seg.id, { note: "Edited" });
  assert.equal(edited?.note, "Edited");

  assert.equal(await db.store.deleteSegment(seg.id), true);
  assert.equal(await db.store.getSegment(seg.id), null);
});

test("editing a segment's time into an overlap with another segment is rejected", async () => {
  const a = await db.store.addManualSegment({
    startedAt: "2026-03-08T09:00:00.000Z",
    endedAt: "2026-03-08T10:00:00.000Z",
    categoryId,
  });
  await db.store.addManualSegment({
    startedAt: "2026-03-08T11:00:00.000Z",
    endedAt: "2026-03-08T12:00:00.000Z",
    categoryId,
  });

  await assert.rejects(
    () => db.store.updateSegment(a.id, { endedAt: "2026-03-08T11:30:00.000Z" }),
    SegmentOverlap,
  );
});

test("recordedMinutesByTask counts finished task segments only", async () => {
  const task = await db.store.addTask({ title: "Segment totals", scheduled: "2026-03-01", minutes: 30, priority: 0 });
  await db.store.addManualSegment({
    startedAt: "2026-03-09T09:00:00.000Z",
    endedAt: "2026-03-09T09:30:00.000Z",
    categoryId,
    taskId: task.id,
  });
  await db.store.startSegment({ categoryId, taskId: task.id });

  const totals = await db.store.recordedMinutesByTask();
  assert.equal(totals[task.id], 30, "the running segment stays out of the total");
  await db.store.stopSegment();
});

test("listSegments returns segments overlapping the given range, ordered by start", async () => {
  await db.store.addManualSegment({
    startedAt: "2026-03-10T09:00:00.000Z",
    endedAt: "2026-03-10T10:00:00.000Z",
    categoryId,
  });
  await db.store.addManualSegment({
    startedAt: "2026-03-10T14:00:00.000Z",
    endedAt: "2026-03-10T15:00:00.000Z",
    categoryId,
  });

  const segs = await db.store.listSegments("2026-03-10T00:00:00.000Z", "2026-03-11T00:00:00.000Z");
  assert.equal(segs.length, 2);
  assert.ok(segs[0].startedAt < segs[1].startedAt);
});
