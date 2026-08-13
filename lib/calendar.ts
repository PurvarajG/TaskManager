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

/** Month arithmetic that can't land on the 31st of a 30-day month. */
export function shiftMonth(
  year: number,
  month: number,
  by: number,
): { year: number; month: number } {
  const date = new Date(year, month + by, 1);
  return { year: date.getFullYear(), month: date.getMonth() };
}

export const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
