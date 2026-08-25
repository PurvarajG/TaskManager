import { toISODate } from "./parse";

export type CalendarDay = {
  iso: string;
  dayOfMonth: number;
  /** False for the leading/trailing days borrowed from the adjacent months. */
  inMonth: boolean;
  isWeekend: boolean;
};

/**
 * A month as whole weeks, Sunday-first, including the adjacent-month days that
 * fill the first and last rows. Always 6 rows, so the grid doesn't change
 * height as you page through months.
 */
export function monthGrid(year: number, month: number): CalendarDay[] {
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - first.getDay());

  return Array.from({ length: 42 }, (_, i) => {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const day = date.getDay();
    return {
      iso: toISODate(date),
      dayOfMonth: date.getDate(),
      inMonth: date.getMonth() === month && date.getFullYear() === year,
      isWeekend: day === 0 || day === 6,
    };
  });
}

export function monthLabel(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

export const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export type CalendarView = "day" | "week" | "month";
export const CALENDAR_VIEWS: CalendarView[] = ["day", "week", "month"];

/** The Sunday-first week containing `iso`, as seven whole days. */
export function weekGrid(iso: string): CalendarDay[] {
  const anchor = new Date(`${iso}T00:00:00`);
  const start = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() - anchor.getDay());

  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const day = date.getDay();
    return {
      iso: toISODate(date),
      dayOfMonth: date.getDate(),
      inMonth: true,
      isWeekend: day === 0 || day === 6,
    };
  });
}

/** A single day, shaped like the other grids so day/week/month share one row type. */
export function dayRange(iso: string): CalendarDay[] {
  const date = new Date(`${iso}T00:00:00`);
  const day = date.getDay();
  return [{ iso, dayOfMonth: date.getDate(), inMonth: true, isWeekend: day === 0 || day === 6 }];
}

/**
 * Steps the calendar's anchor date by one day/week/month, according to the
 * active view. Month arithmetic preserves the day-of-month (so paging months
 * then switching to day/week lands where you'd expect), clamped to the
 * target month's last day when it's shorter — Jan 31 + 1 month lands on Feb
 * 28/29, never spills into March.
 */
export function shift(view: CalendarView, iso: string, by: number): string {
  const date = new Date(`${iso}T00:00:00`);
  if (view === "day") {
    return toISODate(new Date(date.getFullYear(), date.getMonth(), date.getDate() + by));
  }
  if (view === "week") {
    return toISODate(new Date(date.getFullYear(), date.getMonth(), date.getDate() + by * 7));
  }
  const targetMonthIndex = date.getMonth() + by;
  const daysInTargetMonth = new Date(date.getFullYear(), targetMonthIndex + 1, 0).getDate();
  const clampedDay = Math.min(date.getDate(), daysInTargetMonth);
  return toISODate(new Date(date.getFullYear(), targetMonthIndex, clampedDay));
}

/** The header label for the active view, anchored at `iso`. */
export function viewLabel(view: CalendarView, iso: string): string {
  const date = new Date(`${iso}T00:00:00`);
  if (view === "day") {
    return date.toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }
  if (view === "week") {
    const days = weekGrid(iso);
    const startDate = new Date(`${days[0].iso}T00:00:00`);
    const endDate = new Date(`${days[6].iso}T00:00:00`);
    const from = startDate.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    const to = endDate.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    return `${from} – ${to}`;
  }
  return monthLabel(date.getFullYear(), date.getMonth());
}
