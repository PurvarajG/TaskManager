# Apple Calendar Sync Design

## Goal

Two independent, read-only bridges to Apple Calendar (iCloud):

1. **Export** — open tasks show up in Apple Calendar as a subscribed feed, so
   they're visible from your phone/Mac calendar app without editing this app.
2. **Import** — your existing iCloud events show up on this app's `/calendar`
   page, for reference while planning tasks, without editing them here.

Neither direction supports editing across the boundary. Each ships and can be
reverted independently.

## Export: tasks → Apple Calendar feed

### Feed route

`app/api/calendar-feed/route.ts` — `GET`, returns `text/calendar; charset=utf-8`.

This route is intentionally **not** behind the cookie session — Apple Calendar
re-polls the URL on its own schedule and can't carry a login cookie. Instead:

- `proxy.ts`'s `PUBLIC_PATHS` gains `/api/calendar-feed` (it currently redirects
  anything not in that set to `/login`, which would break the feed).
- The route itself checks `?token=` against a new `CALENDAR_FEED_SECRET` env
  var using `passwordMatches` from `lib/auth.ts` (same constant-time hash
  compare already used for the login password).
  - `CALENDAR_FEED_SECRET` unset → `503`.
  - Missing/wrong token → `401`.

### Feed generation

New `lib/ics.ts`, pure and unit-testable:

```ts
export function buildIcsFeed(tasks: Task[]): string
```

- Input is `store.allTasks()` filtered to `status === "open"` (done/trashed
  tasks drop off the feed on the next refresh).
- One `VEVENT` per task:
  - `isComplex && finishDate` → all-day event, `DTSTART;VALUE=DATE=scheduled`,
    `DTEND;VALUE=DATE=<finishDate + 1 day>` (iCal `DTEND` is exclusive).
  - else if `dueTime` set → timed event: floating local `DTSTART` from
    `scheduled`+`dueTime` (no `TZID`/`Z` — treated as the viewing device's
    local time, correct for a single-timezone personal calendar), `DTEND` =
    `DTSTART + minutes`.
  - else → single all-day event on `scheduled`.
  - `UID`: `${task.id}@dayplan` — stable across refetches so Apple Calendar
    updates the same event instead of duplicating it.
  - `SUMMARY` = title, `DESCRIPTION` = notes (if present).
  - `DTSTAMP` = now, UTC.
- No `RRULE`: recurrence in this app is virtual (completing a task spawns the
  *next* occurrence as a new row — see `lib/store/tasks.ts`), so every
  occurrence is already its own task/VEVENT.
- Helpers for RFC 5545 correctness: `escapeIcsText` (comma/semicolon/backslash/
  newline), `foldLine` (75-octet folding), CRLF line endings, `PRODID`
  `-//DayPlan//Task Feed//EN`.

### Settings page

