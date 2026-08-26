import type { Task, TrackingSettings } from "./types";
import { addDays } from "./parse";
import { isOverdue } from "./summary";

export type WeekDayPlan = {
  /** Local YYYY-MM-DD. */
  date: string;
  /** Open tasks scheduled on this day, in the app's existing rank/sort order. */
  tasks: Task[];
  /** Sum of `minutes` across this day's tasks. */
  plannedMinutes: number;
  /** 0–1 fraction of the day's capacity ceiling the planned minutes occupy, capped at 1 for bar width. */
  capacityRatio: number;
  /** True fraction of the ceiling, uncapped — >1 means the day is over capacity. */
  trueCapacityRatio: number;
  /** Whether this day's ceiling comes from real waking-hours settings (false while settings are still loading). */
  ceilingIsProvisional: boolean;
};

export type WeekMetrics = {
  taskCount: number;
  plannedMinutes: number;
  overdueCount: number;
  /** The date (YYYY-MM-DD) of the day with the most planned minutes, or null if the week is empty. */
  busiestDate: string | null;
};

/**
 * The per-day capacity ceiling, in minutes, used to size the capacity bars.
 *
 * Preferred source: the waking-hours window already stored on
 * `TrackingSettings` (`wakingStartHour`/`wakingEndHour`) — the same "how much
 * of the day is usable" concept `lib/tracking-day.ts`'s `wakingWindow` derives
 * for the tracking day. No new setting is introduced.
 *
 * Fallback, only when settings haven't loaded yet: the busiest of the seven
 * days' own planned minutes, so the bars still render proportionally instead
 * of inventing a number.
 */
export function capacityCeilingMinutes(
  settings: TrackingSettings | null,
  dayPlannedMinutes: number[],
): number {
  if (settings) {
    const hours = settings.wakingEndHour - settings.wakingStartHour;
    if (hours > 0) return hours * 60;
  }
  const busiest = Math.max(0, ...dayPlannedMinutes);
  return busiest > 0 ? busiest : 1;
}

/**
 * Builds the seven day-columns (today through today+6 inclusive) for the
 * Next 7 Days grid, each with its planned minutes and a capacity ratio
 * derived from `settings`.
 */
export function buildWeekPlan(tasks: Task[], todayISO: string, settings: TrackingSettings | null): WeekDayPlan[] {
  const horizon = addDays(todayISO, 6);
  const open = tasks.filter((t) => t.status === "open" && t.scheduled >= todayISO && t.scheduled <= horizon);

  const byDay = new Map<string, Task[]>();
  for (const t of open) {
    const list = byDay.get(t.scheduled) ?? [];
    list.push(t);
    byDay.set(t.scheduled, list);
  }

  const dates: string[] = [];
  for (let i = 0; i <= 6; i++) dates.push(addDays(todayISO, i));

  const plannedByDate = dates.map((d) => (byDay.get(d) ?? []).reduce((sum, t) => sum + t.minutes, 0));
  const ceiling = capacityCeilingMinutes(settings, plannedByDate);
  // While settings hasn't loaded yet, the fallback ceiling is "the busiest
  // day's own minutes" rather than "fraction of your waking day" — a
  // different meaning that must not paint the same as the real one. Callers
  // use `ceilingIsProvisional` to suppress or visibly mark the bar until
  // settings resolve.
  const ceilingIsProvisional = !settings || settings.wakingEndHour - settings.wakingStartHour <= 0;

  return dates.map((date, i) => {
    const dayTasks = byDay.get(date) ?? [];
    const plannedMinutes = plannedByDate[i];
    const trueCapacityRatio = plannedMinutes / ceiling;
    return {
      date,
      tasks: dayTasks,
      plannedMinutes,
      capacityRatio: Math.min(1, trueCapacityRatio),
      trueCapacityRatio,
      ceilingIsProvisional,
    };
  });
}

/** Metrics for the Next 7 Days `MetricStrip`, computed entirely from real data. */
export function weekMetrics(tasks: Task[], todayISO: string, week: WeekDayPlan[]): WeekMetrics {
  const taskCount = week.reduce((sum, d) => sum + d.tasks.length, 0);
  const plannedMinutes = week.reduce((sum, d) => sum + d.plannedMinutes, 0);
  // Shared with the Today metric strip (lib/summary.ts) and the project
  // focus band (lib/focus.ts) — a complex task isn't overdue until its
  // finish date passes, not its start day.
  const overdueCount = tasks.filter((t) => t.status === "open" && isOverdue(t, todayISO)).length;

  let busiestDate: string | null = null;
  let busiestMinutes = 0;
  for (const d of week) {
    if (d.plannedMinutes > busiestMinutes) {
      busiestMinutes = d.plannedMinutes;
      busiestDate = d.date;
    }
  }

  return { taskCount, plannedMinutes, overdueCount, busiestDate };
}
