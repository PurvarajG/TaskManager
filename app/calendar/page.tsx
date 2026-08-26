"use client";

import { Suspense, useCallback, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTasks } from "@/lib/store-context";
import { useNow } from "@/lib/useNow";
import { daysBetween, toISODate } from "@/lib/parse";
import { shiftDays } from "@/lib/summary";
import {
  CALENDAR_VIEWS,
  dayRange,
  monthGrid,
  shift,
  viewLabel,
  weekGrid,
  type CalendarView,
} from "@/lib/calendar";
import { fmtDate } from "@/lib/format";
import { groupExternalEventsByDate } from "@/lib/external-events-view";
import { useExternalEvents } from "@/lib/useExternalEvents";
import type { Task } from "@/lib/types";
import PageShell from "@/components/ui/PageShell";
import Panel from "@/components/ui/Panel";
import MonthGrid from "@/components/calendar/MonthGrid";
import WeekGrid from "@/components/calendar/WeekGrid";
import DayGrid from "@/components/calendar/DayGrid";
import DayPanel, { DayPanelBody } from "@/components/calendar/DayPanel";

const VIEW_LABELS: Record<CalendarView, string> = { day: "Day", week: "Week", month: "Month" };

export default function CalendarPage() {
  return (
    <Suspense fallback={null}>
      <Calendar />
    </Suspense>
  );
}

function Calendar() {
  const { tasks } = useTasks();
  const router = useRouter();
  const params = useSearchParams();
  const now = useNow();

  // ?date= means exactly one thing, unchanged from before this phase: open
  // that day's panel on load (Today's timeline links here). It is read once,
  // at mount, and never rewritten by paging — otherwise reloading after
  // clicking ‹ / › would pop the day panel back open over wherever you'd
  // paged to. ?view= is the one param this phase adds to the URL, kept
  // separate from ?date= for exactly that reason.
  const requestedDate = params.get("date");
  const requestedView = params.get("view");
  const view: CalendarView = CALENDAR_VIEWS.includes(requestedView as CalendarView)
    ? (requestedView as CalendarView)
    : "month";

  // The paging cursor. Local state, same as it was before this phase — only
  // now it's an anchor ISO date instead of a {year, month} pair, so day/week
  // views can share it with month view.
  const [cursor, setCursor] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(requestedDate);
  const [announcement, setAnnouncement] = useState("");

  const todayISO = now ? toISODate(now) : "";
  const anchorISO = cursor ?? requestedDate ?? todayISO;

  // Switching the segmented control is the one navigation that touches the
  // URL, so a day/week/month choice survives a reload — the plan's ask.
  // Paging (arrows/Today) stays local state, exactly as `cursor` was before.
  const setView = useCallback(
    (nextView: CalendarView) => {
      const query = new URLSearchParams(params.toString());
      if (nextView === "month") query.delete("view");
      else query.set("view", nextView);
      const qs = query.toString();
      router.replace(qs ? `/calendar?${qs}` : "/calendar", { scroll: false });
    },
    [params, router],
  );

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
  const days = useMemo(() => {
    if (!anchorISO) return [];
    if (view === "day") return dayRange(anchorISO);
    if (view === "week") return weekGrid(anchorISO);
    const [y, m] = anchorISO.split("-").map(Number);
    return monthGrid(y, m - 1);
  }, [view, anchorISO]);

  // The active view's own visible range, rather than a fixed 42-day window.
  const { events, ok } = useExternalEvents(days[0]?.iso ?? "", days[days.length - 1]?.iso ?? "");
  const externalByDate = useMemo(
    () => (ok ? groupExternalEventsByDate(events) : new Map()),
    [events, ok],
  );

  if (!anchorISO) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-12 sm:px-10 sm:py-16">
        <div className="h-10 w-64 rounded-lg bg-muted" />
      </div>
    );
  }

  return (
    <PageShell
      label="Calendar"
      maxWidth="max-w-none"
      title={viewLabel(view, anchorISO)}
      rail={
        // The prototype's day screen is an agenda column plus a side rail —
        // reuse DayPanelBody's exact add/list/move-date implementation
        // inline here instead of only behind the click-to-open DayPanel
        // modal, since in day view you're always already looking at the one
        // day it would show.
        view === "day" ? (
          <Panel title={fmtDate(anchorISO)} collapsible={false}>
            <DayPanelBody
              iso={anchorISO}
              tasks={tasksByDate.get(anchorISO) ?? []}
              externalEvents={externalByDate.get(anchorISO) ?? []}
            />
          </Panel>
        ) : undefined
      }
      actions={
        <>
          <div role="group" aria-label="Calendar view" className="flex items-center gap-0.5 rounded-lg border border-border p-0.5">
            {CALENDAR_VIEWS.map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                aria-pressed={view === v}
                className={`rounded-md px-2.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.08em] transition-colors ${
                  view === v
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {VIEW_LABELS[v]}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setCursor(shift(view, anchorISO, -1))}
              aria-label={`Previous ${view}`}
              className="flex size-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground sm:size-9"
            >
              ‹
            </button>
            <button
              onClick={() => setCursor(todayISO)}
              className="rounded-lg px-3 py-2 font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              Today
            </button>
            <button
              onClick={() => setCursor(shift(view, anchorISO, 1))}
              aria-label={`Next ${view}`}
              className="flex size-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground sm:size-9"
            >
              ›
            </button>
          </div>
        </>
      }
    >
      <div>
        {view === "month" && (
          <MonthGrid
            days={days}
            todayISO={todayISO}
            tasksByDate={tasksByDate}
            externalByDate={externalByDate}
            onSelectDay={setSelected}
            onAnnounce={setAnnouncement}
          />
        )}
        {view === "week" && (
          <WeekGrid
            days={days}
            todayISO={todayISO}
            tasksByDate={tasksByDate}
            externalByDate={externalByDate}
            onSelectDay={setSelected}
            onAnnounce={setAnnouncement}
          />
        )}
        {view === "day" && (
          <DayGrid
            day={days[0]}
            todayISO={todayISO}
            tasksByDate={tasksByDate}
            externalByDate={externalByDate}
            onSelectDay={setSelected}
          />
        )}
      </div>

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {/* In day view the rail above already renders DayPanelBody for
          `anchorISO`, so opening the modal here too would mount a second
          copy of that day's add input behind it. Suppress it in day view;
          the rail is the one surface for the day on screen.

          Note `selected` is NOT cleared when the view changes, so it can
          still hold a day picked in week or month view. That is precisely
          why this gate is on `view`, not on comparing `selected` to
          `anchorISO`: whatever `selected` holds, day view's own surface is
          the rail. */}
      {selected && view !== "day" && (
        <DayPanel
          iso={selected}
          tasks={tasksByDate.get(selected) ?? []}
          externalEvents={externalByDate.get(selected) ?? []}
          onClose={() => setSelected(null)}
        />
      )}
    </PageShell>
  );
}
