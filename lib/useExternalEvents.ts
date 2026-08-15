"use client";

import { useEffect, useState } from "react";
import type { ExternalEvent } from "./icloud";

/**
 * Imported iCloud events for a visible date range. Scoped to the calendar page
 * rather than added to `store-context`, because unlike tasks these are
 * read-only reference data that only one surface asks for.
 *
 * `ok: false` is the single degraded state — unset credentials, a dead network,
 * a CalDAV error. Callers render nothing and say nothing: a warning banner
 * every time iCloud hiccups is worse than quietly missing reference events.
 */
export function useExternalEvents(startISO: string, endISO: string) {
  const [events, setEvents] = useState<ExternalEvent[]>([]);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    if (!startISO || !endISO) return;

    // A month flip mid-flight must not let the old range's response win.
    const controller = new AbortController();

    fetch(`/api/external-events?start=${startISO}&end=${endISO}`, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : { events: [], ok: false }))
      .then((data: { events?: ExternalEvent[]; ok?: boolean }) => {
        setEvents(data.events ?? []);
        setOk(data.ok === true);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setEvents([]);
        setOk(false);
      });

    return () => controller.abort();
  }, [startISO, endISO]);

  return { events, ok };
}
