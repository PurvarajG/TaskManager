import { randomUUID } from "node:crypto";
import { withTransaction } from "../db";
import type { Tx } from "../db";
import { MIN_TRACKED_MINUTES, type TimeEntry } from "../types";
import { db, type Q, type SegmentRow } from "./rows";
import { TimerConflict } from "./segments";
import { resolveTaskCategoryId } from "./task-category";

export { TimerConflict } from "./segments";

/**
 * Presents the pre-segments TimeEntry shape over the same `segments` table, so
 * TaskTime, TimerButton and TimerStrip keep working unchanged. Every task
 * timer lands in the category its project defaults to (Focus Work if the
 * project has none set) — see resolveTaskCategoryId.
 */
function rowToTimeEntry(r: SegmentRow): TimeEntry {
  const startedAt = new Date(r.started_at);
  const endedAt = r.ended_at ? new Date(r.ended_at) : null;
  return {
    id: r.id,
    taskId: r.task_id as string,
    startedAt: startedAt.toISOString(),
    endedAt: endedAt ? endedAt.toISOString() : undefined,
    minutes: endedAt ? elapsedMinutes(startedAt.toISOString(), endedAt.toISOString()) : undefined,
    note: r.note ?? undefined,
    createdAt: new Date(r.created_at).toISOString(),
    updatedAt: new Date(r.updated_at).toISOString(),
  };
}

export async function listTimeEntries(taskId?: string): Promise<TimeEntry[]> {
  const rows = taskId
    ? await db.query<SegmentRow>(
        `select * from segments where task_id = $1 order by started_at desc`,
        [taskId],
      )
    : await db.query<SegmentRow>(
        `select * from segments where task_id is not null order by started_at desc`,
      );
  return rows.map(rowToTimeEntry);
}

export async function runningEntry(q: Q = db): Promise<TimeEntry | null> {
  const rows = await q.query<SegmentRow>(
    `select * from segments where task_id is not null and ended_at is null limit 1`,
  );
  return rows.length ? rowToTimeEntry(rows[0]) : null;
}

/** Any running segment, task or otherwise — only one thing is ever being timed. */
async function anyRunning(q: Q): Promise<SegmentRow | null> {
  const rows = await q.query<SegmentRow>(`select * from segments where ended_at is null limit 1`);
  return rows.length ? rows[0] : null;
}

async function insertRunning(tx: Tx, taskId: string): Promise<TimeEntry> {
  const categoryId = await resolveTaskCategoryId(taskId, tx);
  const rows = await tx.query<SegmentRow>(
    `insert into segments (id, started_at, category_id, task_id, source, running_lock)
     values ($1, now(), $2, $3, 'timer', true)
     returning *`,
    [randomUUID(), categoryId, taskId],
  );
  return rowToTimeEntry(rows[0]);
}

/** Elapsed whole minutes, never recording less than a minute of real work. */
export function elapsedMinutes(startedAt: string, endedAt: string): number {
  const ms = new Date(endedAt).getTime() - new Date(startedAt).getTime();
  return Math.max(MIN_TRACKED_MINUTES, Math.floor(ms / 60_000));
}

async function stopRunning(tx: Tx): Promise<TimeEntry | null> {
  const rows = await tx.query<SegmentRow>(
    `update segments set ended_at = now(), running_lock = null, updated_at = now()
      where ended_at is null and task_id is not null
      returning *`,
  );
  return rows.length ? rowToTimeEntry(rows[0]) : null;
}

export async function startTimer(taskId: string): Promise<TimeEntry> {
  return withTransaction(async (tx) => {
    const running = await anyRunning(tx);
    if (running) throw new TimerConflict(running.task_id ?? "");
    return insertRunning(tx, taskId);
  });
}

export async function stopTimer(): Promise<TimeEntry | null> {
  return withTransaction(stopRunning);
}

/** One atomic hand-off, so the app is never briefly timing nothing (or two things). */
export async function switchTimer(
  taskId: string,
): Promise<{ stopped: TimeEntry | null; started: TimeEntry }> {
  return withTransaction(async (tx) => {
    const stopped = await stopRunning(tx);
    return { stopped, started: await insertRunning(tx, taskId) };
  });
}

export async function addManualEntry(input: {
  taskId: string;
  startedAt: string;
  minutes: number;
  note?: string;
}): Promise<TimeEntry> {
  const categoryId = await resolveTaskCategoryId(input.taskId);
  const rows = await db.query<SegmentRow>(
    `insert into segments (id, started_at, ended_at, category_id, task_id, note, source)
     values ($1, $2, $3::timestamptz + make_interval(mins => $4::int), $5, $6, $7, 'manual')
     returning *`,
    [randomUUID(), input.startedAt, input.startedAt, input.minutes, categoryId, input.taskId, input.note ?? null],
  );
  return rowToTimeEntry(rows[0]);
}

/** Running entries are not retrospectively editable — stop them first. */
export async function updateTimeEntry(
  id: string,
  patch: { startedAt?: string; minutes?: number; note?: string },
): Promise<TimeEntry | null> {
  return withTransaction(async (tx) => {
    const existing = await tx.query<SegmentRow>(
      `select * from segments where id = $1 and task_id is not null and ended_at is not null`,
      [id],
    );
    if (existing.length === 0) return null;
    const current = rowToTimeEntry(existing[0]);

    const startedAt = patch.startedAt ?? current.startedAt;
    const minutes = patch.minutes ?? current.minutes ?? MIN_TRACKED_MINUTES;
    const note = patch.note !== undefined ? patch.note || null : (current.note ?? null);

    const rows = await tx.query<SegmentRow>(
      `update segments
          set started_at = $1,
              ended_at = $1::timestamptz + make_interval(mins => $2::int),
              note = $3,
              updated_at = now()
        where id = $4
        returning *`,
      [startedAt, minutes, note, id],
    );
    return rows.length ? rowToTimeEntry(rows[0]) : null;
  });
}

export async function deleteTimeEntry(id: string): Promise<boolean> {
  const rows = await db.query<{ id: string }>(
    `delete from segments where id = $1 and task_id is not null returning id`,
    [id],
  );
  return rows.length > 0;
}

/**
 * Recorded minutes per task, counting stopped and manual entries only — the
 * live timer is displayed separately so totals never move on their own.
 */
export async function recordedMinutesByTask(): Promise<Record<string, number>> {
  const rows = await db.query<{ task_id: string; total: string }>(
    `select task_id, sum(extract(epoch from (ended_at - started_at)) / 60) as total
       from segments
      where task_id is not null and ended_at is not null
      group by task_id`,
  );
  return Object.fromEntries(rows.map((r) => [r.task_id, Number(r.total)]));
}
