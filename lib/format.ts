import type { Task } from "./types";

export function fmt(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (!h) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
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
