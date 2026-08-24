/**
 * Fictional data for the tracking lab: the last 14 days, an ADHD-realistic
 * mix of fragmented and clean days, sleep crossing midnight, a few tasks
 * with timed work, and one deliberately untracked afternoon.
 *
 *   npm run seed:lab
 *
 * Two guards, because this must never touch the real database: LAB_MODE=1 and
 * a PGLITE_DIR that isn't the real local dev directory. Each independently
 * catches a mistake the other misses.
 */
import { store } from "../lib/store";
import type { Activity, Category } from "../lib/types";

function requireLabGuards(): void {
  if (process.env.LAB_MODE !== "1") {
    throw new Error("Refusing to seed: LAB_MODE=1 is not set. Run `npm run seed:lab`, not this file directly.");
  }
  const dir = process.env.PGLITE_DIR;
  if (!dir || dir.endsWith("pglite")) {
    throw new Error("Refusing to seed: PGLITE_DIR must point at a lab-only directory, not the real dev database.");
  }
}

function localDate(y: number, m: number, d: number, h: number, min = 0): Date {
  return new Date(y, m - 1, d, h, min, 0, 0);
}

function randInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function pick<T>(items: T[]): T {
  return items[randInt(0, items.length - 1)];
}

/**
 * Weighted toward whatever the day's texture calls for, falling back to any
 * activity. Excludes Sleep by name, not just daytime hours — "Sleep" at 2pm
 * would read as a bug in the seeded data.
 */
function pickActivity(activities: Activity[], categories: Category[], kinds: string[]): Activity {
  const pool = activities.filter((a) => {
    const category = categories.find((c) => c.id === a.categoryId);
    return category && category.name !== "Sleep" && kinds.includes(category.kind);
  });
  return pick(pool.length ? pool : activities);
}

async function main() {
  requireLabGuards();

  const categories = await store.listCategories();
  const activities = await store.listActivities();
  const byName = (name: string): Category => {
    const found = categories.find((c) => c.name === name);
    if (!found) throw new Error(`Expected the default "${name}" category to already be seeded`);
    return found;
  };

  const focusWork = byName("Focus Work");
  const sleep = byName("Sleep");
  const sleepActivity = activities.find((a) => a.categoryId === sleep.id && a.name === "Sleep")!;
  const deepWork = activities.find((a) => a.categoryId === focusWork.id && a.name === "Deep work")!;

  // Two projects, one with a default category other than Focus Work, so a
  // task timer's category inheritance (lib/store/task-category.ts) has
  // something real to exercise: Atlas's tasks land in Admin instead of
  // Focus Work; Homebase has no default and falls through as before.
  const admin = byName("Admin");
  const { project: atlas } = await store.addProject({ name: "Atlas Launch", defaultCategoryId: admin.id });
  const { project: homebase } = await store.addProject({ name: "Homebase" });

  const tasks = [];
  for (const [title, projectId] of [
    ["Write the Q3 roadmap doc", atlas.id],
    ["Fix the flaky login test", homebase.id],
    ["Prep the client deck", atlas.id],
    ["Review PR backlog", homebase.id],
  ] as const) {
    tasks.push(await store.addTask({ title, scheduled: "2026-01-01", minutes: 60, priority: 1, projectId }));
  }

  const today = new Date();
  const NUM_DAYS = 14;
  // Every third day is a clean, low-fragmentation day; the rest are the
  // realistic scattered ones. Five days back is deliberately left with an
  // untracked afternoon, so the seeded data always exercises that gap case.
  const UNTRACKED_DAY_OFFSET = 5;

  let segmentCount = 0;

  for (let offset = NUM_DAYS - 1; offset >= 0; offset--) {
    const day = new Date(today);
    day.setDate(day.getDate() - offset);
    const y = day.getFullYear();
    const m = day.getMonth() + 1;
    const d = day.getDate();

    const prevDay = new Date(y, m - 1, d - 1);

    // Sleep, crossing midnight from the previous evening.
    const sleepEnd = localDate(y, m, d, randInt(6, 7), randInt(0, 45));
    await store.addManualSegment({
      startedAt: localDate(prevDay.getFullYear(), prevDay.getMonth() + 1, prevDay.getDate(), 23, randInt(0, 30)).toISOString(),
      endedAt: sleepEnd.toISOString(),
      categoryId: sleep.id,
      activityId: sleepActivity.id,
    });
    segmentCount++;

    const clean = offset % 3 === 0;
    const untracked = offset === UNTRACKED_DAY_OFFSET;

    // Never start before sleep actually ended that day.
    let cursor = sleepEnd > localDate(y, m, d, 7, 30) ? sleepEnd : localDate(y, m, d, 7, 30);
    const dayEnd = localDate(y, m, d, 22, 30);

    while (cursor < dayEnd) {
      if (untracked && cursor.getHours() >= 13 && cursor.getHours() < 17) {
        cursor = localDate(y, m, d, 17, 0);
        continue;
      }

      const durationMinutes = clean ? randInt(60, 150) : randInt(15, 45);
      const end = new Date(cursor.getTime() + durationMinutes * 60_000);
      if (end > dayEnd) break;

      // A slice of the day's deep-work blocks are actual timed tasks.
      const linkToTask = clean && Math.random() < 0.4;
      if (linkToTask) {
        await store.addManualSegment({
          startedAt: cursor.toISOString(),
          endedAt: end.toISOString(),
          categoryId: focusWork.id,
          taskId: pick(tasks).id,
        });
      } else {
        const kinds = clean ? ["work"] : ["work", "upkeep", "rest"];
        const activity = pickActivity(activities, categories, kinds);
        await store.addManualSegment({
          startedAt: cursor.toISOString(),
          endedAt: end.toISOString(),
          categoryId: activity.categoryId,
          activityId: activity.id,
        });
      }
      segmentCount++;

      // Clean days run back-to-back; fragmented days leave small untracked
      // slivers between switches, exactly the kind minGapMinutes is meant to catch.
      const gapMinutes = clean ? 0 : randInt(0, 25);
      cursor = new Date(end.getTime() + gapMinutes * 60_000);
    }
  }

  console.log(`Seeded ${tasks.length} tasks and ${segmentCount} segments across ${NUM_DAYS} days.`);
  console.log(`Deliberately untracked afternoon: ${UNTRACKED_DAY_OFFSET} days ago, 13:00-17:00.`);
  console.log(`Focus Work: ${focusWork.id}, Sleep: ${sleep.id}, Deep work activity: ${deepWork.id}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