New `app/settings/page.tsx`, added to `Sidebar`'s `NAV` array. Behind the
normal cookie gate (nothing special needed — it's not in `PUBLIC_PATHS`).
Shows the full `webcal://<host>/api/calendar-feed?token=...` URL to copy
(built client-side from `window.location.origin`), or setup instructions if
`CALENDAR_FEED_SECRET` isn't configured yet.

## Import: Apple Calendar → `/calendar` page

### iCloud client

New `lib/icloud.ts`:

```ts
export type ExternalEvent = { id: string; title: string; start: string; end: string; allDay: boolean };
export async function getExternalEvents(startISO: string, endISO: string): Promise<ExternalEvent[]>
```

- New env vars `ICLOUD_APPLE_ID` / `ICLOUD_APP_PASSWORD` (an app-specific
  password from appleid.apple.com — iCloud CalDAV rejects the real Apple ID
  password once 2FA is on).
- Uses `tsdav` (`DAVClient`, `serverUrl: "https://caldav.icloud.com"`,
  `authMethod: "Basic"`) to discover and fetch calendar objects across **all**
  calendars in the account for the given range.
- Uses `node-ical` to parse the returned iCalendar data and expand recurring
  events within `[startISO, endISO]`.
- New dependencies: `tsdav`, `node-ical`. Justified over hand-rolled CalDAV/
  RRULE parsing because getting recurrence/timezone expansion subtly wrong
  means a meeting silently shows on the wrong day — not worth the DIY risk for
  two small, purpose-built libraries.

### API route

`app/api/external-events/route.ts` — `GET ?start=&end=`, **stays behind** the
normal cookie session (unlike the export feed, this is an in-app authenticated
fetch, not a public URL).

- Returns `{ events: ExternalEvent[]; ok: boolean }`, always `200`.
- `ok: false` (with `events: []`) when `ICLOUD_APPLE_ID`/`ICLOUD_APP_PASSWORD`
  are unset, or when the CalDAV fetch throws (logged server-side via
  `console.error`, never surfaced to the client as a hard error). The route
  never 500s for this feature — a broken/unset iCloud connection must not
  break the calendar page.
- Module-level in-memory cache (`Map<"start|end", { expires, data }>`, ~5 min
  TTL) so rapid month navigation on a warm serverless instance doesn't refetch
  iCloud on every click. Best-effort only — a cold instance just refetches.

### Calendar page

- New `lib/useExternalEvents.ts` hook (co-located with the existing
  `lib/useNow.ts`, `lib/useBoardDrag.ts` — not added to the global
  `store-context`, since this is scoped to the one page, not app-wide task
  state). Fires on `[rangeStart, rangeEnd]` change, where the range is the
  visible 42-day grid (`days[0].iso` .. `days[41].iso` from the existing
  `monthGrid()` output).
- `app/calendar/page.tsx` builds an `externalByDate` map from the hook's
  result (same shape/pattern as the existing `tasksByDate` map).
- `MonthGrid` gains an `externalByDate` prop: renders external events as a
  visually distinct, non-interactive pill (no drag, no click-to-edit,
  outline/muted style) below the task markers for that day.
- `DayPanel` gains an `externalEvents` prop: a read-only "From Apple Calendar"
  section, showing time range for timed events or "All day", with no edit
  affordances.
- If the hook's `ok` is `false`, the grid/panel simply show no external events
  — no error banner, no retry UI. This matches the single-owner, personal-use
  nature of the app: a quiet no-op is preferable to a warning you'll see every
  time iCloud has a hiccup.

## Testing

- `tests/ics.test.ts` — `buildIcsFeed` against sample tasks: timed, all-day,
  multi-day, special characters in title/notes (escaping), long titles (line
  folding). Feed route: missing token → 401, wrong token → 401, correct token
  → 200 with `text/calendar` content type, missing `CALENDAR_FEED_SECRET` →
  503.
- `tests/icloud.test.ts` — event-mapping logic against canned CalDAV/
  `node-ical` fixtures (no real iCloud calls in tests): recurring event
  expansion within a range, all-day vs. timed mapping. `external-events`
  route: mocked `getExternalEvents` throwing → route still returns `200` with
  `{ events: [], ok: false }`.
- `tests/ui/calendar.test.tsx` — external events render as read-only pills
  distinct from task markers; dragging/clicking them is a no-op.

## Out of scope for v1

- Editing across either boundary — both directions are read-only by design.
- Per-calendar selection on the import side (all calendars in the iCloud
  account are merged).
- Surfacing imported events anywhere besides `/calendar` (not Today's
  timeline).
- Push/webhook sync. Export is pulled by Apple Calendar on its own polling
  schedule; import is pulled by the app on calendar-page load/navigation with
  a 5-minute cache.
- A DB-backed cache for imported events — the in-memory cache is best-effort
  only, consistent with this being a low-stakes reference feature.

## Self-review

- Export and import share no code path beyond both living under
  `lib/`/`app/api/` — either can be built, shipped, or reverted alone.
- The export route is the only route in the app that intentionally bypasses
  `proxy.ts`'s session gate; it compensates with its own token check inside
  the handler, so removing it from `PUBLIC_PATHS` by accident would only make
  the feed *more* locked down, never less.
- The import route stays inside the normal auth boundary — it's an
  authenticated in-app fetch, not a public feed, so it needs no separate
  secret.
- Every iCloud failure mode (unset env vars, bad app-password, network error,
  CalDAV error) collapses to the same `{ events: [], ok: false }` shape, so
  the UI has exactly one degraded state to handle, not several.
