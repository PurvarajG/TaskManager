import {
  DURATIONS,
  type Duration,
  type Priority,
  type Recurrence,
  type RecurrenceFreq,
  type TaskInput,
} from "./types";

const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

/** Local calendar date as YYYY-MM-DD. Never use toISOString here — it shifts by timezone. */
export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return toISODate(new Date(y, m - 1, d + n));
}

export function daysBetween(fromISO: string, toISO: string): number {
  const [y1, m1, d1] = fromISO.split("-").map(Number);
  const [y2, m2, d2] = toISO.split("-").map(Number);
  const a = Date.UTC(y1, m1 - 1, d1);
  const b = Date.UTC(y2, m2 - 1, d2);
  return Math.round((b - a) / 86_400_000);
}

function snapDuration(mins: number): Duration {
  return DURATIONS.reduce((best, d) =>
    Math.abs(d - mins) < Math.abs(best - mins) ? d : best,
  );
}

/** "3pm", "3:30pm", "9am", "15:00" -> "HH:MM" (24h), or null if not a time. */
function parseTimeToken(token: string): string | null {
  const ampm = /^(\d{1,2})(?::(\d{2}))?(am|pm)$/.exec(token);
  if (ampm) {
    let h = Number(ampm[1]) % 12;
    if (ampm[3] === "pm") h += 12;
    const m = ampm[2] ?? "00";
    return `${String(h).padStart(2, "0")}:${m}`;
  }
  const clock = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(token);
  if (clock) return `${clock[1].padStart(2, "0")}:${clock[2]}`;
  return null;
}

/** "daily", "weekly", "monthly", "every2w", "every3d" -> a recurrence rule. */
function parseRecurrenceToken(token: string): Recurrence | null {
  const named: Record<string, RecurrenceFreq> = {
    daily: "daily",
    weekly: "weekly",
    monthly: "monthly",
  };
  if (token in named) return { freq: named[token], interval: 1 };

  const every = /^every(\d*)([dwm])$/.exec(token);
  if (every) {
    const interval = Number(every[1] || 1);
    const freq: RecurrenceFreq =
      every[2] === "d" ? "daily" : every[2] === "w" ? "weekly" : "monthly";
    return { freq, interval };
  }

  return null;
}

/** Advance `fromISO` by one recurrence step, keeping it aligned to the original day-of-month/week. */
export function nextOccurrence(fromISO: string, r: Recurrence): string {
  const [y, m, d] = fromISO.split("-").map(Number);
  if (r.freq === "daily") return addDays(fromISO, r.interval);
  if (r.freq === "weekly") return addDays(fromISO, r.interval * 7);
  return toISODate(new Date(y, m - 1 + r.interval, d));
}

function parseDayToken(token: string, todayISO: string): string | null {
  if (token === "today" || token === "tod") return todayISO;
  if (token === "tomorrow" || token === "tmrw" || token === "tom") {
    return addDays(todayISO, 1);
  }

  // +3d — three days out
  const rel = /^\+(\d+)d$/.exec(token);
  if (rel) return addDays(todayISO, Number(rel[1]));

  // mon / tues / thurs — the *next* occurrence, never today
  const idx = WEEKDAYS.findIndex((w) => token.startsWith(w) && token.length <= 9);
  if (idx !== -1) {
    const [y, m, d] = todayISO.split("-").map(Number);
    const current = new Date(y, m - 1, d).getDay();
    const delta = (idx - current + 7) % 7 || 7;
    return addDays(todayISO, delta);
  }

  return null;
}

export type ParsedQuickAdd = Omit<TaskInput, "projectId"> & { projectName?: string };

/**
 * Turns "call dentist thu 30m p1 3pm weekly #health @calls" into a task.
 * Everything is optional — bare text becomes a 30-minute task today, because
 * capture has to stay faster than the thought that prompted it.
 *
 *   #project   assigns/creates a list (first one wins)
 *   @tag       adds a free tag (repeatable)
 *   p1/p2/p3   priority
 *   30m / 2h   duration, snapped to the nearest allowed size
 *   thu / +3d / today / tomorrow   the day to schedule it
 *   3pm / 15:00   a due time on that day
 *   daily / weekly / monthly / every2w   recurrence
 */
export function parseQuickAdd(raw: string, now = new Date()): ParsedQuickAdd {
  const todayISO = toISODate(now);
  let minutes: Duration | undefined;
  let priority: Priority = 0;
  let projectName: string | undefined;
  const tags: string[] = [];
  let scheduled: string | undefined;
  let dueTime: string | undefined;
  let recurrence: Recurrence | undefined;

  const kept: string[] = [];

  for (const word of raw.trim().split(/\s+/)) {
    const lower = word.toLowerCase();

    if (lower.startsWith("#") && word.length > 1 && !projectName) {
      projectName = word.slice(1);
      continue;
    }

    if (lower.startsWith("@") && word.length > 1) {
      tags.push(word.slice(1).toLowerCase());
      continue;
    }

    const p = /^p([123])$/.exec(lower);
    if (p) {
      priority = Number(p[1]) as Priority;
      continue;
    }

    const dur = /^(\d+(?:\.\d+)?)(m|min|mins|h|hr|hrs)$/.exec(lower);
    if (dur) {
      const n = parseFloat(dur[1]);
      minutes = snapDuration(dur[2].startsWith("h") ? n * 60 : n);
      continue;
    }

    const time = parseTimeToken(lower);
    if (time) {
      dueTime = time;
      continue;
    }

    const rec = parseRecurrenceToken(lower);
    if (rec) {
      recurrence = rec;
      continue;
    }

    const day = parseDayToken(lower, todayISO);
    if (day) {
      scheduled = day;
      continue;
    }

    kept.push(word);
  }

  const title = kept.join(" ").trim();

  return {
    title: title || raw.trim(),
    projectName,
    tags,
    priority,
    minutes: minutes ?? 30,
    scheduled: scheduled ?? todayISO,
    dueTime,
    recurrence,
  };
}
