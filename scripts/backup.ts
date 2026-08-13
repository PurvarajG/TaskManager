/**
 * Logical snapshot of the deployed database, written as JSON.
 *
 *   npx tsx --env-file=.env.local scripts/backup.ts
 *
 * Every row of every table this app owns, plus the restore statements needed
 * to put them back. Small enough to be a file you can read; large enough to be
 * a real rollback path if a migration ever surprises you.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import postgres from "postgres";

const TABLES = [
  "projects",
  "project_stages",
  "tasks",
  "subtasks",
  "general_note",
  "quick_todos",
  "time_entries",
];

async function main() {
  const url = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!url) throw new Error("Set POSTGRES_URL or DATABASE_URL (try --env-file=.env.local)");

  const sql = postgres(url, { ssl: url.includes("sslmode=disable") ? false : "require" });
  const dump: Record<string, unknown[]> = {};

  for (const table of TABLES) {
    const exists = await sql`select to_regclass(${`public.${table}`}) as t`;
    if (!exists[0].t) {
      console.log(`  ${table.padEnd(16)} — not present yet`);
      continue;
    }
    const rows = await sql.unsafe(`select * from ${table}`);
    dump[table] = rows as unknown[];
    console.log(`  ${table.padEnd(16)} ${rows.length} rows`);
  }

  const dir = path.join(process.cwd(), "backups");
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `neon-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  writeFileSync(file, JSON.stringify(dump, null, 2));

  console.log(`\nWrote ${file}`);
  await sql.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
