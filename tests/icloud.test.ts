import assert from "node:assert/strict";
import test from "node:test";
import { eventsFromCalendarData } from "../lib/icloud";

/** ICS needs CRLF, which is unreadable inline — authored with \n and fixed up here. */
function ics(body: string): string {
  return `BEGIN:VCALENDAR\nVERSION:2.0\n${body}\nEND:VCALENDAR`.replace(/\n/g, "\r\n");
}

const TIMED = ics(`BEGIN:VEVENT
UID:timed-1
DTSTART:20260310T140000Z
DTEND:20260310T150000Z
SUMMARY:Design review
END:VEVENT`);

const ALL_DAY = ics(`BEGIN:VEVENT
UID:allday-1
DTSTART;VALUE=DATE:20260312
DTEND;VALUE=DATE:20260314
SUMMARY:Offsite
END:VEVENT`);

// 09:00 New York weekly, crossing the 8 March DST boundary, with 16 March excluded.
const WEEKLY = ics(`BEGIN:VEVENT
UID:weekly-1
DTSTART;TZID=America/New_York:20260302T090000
DTEND;TZID=America/New_York:20260302T093000
RRULE:FREQ=WEEKLY;COUNT=6
EXDATE;TZID=America/New_York:20260316T090000
SUMMARY:Standup
END:VEVENT`);

const MARCH = ["2026-03-01", "2026-03-31"] as const;

test("a timed event maps to an instant-precise range", () => {
  const [event] = eventsFromCalendarData([TIMED], ...MARCH);
  assert.equal(event.id, "timed-1");
  assert.equal(event.title, "Design review");
  assert.equal(event.allDay, false);
  assert.equal(event.start, "2026-03-10T14:00:00.000Z");
  assert.equal(event.end, "2026-03-10T15:00:00.000Z");
});

test("an all-day event maps to plain dates with an exclusive end", () => {
  const [event] = eventsFromCalendarData([ALL_DAY], ...MARCH);
  assert.equal(event.allDay, true);
  assert.equal(event.start, "2026-03-12");
  assert.equal(event.end, "2026-03-14", "DTEND stays exclusive, as iCalendar defines it");
});

test("a recurring event is expanded into one entry per occurrence in range", () => {
  const events = eventsFromCalendarData([WEEKLY], ...MARCH);
  assert.deepEqual(
    events.map((e) => e.start),
    [
      "2026-03-02T14:00:00.000Z", // 09:00 EST
      "2026-03-09T13:00:00.000Z", // 09:00 EDT — the clocks changed on the 8th
      "2026-03-23T13:00:00.000Z",
      "2026-03-30T13:00:00.000Z",
    ],
    "every occurrence is 09:00 New York time, and the 16th is excluded",
  );
  for (const event of events) assert.equal(event.title, "Standup");
});

test("each occurrence gets a distinct id so the UI can key on it", () => {
  const ids = eventsFromCalendarData([WEEKLY], ...MARCH).map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.ok(id.startsWith("weekly-1"), id);
});

test("each occurrence keeps the original duration", () => {
  for (const event of eventsFromCalendarData([WEEKLY], ...MARCH)) {
    const minutes = (Date.parse(event.end) - Date.parse(event.start)) / 60_000;
    assert.equal(minutes, 30);
  }
});

test("occurrences outside the requested range are dropped", () => {
  const events = eventsFromCalendarData([WEEKLY], "2026-03-20", "2026-03-31");
  assert.deepEqual(
    events.map((e) => e.start.slice(0, 10)),
    ["2026-03-23", "2026-03-30"],
  );
});

test("an event entirely outside the range is dropped", () => {
  assert.deepEqual(eventsFromCalendarData([TIMED], "2026-06-01", "2026-06-30"), []);
});

test("a multi-day all-day event overlapping the range edge is kept", () => {
  // The trip runs 12-13 March; a range starting on the 13th still overlaps it.
  const events = eventsFromCalendarData([ALL_DAY], "2026-03-13", "2026-03-20");
  assert.equal(events.length, 1);
});

test("every calendar in the account is merged into one list", () => {
  const events = eventsFromCalendarData([TIMED, ALL_DAY], ...MARCH);
  assert.deepEqual(events.map((e) => e.title).sort(), ["Design review", "Offsite"]);
});

test("results are sorted by start so the UI renders them in order", () => {
  const events = eventsFromCalendarData([ALL_DAY, TIMED, WEEKLY], ...MARCH);
  const starts = events.map((e) => e.start);
  assert.deepEqual([...starts].sort(), starts);
});

test("an untitled event still renders as something", () => {
  const untitled = ics(`BEGIN:VEVENT
UID:bare-1
DTSTART:20260310T140000Z
DTEND:20260310T150000Z
END:VEVENT`);
  assert.equal(eventsFromCalendarData([untitled], ...MARCH)[0].title, "(No title)");
});

test("unparseable calendar data is skipped rather than failing the whole fetch", () => {
  const events = eventsFromCalendarData(["not an ics file at all", "", TIMED], ...MARCH);
  assert.deepEqual(
    events.map((e) => e.title),
    ["Design review"],
  );
});

test("non-event components are ignored", () => {
  const withTodo = ics(`BEGIN:VTODO
UID:todo-1
SUMMARY:Not an event
END:VTODO
BEGIN:VEVENT
UID:timed-2
DTSTART:20260310T140000Z
DTEND:20260310T150000Z
SUMMARY:Real event
END:VEVENT`);
  assert.deepEqual(
    eventsFromCalendarData([withTodo], ...MARCH).map((e) => e.title),
    ["Real event"],
  );
});

test("an event with no end falls back to its start", () => {
  const noEnd = ics(`BEGIN:VEVENT
UID:noend-1
DTSTART:20260310T140000Z
SUMMARY:Instant
END:VEVENT`);
  const [event] = eventsFromCalendarData([noEnd], ...MARCH);
  assert.equal(event.start, "2026-03-10T14:00:00.000Z");
  assert.equal(event.end, "2026-03-10T14:00:00.000Z");
});
