import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after, before } from "node:test";
import type { TrackingSettings } from "../lib/types";
import { freshDb, type TestDb } from "./helpers/db";

let db: TestDb;
let categoryId: string;

const DEFAULT_SETTINGS: TrackingSettings = {
  dayStartHour: 4,
  wakingStartHour: 7,
  wakingEndHour: 23,
  minGapMinutes: 10,
  moduleOrder: [],
  hiddenModules: [],
  updatedAt: new Date().toISOString(),
};

before(async () => {
  db = await freshDb();
  categoryId = (await db.query<{ id: string }>(`select id from categories limit 1`))[0].id;
});
after(async () => db.close());

/** A Date built from local Y/M/D + hour, matching how lib/store/segments.ts interprets a day boundary. */
function at(dayISO: string, hour: number, minute = 0): Date {
  const [y, m, d] = dayISO.split("-").map(Number);
  return new Date(y, m - 1, d, hour, minute, 0, 0);
}

async function segment(startedAt: Date, endedAt: Date) {
  await db.query(
    `insert into segments (id, started_at, ended_at, category_id, source)
     values ($1, $2, $3, $4, 'manual')`,
    [randomUUID(), startedAt.toISOString(), endedAt.toISOString(), categoryId],
  );
}

test("a fully-tracked day yields zero gaps", async () => {
  const day = "2026-02-02";
  await segment(at(day, 7), at(day, 23));

  const gaps = await db.store.findGaps(day, DEFAULT_SETTINGS);
  assert.deepEqual(gaps, []);
});

test("a day with three holes yields three gaps", async () => {
  const day = "2026-02-03";
  await segment(at(day, 7), at(day, 9));
  await segment(at(day, 10), at(day, 13));
  await segment(at(day, 14), at(day, 18));
  await segment(at(day, 19), at(day, 23));

  const gaps = await db.store.findGaps(day, DEFAULT_SETTINGS);
  assert.equal(gaps.length, 3);
  assert.deepEqual(
    gaps.map((g) => g.minutes),
    [60, 60, 60],
  );
});

test("sub-minGapMinutes holes are suppressed", async () => {
  const day = "2026-02-04";
  await segment(at(day, 7), at(day, 10));
  // A 5-minute hole, under the 10-minute threshold.
  await segment(at(day, 10, 5), at(day, 13));
  // A 20-minute hole, over the threshold.
  await segment(at(day, 13, 20), at(day, 23));

  const gaps = await db.store.findGaps(day, DEFAULT_SETTINGS);
  assert.equal(gaps.length, 1, "only the 20-minute hole survives");
  assert.equal(gaps[0].minutes, 20);
});

test("a day with no segments at all yields one gap covering the whole waking window", async () => {
  const day = "2026-02-05";
  const gaps = await db.store.findGaps(day, DEFAULT_SETTINGS);
  assert.equal(gaps.length, 1);
  assert.equal(gaps[0].startedAt, at(day, 7).toISOString());
  assert.equal(gaps[0].endedAt, at(day, 23).toISOString());
});

test("an overnight hole survives into the next day's view, computed fresh with nothing having run", async () => {
  // The real untracked span is 22:00 on the 6th to 08:00 on the 7th (10
  // hours) — but with a 04:00 day boundary that span straddles two tracking
  // days by design (a late night belongs to the day it started in), so each
  // day surfaces its own waking-hours fragment rather than one combined
  // block. What matters here is that neither fragment is lost: the 7th's
  // view shows its 07:00-08:00 gap without anything needing to have run
  // between midnight and now.
  await segment(at("2026-02-06", 7), at("2026-02-06", 22));
  await segment(at("2026-02-07", 8), at("2026-02-07", 12));
  // Covers the rest of the 7th so its only gap is the leading fragment under test.
  await segment(at("2026-02-07", 12), at("2026-02-07", 23));

  const dayBefore = await db.store.findGaps("2026-02-06", DEFAULT_SETTINGS);
  assert.equal(dayBefore.length, 1);
  assert.equal(dayBefore[0].minutes, 60, "trailing fragment, clamped at the 23:00 waking-window edge");
  assert.equal(dayBefore[0].startedAt, at("2026-02-06", 22).toISOString());
  assert.equal(dayBefore[0].endedAt, at("2026-02-06", 23).toISOString());

  const dayAfter = await db.store.findGaps("2026-02-07", DEFAULT_SETTINGS);
  assert.equal(dayAfter.length, 1);
  assert.equal(dayAfter[0].minutes, 60, "leading fragment, from wake-start to the day's first segment");
  assert.equal(dayAfter[0].startedAt, at("2026-02-07", 7).toISOString());
  assert.equal(dayAfter[0].endedAt, at("2026-02-07", 8).toISOString());
});
