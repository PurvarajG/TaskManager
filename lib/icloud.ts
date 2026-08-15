import ical from "node-ical";

/**
 * Read-only bridge from iCloud CalDAV. Nothing here writes back to Apple, and
 * nothing here touches the database — imported events exist only for the life
 * of a request.
 *
 * Split in two on purpose: `eventsFromCalendarData` is pure and carries all the
 * fiddly recurrence/timezone logic (and all the tests), while
 * `getExternalEvents` does nothing but fetch and delegate.
 */

export type ExternalEvent = {
  id: string;
  title: string;
  /** All-day: `YYYY-MM-DD`. Timed: a full UTC ISO instant. */
  start: string;
  /** Same format as `start`. For all-day events this is *exclusive*, per iCalendar. */
  end: string;
  allDay: boolean;
};

const UNTITLED = "(No title)";

/**
 * The window is widened by a day on each side before filtering. The caller's
 * range comes from a calendar grid rendered in the *viewer's* timezone, while
 * this code runs on a server that is very likely UTC — a day of slack means a
 * late-evening event can never fall out of the range it visually belongs to.
 * A few extra fringe events are harmless: the UI keys them by date.
 */
const RANGE_SLACK_MS = 24 * 60 * 60 * 1000;

type ParsedEvent = {
  type?: string;
  uid?: string;
  summary?: string;
  start?: Date & { dateOnly?: boolean };
  end?: Date & { dateOnly?: boolean };
  rrule?: { between: (after: Date, before: Date, inclusive?: boolean) => Date[] };
  exdate?: Record<string, Date>;
  recurrences?: Record<string, ParsedEvent>;
};

/** UTC date parts — `dateOnly` values are anchored at UTC midnight by node-ical. */
function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function isoDateToUtc(iso: string): number {
  return Date.parse(`${iso}T00:00:00.000Z`);
}

function toExternalEvent(id: string, event: ParsedEvent, start: Date, end: Date): ExternalEvent {
  const allDay = event.start?.dateOnly === true;
  return {
    id,
    title: event.summary?.trim() || UNTITLED,
    start: allDay ? dateKey(start) : start.toISOString(),
    end: allDay ? dateKey(end) : end.toISOString(),
    allDay,
  };
}

function expandRecurring(event: ParsedEvent, uid: string, from: Date, to: Date): ExternalEvent[] {
  if (!event.rrule || !event.start) return [];

  const durationMs = (event.end?.getTime() ?? event.start.getTime()) - event.start.getTime();
  const excluded = new Set(Object.keys(event.exdate ?? {}).map((key) => key.slice(0, 10)));

  return event.rrule
    .between(from, to, true)
    .filter((occurrence) => !excluded.has(dateKey(occurrence)))
    .map((occurrence) => {
      const key = dateKey(occurrence);
      // A single moved/edited occurrence overrides the generated one.
      const override = event.recurrences?.[key];
      const start = override?.start ?? occurrence;
      const end = override?.end ?? new Date(start.getTime() + durationMs);
      return toExternalEvent(`${uid}::${key}`, override ?? event, start, end);
    });
}

/**
 * Turn raw iCalendar payloads (one per calendar object) into the events that
 * overlap `[startISO, endISO]`, expanding recurrence as it goes.
 *
 * Recurrence and timezone expansion is delegated to node-ical/rrule rather than
 * hand-rolled: getting it subtly wrong means a meeting silently shows on the
 * wrong day, which is worse than no import at all.
 */
export function eventsFromCalendarData(
  calendarData: string[],
  startISO: string,
  endISO: string,
): ExternalEvent[] {
  const from = new Date(isoDateToUtc(startISO) - RANGE_SLACK_MS);
  const to = new Date(isoDateToUtc(endISO) + RANGE_SLACK_MS + 24 * 60 * 60 * 1000);
  const events: ExternalEvent[] = [];

  for (const data of calendarData) {
    let parsed: Record<string, ParsedEvent>;
    try {
      parsed = ical.parseICS(data) as Record<string, ParsedEvent>;
    } catch {
      continue; // One malformed calendar object must not sink the whole fetch.
    }

    for (const [key, event] of Object.entries(parsed)) {
      if (event?.type !== "VEVENT" || !event.start) continue;
      const uid = event.uid ?? key;

      if (event.rrule) {
        events.push(...expandRecurring(event, uid, from, to));
        continue;
      }

      const start = event.start;
      const end = event.end ?? event.start;
      // Overlap, not containment: a trip that started before the range is still
      // happening during it.
      if (end.getTime() < from.getTime() || start.getTime() > to.getTime()) continue;
      events.push(toExternalEvent(uid, event, start, end));
    }
  }

  return events.sort((a, b) => a.start.localeCompare(b.start));
}

/**
 * `ICLOUD_APP_PASSWORD` must be an app-specific password from appleid.apple.com
 * — iCloud CalDAV rejects the real Apple ID password once 2FA is on.
 */
export async function getExternalEvents(startISO: string, endISO: string): Promise<ExternalEvent[]> {
  const username = process.env.ICLOUD_APPLE_ID;
  const password = process.env.ICLOUD_APP_PASSWORD;
  if (!username || !password) throw new Error("iCloud credentials are not configured");

  const { DAVClient } = await import("tsdav");
  const client = new DAVClient({
    serverUrl: "https://caldav.icloud.com",
    credentials: { username, password },
    authMethod: "Basic",
    defaultAccountType: "caldav",
  });

  await client.login();
  const calendars = await client.fetchCalendars();

  const perCalendar = await Promise.all(
    calendars.map(async (calendar) => {
      const objects = await client.fetchCalendarObjects({
        calendar,
        timeRange: { start: `${startISO}T00:00:00.000Z`, end: `${endISO}T23:59:59.999Z` },
      });
      return objects.map((object) => object.data as string).filter(Boolean);
    }),
  );

  return eventsFromCalendarData(perCalendar.flat(), startISO, endISO);
}
