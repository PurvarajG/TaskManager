import { toISODate } from "./parse";
import type { TrackingSettings } from "./types";

/** A Date built from local Y/M/D + hour — the same day-boundary convention lib/store/segments.ts uses. */
function hourOnDay(dayISO: string, hour: number): Date {
  const [y, m, d] = dayISO.split("-").map(Number);
  return new Date(y, m - 1, d, hour, 0, 0, 0);
}

/**
 * The tracking day `now` currently belongs to. A day runs dayStartHour ->
 * dayStartHour, so the small hours before the boundary still belong to
 * yesterday's day.
 */
export function currentTrackingDayISO(now: Date, dayStartHour: number): string {
  const todayISO = toISODate(now);
  return now.getHours() < dayStartHour ? addOneDay(todayISO, -1) : todayISO;
}

function addOneDay(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return toISODate(new Date(y, m - 1, d + n));
}

/** The [start, end) window a tracking day covers, as Date objects. */
export function dayWindow(dayISO: string, settings: TrackingSettings): { start: Date; end: Date } {
  const start = hourOnDay(dayISO, settings.dayStartHour);
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
}

/** The waking sub-window of a tracking day, as Date objects. */
export function wakingWindow(dayISO: string, settings: TrackingSettings): { start: Date; end: Date } {
  return { start: hourOnDay(dayISO, settings.wakingStartHour), end: hourOnDay(dayISO, settings.wakingEndHour) };
}

export function shiftTrackingDay(dayISO: string, n: number): string {
  return addOneDay(dayISO, n);
}
