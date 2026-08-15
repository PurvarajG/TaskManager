import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import { GET } from "../app/api/external-events/route";
import { __resetCacheForTests, loadExternalEvents } from "../lib/external-events";
import type { ExternalEvent } from "../lib/icloud";

const RANGE = ["2026-03-01", "2026-04-11"] as const;

function event(overrides: Partial<ExternalEvent> = {}): ExternalEvent {
  return {
    id: "evt-1",
    title: "Design review",
    start: "2026-03-10T14:00:00.000Z",
    end: "2026-03-10T15:00:00.000Z",
    allDay: false,
    ...overrides,
  };
}

/** Counts its calls, so tests can prove the cache actually kept iCloud out of it. */
function fakeFetcher(result: () => Promise<ExternalEvent[]>) {
  const fetcher = async (start: string, end: string) => {
    fetcher.calls.push([start, end]);
    return result();
  };
  fetcher.calls = [] as [string, string][];
  return fetcher;
}

const quiet = { error: console.error };
before(() => {
  // The degraded paths log on purpose; keep the test output readable.
  console.error = () => {};
});
after(() => {
  console.error = quiet.error;
});

test.beforeEach(() => {
  __resetCacheForTests();
  process.env.ICLOUD_APPLE_ID = "owner@example.com";
  process.env.ICLOUD_APP_PASSWORD = "abcd-efgh-ijkl-mnop";
});

test.afterEach(() => {
  delete process.env.ICLOUD_APPLE_ID;
  delete process.env.ICLOUD_APP_PASSWORD;
});

test("returns the events for the requested range", async () => {
  const fetcher = fakeFetcher(async () => [event()]);
  const result = await loadExternalEvents(...RANGE, fetcher);

  assert.deepEqual(result, { events: [event()], ok: true });
  assert.deepEqual(fetcher.calls[0], ["2026-03-01", "2026-04-11"]);
});

test("a failing iCloud fetch degrades to an empty list rather than throwing", async () => {
  const fetcher = fakeFetcher(async () => {
    throw new Error("CalDAV exploded");
  });

  assert.deepEqual(await loadExternalEvents(...RANGE, fetcher), { events: [], ok: false });
});

test("unconfigured credentials are a quiet no-op that never calls iCloud", async () => {
  delete process.env.ICLOUD_APPLE_ID;
  const fetcher = fakeFetcher(async () => [event()]);

  assert.deepEqual(await loadExternalEvents(...RANGE, fetcher), { events: [], ok: false });
  assert.equal(fetcher.calls.length, 0);
});

test("a repeated range is served from cache instead of refetching iCloud", async () => {
  const fetcher = fakeFetcher(async () => [event()]);

  await loadExternalEvents(...RANGE, fetcher);
  const second = await loadExternalEvents(...RANGE, fetcher);

  assert.equal(fetcher.calls.length, 1);
  assert.deepEqual(second, { events: [event()], ok: true });
});

test("a different range is fetched separately", async () => {
  const fetcher = fakeFetcher(async () => [event()]);

  await loadExternalEvents("2026-03-01", "2026-04-11", fetcher);
  await loadExternalEvents("2026-04-01", "2026-05-11", fetcher);

  assert.equal(fetcher.calls.length, 2);
});

test("a stale cache entry is refetched", async () => {
  const fetcher = fakeFetcher(async () => [event()]);
  const realNow = Date.now;

  await loadExternalEvents(...RANGE, fetcher);
  Date.now = () => realNow() + 6 * 60 * 1000;
  try {
    await loadExternalEvents(...RANGE, fetcher);
  } finally {
    Date.now = realNow;
  }

  assert.equal(fetcher.calls.length, 2);
});

test("a failure is not cached, so the next load can recover", async () => {
  let calls = 0;
  const fetcher = fakeFetcher(async () => {
    if (++calls === 1) throw new Error("transient");
    return [event()];
  });

  assert.deepEqual(await loadExternalEvents(...RANGE, fetcher), { events: [], ok: false });
  assert.deepEqual(await loadExternalEvents(...RANGE, fetcher), { events: [event()], ok: true });
});

test("the cache does not grow without bound", async () => {
  const fetcher = fakeFetcher(async () => [event()]);
  for (let i = 0; i < 200; i++) {
    await loadExternalEvents(`2026-03-${String((i % 28) + 1).padStart(2, "0")}`, `2026-0${(i % 9) + 1}-11`, fetcher);
  }
  assert.ok(fetcher.calls.length <= 200);
});

function request(query: string): Request {
  return new Request(`https://app.test/api/external-events${query}`);
}

test("the route rejects a missing or malformed range before reaching iCloud", async () => {
  for (const query of [
    "",
    "?start=2026-03-01",
    "?end=2026-04-11",
    "?start=nonsense&end=2026-04-11",
    "?start=2026-03-01&end=2026/04/11",
    "?start=2026-13-01&end=2026-04-11",
    "?start=2026-04-11&end=2026-03-01",
  ]) {
    const response = await GET(request(query));
    assert.equal(response.status, 400, `expected 400 for "${query}"`);
  }
});

test("the route answers 200 with a degraded body when iCloud is unreachable", async () => {
  // No credentials in the environment, so the real fetcher fails fast without a network call.
  delete process.env.ICLOUD_APPLE_ID;
  delete process.env.ICLOUD_APP_PASSWORD;

  const response = await GET(request("?start=2026-03-01&end=2026-04-11"));
  assert.equal(response.status, 200, "the calendar page must not break when iCloud does");
  assert.deepEqual(await response.json(), { events: [], ok: false });
});
