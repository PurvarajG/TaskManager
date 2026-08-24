import assert from "node:assert/strict";
import test from "node:test";

test("LAB_MODE uses local PGlite even when a remote database is configured", async () => {
  process.env.LAB_MODE = "1";
  process.env.POSTGRES_URL = "postgres://x";
  process.env.PGLITE_DIR = "memory://";
  try {
    const db = await import("../lib/db");
    db.resetDriverForTests();
    const rows = await db.query<{ value: number }>("select 1 as value");
    assert.equal(rows[0]?.value, 1);
  } finally {
    delete process.env.LAB_MODE;
    delete process.env.POSTGRES_URL;
    delete process.env.PGLITE_DIR;
    (await import("../lib/db")).resetDriverForTests();
  }
});
