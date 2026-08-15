"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTasks } from "@/lib/store-context";
import { useNow } from "@/lib/useNow";
import { daysBetween, toISODate } from "@/lib/parse";
import { shiftDays } from "@/lib/summary";
import { monthGrid, monthLabel, shiftMonth } from "@/lib/calendar";
import { groupExternalEventsByDate } from "@/lib/external-events-view";
import { useExternalEvents } from "@/lib/useExternalEvents";
import type { Task } from "@/lib/types";
import SectionLabel from "@/components/SectionLabel";
import MonthGrid from "@/components/calendar/MonthGrid";
import DayPanel from "@/components/calendar/DayPanel";

export default function CalendarPage() {
  return (
    <Suspense fallback={null}>
      <Calendar />
    </Suspense>
  );
}

function Calendar() {
  const { tasks } = useTasks();
  const params = useSearchParams();
  const now = useNow();

  // ?date= lets Today's timeline link straight to a specific day.
  const requested = params.get("date");
  const [cursor, setCursor] = useState<{ year: number; month: number } | null>(null);
  const [selected, setSelected] = useState<string | null>(requested);
  const [announcement, setAnnouncement] = useState("");

  const todayISO = now ? toISODate(now) : "";

  const view = useMemo(() => {
    if (cursor) return cursor;
    const anchor = requested ?? todayISO;
    if (!anchor) return null;
    const [y, m] = anchor.split("-").map(Number);
    return { year: y, month: m - 1 };
  }, [cursor, requested, todayISO]);

  const tasksByDate = useMemo(() => {
    const map = new Map<string, Task[]>();
    const add = (iso: string, task: Task) => {
      const list = map.get(iso) ?? [];
      list.push(task);
      map.set(iso, list);
    };
    for (const task of tasks) {
      if (task.status === "trashed") continue;
      if (task.isComplex && task.finishDate) {
        const span = daysBetween(task.scheduled, task.finishDate);
        for (let offset = 0; offset <= span; offset++) add(shiftDays(task.scheduled, offset), task);
      } else {
        add(task.scheduled, task);
      }
    }
    for (const list of map.values()) {
      list.sort((a, b) => (a.dueTime ?? "99:99").localeCompare(b.dueTime ?? "99:99"));
    }
    return map;
  }, [tasks]);

  // Computed before the loading bail-out below, so the hook order never varies.
  const days = useMemo(() => (view ? monthGrid(view.year, view.month) : []), [view]);

  // The visible 42-day window, which is exactly what the grid can display.
  const { events, ok } = useExternalEvents(days[0]?.iso ?? "", days[days.length - 1]?.iso ?? "");
  const externalByDate = useMemo(
    () => (ok ? groupExternalEventsByDate(events) : new Map()),
    [events, ok],
  );

  if (!view) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-12 sm:px-10 sm:py-16">
        <div className="h-10 w-64 rounded-lg bg-muted" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-12 sm:px-10 sm:py-16">
      <SectionLabel>Calendar</SectionLabel>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl leading-[1.1] tracking-[-0.02em] sm:text-4xl">
          {monthLabel(view.year, view.month)}
        </h1>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setCursor(shiftMonth(view.year, view.month, -1))}
            aria-label="Previous month"
            className="flex size-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground sm:size-9"
          >
            ‹
          </button>
          <button
            onClick={() => {
              const [y, m] = todayISO.split("-").map(Number);
              setCursor({ year: y, month: m - 1 });
            }}
            className="rounded-lg px-3 py-2 font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            Today
          </button>
          <button
            onClick={() => setCursor(shiftMonth(view.year, view.month, 1))}
            aria-label="Next month"
            className="flex size-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground sm:size-9"
          >
            ›
          </button>
        </div>
      </div>

      <div className="mt-6">
        <MonthGrid
          days={days}
          todayISO={todayISO}
          tasksByDate={tasksByDate}
          externalByDate={externalByDate}
          onSelectDay={setSelected}
          onAnnounce={setAnnouncement}
        />
      </div>

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {selected && (
        <DayPanel
          iso={selected}
          tasks={tasksByDate.get(selected) ?? []}
          externalEvents={externalByDate.get(selected) ?? []}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
