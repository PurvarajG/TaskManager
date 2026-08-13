"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * The wall clock as an external store. Returns `null` during server rendering
 * and the first client pass, which is what lets a surface show a skeleton
 * instead of a date the server and browser would disagree about — no
 * `setMounted(true)` effect, and no cascading render.
 *
 * The snapshot is rounded to `intervalMs`, so it stays referentially stable
 * between ticks and only re-renders when the displayed value would change.
 */
export function useNow(intervalMs = 60_000): Date | null {
  const subscribe = useCallback(
    (notify: () => void) => {
      const id = setInterval(notify, intervalMs);
      return () => clearInterval(id);
    },
    [intervalMs],
  );

  const stamp = useSyncExternalStore(
    subscribe,
    useCallback(() => Math.floor(Date.now() / intervalMs) * intervalMs, [intervalMs]),
    () => null,
  );

  return stamp === null ? null : new Date(stamp);
}
