import { randomUUID } from "node:crypto";
import { withTransaction } from "../db";
import type { Tx } from "../db";
import { MIN_TRACKED_MINUTES, type TimeEntry } from "../types";
import { db, rowToTimeEntry, type Q, type TimeEntryRow } from "./rows";

/** Thrown when a second timer would start; APIs map it to 409 with the running task. */
export class TimerConflict extends Error {
  constructor(readonly runningTaskId: string) {
    super("Another task is already being timed");
  }
}

export async function listTimeEntries(taskId?: string): Promise<TimeEntry[]> {
  const rows = taskId
    ? await db.query<TimeEntryRow>(
        `select * from time_entries where task_id = $1 order by started_at desc`,
        [taskId],
      )
    : await db.query<TimeEntryRow>(`select * from time_entries order by started_at desc`);
  return rows.map(rowToTimeEntry);
}

export async function runningEntry(q: Q = db): Promise<TimeEntry | null> {
  const rows = await q.query<TimeEntryRow>(
    `select * from time_entries where ended_at is null limit 1`,
  );
  return rows.length ? rowToTimeEntry(rows[0]) : null;
}

async function insertRunning(tx: Tx, taskId: string): Promise<TimeEntry> {
  const rows = await tx.query<TimeEntryRow>(
    `insert into time_entries (id, task_id, started_at, running_lock)
     values ($1, $2, now(), true) returning *`,
    [randomUUID(), taskId],
  );
  return rowToTimeEntry(rows[0]);
}

/** Elapsed whole minutes, never recording less than a minute of real work. */
export function elapsedMinutes(startedAt: string, endedAt: string): number {
  const ms = new Date(endedAt).getTime() - new Date(startedAt).getTime();
  return Math.max(MIN_TRACKED_MINUTES, Math.floor(ms / 60_000));
}

async function stopRunning(tx: Tx): Promise<TimeEntry | null> {
  const rows = await tx.query<TimeEntryRow>(
    `update time_entries
        set ended_at = now(),
            running_lock = null,
            minutes = greatest($1, floor(extract(epoch from (now() - started_at)) / 60)),
            updated_at = now()
      where ended_at is null
      returning *`,
    [MIN_TRACKED_MINUTES],
  );
  return rows.length ? rowToTimeEntry(rows[0]) : null;
}

export async function startTimer(taskId: string): Promise<TimeEntry> {
  return withTransaction(async (tx) => {
    const running = await runningEntry(tx);
    if (running) throw new TimerConflict(running.taskId);
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
  const rows = await db.query<TimeEntryRow>(
    `insert into time_entries (id, task_id, started_at, ended_at, minutes, note)
     values ($1, $2, $3, $3::timestamptz + make_interval(mins => $4::int), $4, $5)
     returning *`,
    [randomUUID(), input.taskId, input.startedAt, input.minutes, input.note ?? null],
  );
  return rowToTimeEntry(rows[0]);
}

/** Running entries are not retrospectively editable — stop them first. */
export async function updateTimeEntry(
  id: string,
  patch: { startedAt?: string; minutes?: number; note?: string },
): Promise<TimeEntry | null> {
  const sets: string[] = [];
  const vals: unknown[] = [];
  let i = 1;
  if (patch.startedAt !== undefined) {
    sets.push(`started_at = $${i++}`);
    vals.push(patch.startedAt);
  }
  if (patch.minutes !== undefined) {
    sets.push(`minutes = $${i++}`);
    vals.push(patch.minutes);
  }
  if (patch.note !== undefined) {
    sets.push(`note = $${i++}`);
    vals.push(patch.note || null);
  }
  if (sets.length === 0) return null;
  vals.push(id);

  return withTransaction(async (tx) => {
    const rows = await tx.query<TimeEntryRow>(
      `update time_entries set ${sets.join(", ")}, updated_at = now()
        where id = $${i} and ended_at is not null returning *`,
      vals,
    );
    if (rows.length === 0) return null;
    // A separate statement, because SET expressions all read the pre-update
    // row — deriving ended_at inline would use the *old* start and duration.
    const synced = await tx.query<TimeEntryRow>(
      `update time_entries set ended_at = started_at + make_interval(mins => minutes)
        where id = $1 returning *`,
      [id],
    );
    return rowToTimeEntry(synced[0]);
  });
}

export async function deleteTimeEntry(id: string): Promise<boolean> {
  const rows = await db.query<{ id: string }>(
    `delete from time_entries where id = $1 returning id`,
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
    `select task_id, sum(minutes) as total from time_entries
      where ended_at is not null group by task_id`,
  );
  return Object.fromEntries(rows.map((r) => [r.task_id, Number(r.total)]));
}
