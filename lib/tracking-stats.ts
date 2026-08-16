import { wakingWindow } from "./tracking-day";
import type { Category, CategoryKind, Project, Segment, Task, TrackingSettings } from "./types";

function minutesBetween(fromISO: string, toISO: string): number {
  return (new Date(toISO).getTime() - new Date(fromISO).getTime()) / 60_000;
}

/**
 * Tracked minutes ÷ waking minutes elapsed so far. For a past day the whole
 * waking window has elapsed; for today, only up to now; a future day hasn't
 * started yet.
 */
export function coveragePercent(
  segments: Segment[],
  dayISO: string,
  todayISO: string,
  settings: TrackingSettings,
  now: Date,
): number {
  const { start: wakeStart, end: wakeEnd } = wakingWindow(dayISO, settings);
  const elapsedEnd = dayISO < todayISO ? wakeEnd : dayISO > todayISO ? wakeStart : now < wakeEnd ? now : wakeEnd;
  const elapsedMinutes = Math.max(0, (elapsedEnd.getTime() - wakeStart.getTime()) / 60_000);
  if (elapsedMinutes === 0) return 0;

  const tracked = segments.reduce((sum, s) => sum + minutesBetween(s.startedAt, s.endedAt ?? now.toISOString()), 0);
  return Math.min(100, Math.round((tracked / elapsedMinutes) * 100));
}

/** The longest single continuous segment, not a chain of same-category ones. */
export function longestStretchMinutes(segments: Segment[], now: Date): number {
  return Math.round(
    segments.reduce((max, s) => Math.max(max, minutesBetween(s.startedAt, s.endedAt ?? now.toISOString())), 0),
  );
}

/** The hour with the most segment starts — a rough proxy for context-switching. */
export function mostFragmentedHour(segments: Segment[]): number | null {
  if (segments.length === 0) return null;
  const counts = new Map<number, number>();
  for (const s of segments) {
    const hour = new Date(s.startedAt).getHours();
    counts.set(hour, (counts.get(hour) ?? 0) + 1);
  }
  let best: number | null = null;
  let bestCount = 0;
  for (const [hour, count] of counts) {
    if (count > bestCount) {
      best = hour;
      bestCount = count;
    }
  }
  return bestCount > 1 ? best : null;
}

/** Time by category `kind` — never by name, so a renamed category never desyncs a summary. */
export function minutesByKind(
  segments: Segment[],
  categories: Category[],
  now: Date,
): Record<CategoryKind, number> {
  const totals: Record<CategoryKind, number> = { work: 0, rest: 0, upkeep: 0, unclassified: 0 };
  for (const s of segments) {
    const kind = categories.find((c) => c.id === s.categoryId)?.kind ?? "unclassified";
    totals[kind] += minutesBetween(s.startedAt, s.endedAt ?? now.toISOString());
  }
  for (const kind of Object.keys(totals) as CategoryKind[]) totals[kind] = Math.round(totals[kind]);
  return totals;
}

export type ProjectMinutes = { project: Project | null; minutes: number };

/**
 * Time by project, through the task each segment is linked to — only
 * task-linked segments count, since an activity was never anyone's project.
 * A task whose project was deleted (or was never assigned one) lands in the
 * `project: null` "No project" bucket, so the total minutes tracked on tasks
 * always adds up.
 */
export function minutesByProject(
  segments: Segment[],
  tasks: Task[],
  projects: Project[],
  now: Date,
): ProjectMinutes[] {
  const totals = new Map<string | null, number>();
  for (const s of segments) {
    if (!s.taskId) continue;
    const task = tasks.find((t) => t.id === s.taskId);
    const projectId = task?.projectId ?? null;
    const minutes = minutesBetween(s.startedAt, s.endedAt ?? now.toISOString());
    totals.set(projectId, (totals.get(projectId) ?? 0) + minutes);
  }
  return [...totals.entries()]
    .map(([projectId, minutes]) => ({
      project: projectId ? (projects.find((p) => p.id === projectId) ?? null) : null,
      minutes: Math.round(minutes),
    }))
    .sort((a, b) => b.minutes - a.minutes);
}
