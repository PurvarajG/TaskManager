# Apple Calendar Sync — Implementation Plan

Spec: [`docs/superpowers/specs/2026-08-15-apple-calendar-sync-design.md`](../specs/2026-08-15-apple-calendar-sync-design.md)

**Goal:** Two independent, read-only bridges to Apple Calendar — an ICS feed Apple
subscribes to (export), and iCloud CalDAV events rendered on `/calendar` (import).

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind v4,
node:test (`npm run test:unit`), Vitest + Testing Library (`npm run test:ui`).

## Global constraints

- No schema migrations. Neither direction touches the DB.
- Export and import share no code. Either can ship or be reverted alone.
- Every iCloud failure mode collapses to `{ events: [], ok: false }` — never a 500,
  never an error banner.
- `/api/calendar-feed` is the **only** route that bypasses the `proxy.ts` session
  gate, and it carries its own token check inside the handler.

## Track A — Export (tasks → Apple Calendar)

- [x] **A1. `lib/ics.ts` — `buildIcsFeed(tasks)`** ✅ 15 tests in `tests/ics.test.ts`
      Pure RFC 5545 generation: `escapeIcsText`, `foldLine` (75 octets), CRLF,
      `PRODID -//DayPlan//Task Feed//EN`, `UID ${id}@dayplan`, `DTSTAMP` UTC.
      Event shape: complex+`finishDate` → all-day with exclusive `DTEND`;
      `dueTime` → floating timed event `+minutes`; else single all-day.
      No `RRULE` (recurrence is virtual in this app).
      *Tests* (`tests/ics.test.ts`): timed, all-day, multi-day, escaping, folding.
      *Acceptance:* open tasks only; feed parses as valid VCALENDAR text.

- [x] **A2. Feed route + public path** ✅ 6 tests in `tests/calendar-feed.test.ts`, 2 in `tests/proxy.test.ts`
      `app/api/calendar-feed/route.ts` `GET` → `text/calendar; charset=utf-8`, built
      from `store.allTasks()` filtered to `status === "open"`. Add
      `/api/calendar-feed` to `PUBLIC_PATHS` in `proxy.ts`. Token check via
      `passwordMatches` against `CALENDAR_FEED_SECRET`.
      *Acceptance:* no secret → 503; missing/wrong `?token=` → 401; correct → 200.
      *Tests:* extend `tests/ics.test.ts`; add a `PUBLIC_PATHS` case to `tests/proxy.test.ts`.

- [x] **A3. Settings page** ✅ 5 tests in `tests/ui/settings.test.tsx`
      `app/settings/page.tsx` + `Sidebar` `NAV` entry. Behind the normal cookie gate.
      Shows the copyable `webcal://<origin>/api/calendar-feed?token=…` built
      client-side, or setup instructions when `CALENDAR_FEED_SECRET` is unset.
      *Acceptance:* renders instructions when unconfigured; renders a copyable URL otherwise.

## Track B — Import (iCloud → `/calendar`)

- [x] **B1. `lib/icloud.ts` — `getExternalEvents(startISO, endISO)`**
      `tsdav` (`DAVClient`, `https://caldav.icloud.com`, Basic) across all calendars,
      `node-ical` to parse and expand recurrence within the range. New env vars
      `ICLOUD_APPLE_ID` / `ICLOUD_APP_PASSWORD`. New deps: `tsdav`, `node-ical`.
      *Tests* (`tests/icloud.test.ts`): mapping against canned fixtures — recurring
      expansion in range, all-day vs timed. No real network calls.
      ⚠️ *Adds runtime dependencies and reads a credential env var — confirm before starting.*

- [ ] **B2. `app/api/external-events/route.ts`**
      `GET ?start=&end=`, stays behind the cookie session. Always `200`
      `{ events, ok }`. Unset env or thrown CalDAV error → `{ events: [], ok: false }`
      with `console.error`. Module-level `Map` cache keyed `"start|end"`, ~5 min TTL.
      *Acceptance:* mocked `getExternalEvents` throwing still yields 200 + `ok: false`.

- [ ] **B3. Calendar page rendering**
      `lib/useExternalEvents.ts` hook keyed on the visible 42-day range
      (`days[0].iso`..`days[41].iso`). `app/calendar/page.tsx` builds
      `externalByDate` alongside `tasksByDate`. `MonthGrid` gains `externalByDate`
      (muted, non-interactive pill below task markers); `DayPanel` gains
      `externalEvents` ("From Apple Calendar", time range or "All day", no edit
      affordances). `ok: false` → render nothing, no banner.
      *Tests* (`tests/ui/calendar.test.tsx`): pills render, are visually distinct,
      and are inert on click/drag.

## Order

A1 → A2 → A3 are strictly sequential. B1 → B2 → B3 likewise. The two tracks are
independent and may interleave in any order; A ships useful value on its own.
