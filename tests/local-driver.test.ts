import assert from "node:assert/strict";
import test from "node:test";

test("remote database environment variables do not bypass local PGlite", async () => {
  const previousPostgresUrl = process.env.POSTGRES_URL;
  const previousDatabaseUrl = process.env.DATABASE_URL;
  const previousPgliteDir = process.env.PGLITE_DIR;

  process.env.POSTGRES_URL = "postgres://127.0.0.1:1/ignored";
  process.env.DATABASE_URL = "postgres://127.0.0.1:1/ignored";
  process.env.PGLITE_DIR = "memory://";

  try {
    const db = await import("../lib/db");
    db.resetDriverForTests();
    const rows = await db.query<{ value: number }>("select 1 as value");
    assert.equal(rows[0]?.value, 1);
  } finally {
    if (previousPostgresUrl === undefined) delete process.env.POSTGRES_URL;
    else process.env.POSTGRES_URL = previousPostgresUrl;
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
    if (previousPgliteDir === undefined) delete process.env.PGLITE_DIR;
    else process.env.PGLITE_DIR = previousPgliteDir;
    (await import("../lib/db")).resetDriverForTests();
  }
});
