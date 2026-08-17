import { mkdirSync } from "node:fs";
import path from "node:path";
import { runMigrations } from "./migrate";

/**
 * One SQL codebase, two engines. With POSTGRES_URL/DATABASE_URL set (Vercel
 * Postgres, Neon, Supabase, ...) we talk to real Postgres. Without it — plain
 * `npm run dev` on a laptop with nothing provisioned — we fall back to
 * PGlite, a real Postgres engine compiled to WASM that persists to a local
 * folder. Same SQL, same schema, no Docker/local server required either way.
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

/**
 * Arbitrary but fixed: the advisory-lock key this app uses to serialise
 * migrations. Any constant works as long as it never changes.
 */
const MIGRATION_LOCK_KEY = 8_413_207_741;

async function createDriver(): Promise<Driver> {
  const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;

  // The lab is a scratch instance. If a real connection string is in scope —
  // .env.local carries the production Neon URL — refuse to start rather than
  // migrate somebody's live data.
  if (process.env.LAB_MODE === "1" && connectionString) {
    throw new Error("LAB_MODE is set but a remote database is configured — refusing to connect");
  }

  if (connectionString) {
    const postgres = (await import("postgres")).default;
    const sql = postgres(connectionString, {
      ssl: connectionString.includes("sslmode=disable") ? false : "require",
    });
    return {
      async query(text, params = []) {
        return (await sql.unsafe(text, params as never[])) as never;
      },
      async exec(text) {
        await sql.unsafe(text);
      },
      async transaction(fn) {
        return sql.begin(async (tsql) => {
          return fn({
            async query(text, params = []) {
              return (await tsql.unsafe(text, params as never[])) as never;
            },
          });
        }) as never;
      },
      // Every cold instance runs the migration on its first query. On a fresh
      // deploy a burst of traffic wakes several at once, and concurrent
      // `alter table` statements taking AccessExclusiveLock in different
      // orders deadlock (40P01) — which surfaced as blanket 500s across the
      // tracking dashboard. A session-level advisory lock on a reserved
      // connection makes the losers wait instead of race.
      async withMigrationLock(fn) {
        const reserved = await sql.reserve();
        try {
          // Without a cap, a stuck holder would hang every other instance for
          // the whole function lifetime. Failing fast is the better outcome.
          await reserved.unsafe(`set statement_timeout = 60000`);
          await reserved.unsafe(`select pg_advisory_lock($1)`, [MIGRATION_LOCK_KEY] as never[]);
          try {
            return await fn();
          } finally {
            await reserved.unsafe(`select pg_advisory_unlock($1)`, [MIGRATION_LOCK_KEY] as never[]);
          }
        } finally {
          // The connection goes back to the pool, so leave no session state on it.
          await reserved.unsafe(`reset statement_timeout`).catch(() => {});
          reserved.release();
        }
      },
    };
  }

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
