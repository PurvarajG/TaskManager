import { mkdirSync } from "node:fs";
import path from "node:path";
import { runMigrations } from "./migrate";

/**
 * The desktop app always uses PGlite, a local Postgres engine compiled to
 * WASM. It persists to a folder without requiring a remote service or Docker.
 */

export type Row = Record<string, unknown>;

/** The subset of a driver available inside a transaction. */
export interface Tx {
  query<T extends Row = Row>(text: string, params?: unknown[]): Promise<T[]>;
}

export interface Driver extends Tx {
  exec(text: string): Promise<void>;
  transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T>;
  /**
   * Runs `fn` with a cluster-wide lock held, so only one process at a time can
   * be inside it. PGlite has a single writer already, so there it is a no-op.
   */
  withMigrationLock<T>(fn: () => Promise<T>): Promise<T>;
}

async function createDriver(): Promise<Driver> {
  const { PGlite } = await import("@electric-sql/pglite");
  // Tests point PGLITE_DIR at a throwaway directory (or "memory://") so they
  // never touch the developer's real local database.
  const dir = process.env.PGLITE_DIR || path.join(process.cwd(), ".data", "pglite");
  if (dir !== "memory://") mkdirSync(dir, { recursive: true });
  const db = new PGlite(dir);
  return {
    async query(text, params = []) {
      return (await db.query(text, params)).rows as never;
    },
    async exec(text) {
      await db.exec(text);
    },
    async transaction(fn) {
      const result = await db.transaction(async (t) =>
        fn({
          async query(text, params = []) {
            return (await t.query(text, params)).rows as never;
          },
        }),
      );
      return result as never;
    },
    async withMigrationLock(fn) {
      return fn();
    },
  };
}

let driverPromise: Promise<Driver> | null = null;
let migratePromise: Promise<void> | null = null;

/** Test-only: forget the cached driver so the next query builds a fresh one. */
export function resetDriverForTests(): void {
  driverPromise = null;
  migratePromise = null;
}

async function ready(): Promise<Driver> {
  if (!driverPromise) driverPromise = createDriver();
  const driver = await driverPromise;
  if (!migratePromise) {
    // A failed migration must not be cached as "done" — clear it so the next
    // request retries instead of every later query inheriting the rejection.
    migratePromise = runMigrations(driver).catch((err) => {
      migratePromise = null;
      throw err;
    });
  }
  await migratePromise;
  return driver;
}

export async function query<T extends Row = Row>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  return (await ready()).query<T>(text, params);
}

/**
 * Runs `fn` against a single connection inside BEGIN/COMMIT, rolling back if it
 * throws. Compound mutations (project + default stages, stage removal + task
 * reassignment, quick-todo conversion, timer stop-and-start, completion +
 * stage transition + recurrence) must go through here.
 */
export async function withTransaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return (await ready()).transaction(fn);
}
