import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after, before } from "node:test";
import { freshDb, type TestDb } from "./helpers/db";

let db: TestDb;

before(async () => {
  db = await freshDb();
});
after(async () => db.close());

test("migrations run twice with no duplicate categories", async () => {
  const initial = await db.query<{ n: number }>(`select count(*)::int as n from categories`);
  assert.equal(initial[0].n, 7, "the seven default categories are seeded once");

  const { backfill } = await import("../lib/migrate");
  await db.withTransaction(backfill);
  await db.withTransaction(backfill);

  const rerun = await db.query<{ n: number }>(`select count(*)::int as n from categories`);
  assert.equal(rerun[0].n, 7, "re-running the migration creates no duplicates");
});

test("two running segments are rejected", async () => {
  const category = (await db.query<{ id: string }>(`select id from categories limit 1`))[0];
  await db.query(
    `insert into segments (id, started_at, category_id, source, running_lock)
     values ($1, now(), $2, 'timer', true)`,
    [randomUUID(), category.id],
  );

  await assert.rejects(() =>
    db.query(
      `insert into segments (id, started_at, category_id, source, running_lock)
       values ($1, now(), $2, 'timer', true)`,
      [randomUUID(), category.id],
    ),
  );

  await db.query(`update segments set ended_at = now(), running_lock = null where running_lock = true`);
});

test("a segment with both task_id and activity_id is rejected", async () => {
  const category = (await db.query<{ id: string }>(`select id from categories limit 1`))[0];
  const activity = (await db.query<{ id: string }>(`select id from activities limit 1`))[0];
  const task = await db.store.addTask({ title: "Segment task", scheduled: "2026-01-01", minutes: 30, priority: 0 });

  await assert.rejects(() =>
    db.query(
      `insert into segments (id, started_at, category_id, activity_id, task_id, source)
       values ($1, now(), $2, $3, $4, 'manual')`,
      [randomUUID(), category.id, activity.id, task.id],
    ),
  );
});

test("existing time_entries rows land in segments exactly once", async () => {
  const task = await db.store.addTask({ title: "Legacy timed", scheduled: "2026-01-01", minutes: 30, priority: 0 });
  const entryId = randomUUID();
  await db.query(
    `insert into time_entries (id, task_id, started_at, ended_at, minutes)
     values ($1, $2, now() - interval '1 hour', now(), 60)`,
    [entryId, task.id],
  );

  const { backfill } = await import("../lib/migrate");
  await db.withTransaction(backfill);
  await db.withTransaction(backfill);

  const segments = await db.query<{ id: string; task_id: string }>(
    `select id, task_id from segments where id = $1`,
    [entryId],
  );
  assert.equal(segments.length, 1, "the entry lands in segments exactly once, even after a second run");
  assert.equal(segments[0].task_id, task.id);
});
