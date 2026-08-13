import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/**
 * Each suite gets its own throwaway PGlite directory, so tests exercise the
 * real migration against a real Postgres engine without ever touching the
 * developer's `.data/pglite` database.
 */
export async function freshDb() {
  delete process.env.POSTGRES_URL;
  delete process.env.DATABASE_URL;
  const dir = mkdtempSync(path.join(tmpdir(), "taskmgr-test-"));
  process.env.PGLITE_DIR = dir;

  const db = await import("../../lib/db");
  db.resetDriverForTests();
  const store = (await import("../../lib/store")).store;

  return {
    ...db,
    store,
    async close() {
      db.resetDriverForTests();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

export type TestDb = Awaited<ReturnType<typeof freshDb>>;
