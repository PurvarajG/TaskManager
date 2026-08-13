/**
 * Read-only check of the deployed database after a release.
 *
 *   npx tsx --env-file=.env.local scripts/verify-db.ts
 *
 * Reports which tables exist, how many rows they hold, and whether the
 * workspace invariants actually hold in production — no writes of any kind.
 */
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

  console.log("Tables");
  let migrated = true;
  for (const table of TABLES) {
    const exists = await sql`select to_regclass(${`public.${table}`}) as t`;
    if (!exists[0].t) {
      console.log(`  ${table.padEnd(16)} MISSING`);
      migrated = false;
      continue;
    }
    const [{ n }] = await sql.unsafe(`select count(*)::int as n from ${table}`);
    console.log(`  ${table.padEnd(16)} ${n} rows`);
  }

  if (!migrated) {
    console.log("\nMigration has not run yet — it runs on the first database query.");
    await sql.end();
    return;
  }

  const checks: [string, number][] = [
    [
      "project tasks with no column",
      (
        await sql`select count(*)::int as n from tasks
                   where project_id is not null and stage_id is null`
      )[0].n,
    ],
    [
      "tasks in another project's column",
      (
        await sql`select count(*)::int as n from tasks t
                    join project_stages s on s.id = t.stage_id
                   where s.project_id <> t.project_id`
      )[0].n,
    ],
    [
      "completed tasks outside a done column",
      (
        await sql`select count(*)::int as n from tasks t
                    join project_stages s on s.id = t.stage_id
                   where t.status = 'done' and s.kind <> 'done'`
      )[0].n,
    ],
    [
      "projects without exactly one done column",
      (
        await sql`select count(*)::int as n from (
                    select p.id from projects p
                      left join project_stages s
                        on s.project_id = p.id and s.kind = 'done'
                     group by p.id having count(s.id) <> 1
                  ) bad`
      )[0].n,
    ],
    [
      "running time entries (must be 0 or 1)",
      (await sql`select count(*)::int as n from time_entries where ended_at is null`)[0].n,
    ],
  ];

  console.log("\nInvariants (all should be 0, except the timer which may be 1)");
  let ok = true;
  for (const [label, count] of checks) {
    const bad = label.startsWith("running") ? count > 1 : count !== 0;
    if (bad) ok = false;
    console.log(`  ${bad ? "FAIL" : "ok  "}  ${label.padEnd(42)} ${count}`);
  }

  console.log(ok ? "\nProduction is consistent." : "\nSomething is off — see the FAIL rows.");
  await sql.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
