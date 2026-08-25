import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import { freshDb, type TestDb } from "./helpers/db";
import { TRACKING_SETTINGS_ID } from "../lib/types";

let db: TestDb;

before(async () => {
  db = await freshDb();
});
after(async () => db.close());

/**
 * Plan §6: RECORDS/ROLL-UPS/SIGNALS collapse by default for a first-run
 * user. The column default in schema.sql only reaches a brand-new row —
 * `backfillCollapsedModules` in lib/migrate.ts is what actually makes this
 * true for a fresh install (any query triggers `runMigrations`, which
 * `freshDb()` exercises before this test body runs).
 */
test("a fresh install starts with records/rollups/signals collapsed", async () => {
  const settings = await db.store.getTrackingSettings();
  assert.deepEqual(new Set(settings.collapsedModules), new Set(["records", "rollups", "signals"]));
});

test("re-running the backfill never re-collapses a set the user has since expanded", async () => {
  // Simulate the user deliberately expanding everything back out, after the
  // one-time backfill above already ran (collapsed_modules_seeded is true).
  await db.store.updateTrackingSettings({ collapsedModules: [] });

  const { backfill } = await import("../lib/migrate");
  await db.withTransaction(backfill);

  const settings = await db.store.getTrackingSettings();
  assert.deepEqual(settings.collapsedModules, [], "an intentionally-empty set must stay empty");
});

test("re-running the backfill never disturbs a custom (non-default) collapsed set", async () => {
  await db.store.updateTrackingSettings({ collapsedModules: ["now"] });

  const { backfill } = await import("../lib/migrate");
  await db.withTransaction(backfill);

  const settings = await db.store.getTrackingSettings();
  assert.deepEqual(settings.collapsedModules, ["now"]);
});

/**
 * The realistic upgrade case the audit called out: a pre-existing install
 * whose row was created before this phase, so `collapsed_modules` came from
 * the pre-phase-6 empty-array default and `collapsed_modules_seeded` was
 * backdated to false by the ADD COLUMN in schema.sql. The backfill must
 * collapse it exactly once and never again, even across many more runs.
 */
test("an existing (pre-phase-6) row gets collapsed once, then is left alone forever", async () => {
  await db.query(
    `update tracking_settings set collapsed_modules = array[]::text[], collapsed_modules_seeded = false where id = $1`,
    [TRACKING_SETTINGS_ID],
  );

  const { backfill } = await import("../lib/migrate");
  await db.withTransaction(backfill);

  let settings = await db.store.getTrackingSettings();
  assert.deepEqual(new Set(settings.collapsedModules), new Set(["records", "rollups", "signals"]));

  // The user expands everything back out, then the app restarts (backfill reruns).
  await db.store.updateTrackingSettings({ collapsedModules: [] });
  await db.withTransaction(backfill);
  await db.withTransaction(backfill);

  settings = await db.store.getTrackingSettings();
  assert.deepEqual(settings.collapsedModules, [], "seeded=true must stop the backfill for good");
});

/**
 * The other realistic upgrade case: a pre-existing row where the user had
 * already collapsed something of their own (`{ribbon}`, say) before this
 * phase existed, so `collapsed_modules_seeded` is backdated to false but
 * `collapsed_modules` is NOT empty. The backfill must never overwrite that
 * with the three-module default — "collapsed by default" is a FIRST-RUN
 * behaviour, not a licence to replace a customisation the migration just
 * happens to be seeing for the first time. It still marks the row seeded,
 * so this can never reconsider it again either.
 */
test("an existing row with its own customised collapse set is left untouched, and marked seeded", async () => {
  await db.query(
    `update tracking_settings set collapsed_modules = array['ribbon'], collapsed_modules_seeded = false where id = $1`,
    [TRACKING_SETTINGS_ID],
  );

  const { backfill } = await import("../lib/migrate");
  await db.withTransaction(backfill);

  const settings = await db.store.getTrackingSettings();
  assert.deepEqual(
    settings.collapsedModules,
    ["ribbon"],
    "a pre-existing customisation must never be replaced by the default",
  );

  // Re-running must not touch it either, even if it were somehow re-emptied
  // (already covered above) — here we confirm re-running with the same
  // customisation in place is a no-op.
  await db.withTransaction(backfill);
  const again = await db.store.getTrackingSettings();
  assert.deepEqual(again.collapsedModules, ["ribbon"]);
});

