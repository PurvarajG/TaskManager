import type { Task } from "./types";

/**
 * Minutes as "45m", "2h 30m", "3d 4h". Estimates are unbounded — a task can be
 * a miniproject — so past a day it rolls over rather than printing "720h", and
 * only ever shows the two most significant units it has. A day is 24h here, to
 * match what `3d` means to the quick-add parser.
 */
export function fmt(mins: number): string {
  const parts: string[] = [];
  const d = Math.floor(mins / 1440);
  const h = Math.floor((mins % 1440) / 60);
  const m = mins % 60;

  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m || !parts.length) parts.push(`${m}m`);

  return parts.slice(0, 2).join(" ");
}

/** p1 is the most urgent; unset priority sorts last. */
export function rank(t: Task): number {
  return t.priority === 0 ? 4 : t.priority;
}

export const PRIORITY_LABEL = ["", "P1", "P2", "P3"] as const;

/** "2026-08-14" -> "Fri, Aug 14", read from the local parts so it never shifts a day. */
export function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/** "15:30" -> "3:30 PM". */
export function fmtTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const period = h < 12 ? "AM" : "PM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}
