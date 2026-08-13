"use client";

import { useEffect, useRef, useState } from "react";
import { useTasks } from "@/lib/store-context";
import { toISODate } from "@/lib/parse";

/**
 * Best-effort in-app reminders: while this tab is open, fires a browser
 * notification the minute a task's due time arrives. No service worker, so
 * nothing fires if the tab isn't open — that's the honest tradeoff of a
 * single-user app with no push backend.
 */
export default function Reminders() {
  const { tasks } = useTasks();
  const [permission, setPermission] = useState<NotificationPermission | null>(null);
  const [dismissed, setDismissed] = useState(true);
  const fired = useRef(new Set<string>());

  useEffect(() => {
    if (typeof Notification === "undefined") return;
    setPermission(Notification.permission);
    setDismissed(localStorage.getItem("reminders-dismissed") === "1" || Notification.permission !== "default");
  }, []);

  useEffect(() => {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;

    const check = () => {
      const now = new Date();
      const todayISO = toISODate(now);
      const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

      for (const t of tasks) {
        if (t.status !== "open" || !t.dueTime || t.scheduled !== todayISO) continue;
        if (t.dueTime !== hhmm) continue;
        if (fired.current.has(t.id)) continue;
        fired.current.add(t.id);
        new Notification(t.title, { body: "Due now", tag: t.id });
      }
    };

    check();
    const id = setInterval(check, 30_000);
    return () => clearInterval(id);
  }, [tasks]);

  async function enable() {
    const result = await Notification.requestPermission();
    setPermission(result);
    setDismissed(true);
    localStorage.setItem("reminders-dismissed", "1");
  }

  function dismiss() {
    setDismissed(true);
    localStorage.setItem("reminders-dismissed", "1");
  }

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
