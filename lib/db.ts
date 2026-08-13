import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

/**
 * One SQL codebase, two engines. With POSTGRES_URL/DATABASE_URL set (Vercel
 * Postgres, Neon, Supabase, ...) we talk to real Postgres. Without it — plain
 * `npm run dev` on a laptop with nothing provisioned — we fall back to
 * PGlite, a real Postgres engine compiled to WASM that persists to a local
 * folder. Same SQL, same schema, no Docker/local server required either way.
 */

type Row = Record<string, unknown>;

interface Driver {
  query(text: string, params?: unknown[]): Promise<Row[]>;
  exec(text: string): Promise<void>;
}

async function createDriver(): Promise<Driver> {
  const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;

  if (connectionString) {
    const postgres = (await import("postgres")).default;
    const sql = postgres(connectionString, {
      ssl: connectionString.includes("sslmode=disable") ? false : "require",
    });
    return {
      async query(text, params = []) {
        return (await sql.unsafe(text, params as never[])) as unknown as Row[];
      },
      async exec(text) {
        await sql.unsafe(text);
      },
    };
  }

  const { PGlite } = await import("@electric-sql/pglite");
  const dataDir = path.join(process.cwd(), ".data", "pglite");
  mkdirSync(dataDir, { recursive: true });
  const db = new PGlite(dataDir);
  return {
    async query(text, params = []) {
      const res = await db.query(text, params);
      return res.rows as Row[];
    },
    async exec(text) {
      await db.exec(text);
    },
  };
}

let driverPromise: Promise<Driver> | null = null;
function getDriver(): Promise<Driver> {
  if (!driverPromise) driverPromise = createDriver();
  return driverPromise;
}

let migratePromise: Promise<void> | null = null;
function migrate(driver: Driver): Promise<void> {
  if (!migratePromise) {
    const schema = readFileSync(path.join(process.cwd(), "lib", "schema.sql"), "utf8");
    migratePromise = driver.exec(schema);
  }
  return migratePromise;
}

export async function query<T extends Row = Row>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const driver = await getDriver();
  await migrate(driver);
  return driver.query(text, params) as Promise<T[]>;
}
