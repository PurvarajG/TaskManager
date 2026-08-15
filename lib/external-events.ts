import { getExternalEvents, type ExternalEvent } from "./icloud";

/**
 * Every way iCloud can let us down — unset credentials, a bad app-specific
 * password, a network blip, a CalDAV error — collapses to the same shape here,
 * so the UI has exactly one degraded state to render instead of five.
 */
export type ExternalEventsResult = { events: ExternalEvent[]; ok: boolean };

const DEGRADED: ExternalEventsResult = { events: [], ok: false };

const TTL_MS = 5 * 60 * 1000;
/** Bounded so a long-lived instance can't accumulate a month key per navigation. */
const MAX_ENTRIES = 50;

const cache = new Map<string, { expires: number; data: ExternalEventsResult }>();

export function __resetCacheForTests(): void {
  cache.clear();
}

/**
 * Best-effort caching only: it lives in the module, so a cold serverless
 * instance simply refetches. It exists to stop rapid month-flipping from
 * hammering iCloud, not to guarantee anything.
 *
 * `fetcher` is a parameter so tests can drive every branch without touching
 * the network or a mocking framework.
 */
export async function loadExternalEvents(
  startISO: string,
  endISO: string,
  fetcher: (start: string, end: string) => Promise<ExternalEvent[]> = getExternalEvents,
): Promise<ExternalEventsResult> {
  if (!process.env.ICLOUD_APPLE_ID || !process.env.ICLOUD_APP_PASSWORD) return DEGRADED;

  const key = `${startISO}|${endISO}`;
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.data;

  try {
    const data: ExternalEventsResult = { events: await fetcher(startISO, endISO), ok: true };
    // Failures are deliberately not cached, so a transient blip clears itself
    // on the next navigation rather than sticking around for five minutes.
    if (cache.size >= MAX_ENTRIES) cache.clear();
    cache.set(key, { expires: Date.now() + TTL_MS, data });
    return data;
  } catch (error) {
    console.error("iCloud calendar fetch failed", error);
    return DEGRADED;
  }
}
