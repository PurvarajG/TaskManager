/**
 * Runs the startup migration against the configured database, deliberately.
 *
 *   npx tsx --env-file=.env.local scripts/migrate.ts
 *
 * This is exactly what the app does on its first query after a cold start —
 * doing it here just means it happens while someone is watching, instead of
 * during a user's first page load. Idempotent, so re-running is a no-op.
 */
import { query } from "../lib/db";

async function main() {
  const url = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  console.log(url ? `Migrating ${new URL(url).host}` : "Migrating the local PGlite database");

  const started = Date.now();
  await query("select 1");
  console.log(`Done in ${Date.now() - started}ms`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
