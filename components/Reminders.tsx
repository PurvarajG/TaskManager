"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { useTasks } from "@/lib/store-context";
import { toISODate } from "@/lib/parse";

const promptListeners = new Set<() => void>();

function subscribeToPrompt(notify: () => void) {
  promptListeners.add(notify);
  return () => promptListeners.delete(notify);
}

/**
 * Best-effort in-app reminders: while this tab is open, fires a browser
 * notification the minute a task's due time arrives. No service worker, so
 * nothing fires if the tab isn't open — that's the honest tradeoff of a
 * single-user app with no push backend.
 */
export default function Reminders() {
  const { tasks } = useTasks();
  const fired = useRef(new Set<string>());

  // Both the browser's permission and the saved dismissal are external state,
  // so they're read as a store rather than copied into React by an effect.
  const state = useSyncExternalStore(
    subscribeToPrompt,
    () =>
      typeof Notification === "undefined"
        ? "unsupported"
        : `${Notification.permission}:${localStorage.getItem("reminders-dismissed") ?? ""}`,
    () => null,
  );

  const permission = state && state !== "unsupported" ? (state.split(":")[0] as NotificationPermission) : null;
  const dismissed = state === null || state === "unsupported" || state.endsWith(":1");

  useEffect(() => {
    // Electron notifications need no in-page permission — macOS prompts for
    // that itself the first time one is shown. The web build still gates on
    // the browser's Notification permission below.
    const native = Boolean(window.tempo?.notify);
    if (!native && (typeof Notification === "undefined" || Notification.permission !== "granted")) return;

    const check = () => {
      const now = new Date();
      const todayISO = toISODate(now);
      const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

      for (const t of tasks) {
        if (t.status !== "open" || !t.dueTime || t.scheduled !== todayISO) continue;
        if (t.dueTime !== hhmm) continue;
        if (fired.current.has(t.id)) continue;
        fired.current.add(t.id);
        if (window.tempo?.notify) {
          window.tempo.notify(t.title, { body: "Due now", tag: t.id });
        } else {
          new Notification(t.title, { body: "Due now", tag: t.id });
        }
      }
    };

    check();
    const id = setInterval(check, 30_000);
    return () => clearInterval(id);
  }, [tasks]);

  async function enable() {
    await Notification.requestPermission();
    dismiss();
  }

  function dismiss() {
    localStorage.setItem("reminders-dismissed", "1");
    for (const notify of promptListeners) notify();
  }

  // Electron notifications need no permission prompt at all.
  if (typeof window !== "undefined" && window.tempo?.notify) return null;
  if (dismissed || permission !== "default") return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-lg">
      <span className="text-sm">Turn on reminders for tasks with a due time?</span>
      <button
        onClick={enable}
        className="rounded-lg bg-gradient-to-r from-accent to-accent-secondary px-3 py-1.5 text-sm font-medium text-accent-foreground"
      >
        Enable
      </button>
      <button
        onClick={dismiss}
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        Not now
      </button>
    </div>
  );
}
