import assert from "node:assert/strict";
import test from "node:test";

/**
 * The one guard that holds regardless of env-file precedence: LAB_MODE must
 * never be allowed to run against a real connection string.
 */
test("LAB_MODE refuses to start when a remote database is configured", async () => {
  process.env.LAB_MODE = "1";
  process.env.POSTGRES_URL = "postgres://x";
  try {
    const db = await import("../lib/db");
    db.resetDriverForTests();
    await assert.rejects(
      () => db.query("select 1"),
      /LAB_MODE is set but a remote database is configured/,
    );
  } finally {
    delete process.env.LAB_MODE;
    delete process.env.POSTGRES_URL;
    (await import("../lib/db")).resetDriverForTests();
  }
});
