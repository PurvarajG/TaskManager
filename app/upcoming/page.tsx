"use client";

import { useMemo } from "react";
import { useTasks } from "@/lib/store-context";
import { addDays, toISODate } from "@/lib/parse";
import { fmt, fmtDate } from "@/lib/format";
import { buildWeekPlan, weekMetrics } from "@/lib/week-capacity";
import SectionLabel from "@/components/SectionLabel";
import TaskRow from "@/components/TaskRow";
import QuickAdd from "@/components/QuickAdd";
import PageShell from "@/components/ui/PageShell";
import MetricStrip from "@/components/ui/MetricStrip";

const WEEKDAY_LABEL: Record<number, string> = {
  0: "Sunday",
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
};

function dayHeading(dateISO: string, todayISO: string, tomorrowISO: string): string {
  if (dateISO === todayISO) return "Today";
  if (dateISO === tomorrowISO) return "Tomorrow";
  const [y, m, d] = dateISO.split("-").map(Number);
  return WEEKDAY_LABEL[new Date(y, m - 1, d).getDay()];
}

function shortDate(dateISO: string): string {
  const [, m, d] = dateISO.split("-").map(Number);
  return `${d}/${m}`;
}

export default function UpcomingPage() {
  const { tasks, settings, ready } = useTasks();
  const todayISO = toISODate(new Date());
  const tomorrowISO = addDays(todayISO, 1);
  const horizon = addDays(todayISO, 6);

  // Narrow-viewport form: the existing grouped-by-day list, unchanged —
  // tasks scheduled strictly after today through the end of the window.
  const days = useMemo(() => {
    const open = tasks.filter(
      (t) => t.status === "open" && t.scheduled > todayISO && t.scheduled <= horizon,
    );
    const byDay = new Map<string, typeof open>();
    for (const t of open) {
      const list = byDay.get(t.scheduled) ?? [];
      list.push(t);
      byDay.set(t.scheduled, list);
    }
    return [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [tasks, todayISO, horizon]);

  // Wide-viewport form: seven day-columns starting today, each with a
  // derived capacity bar. See lib/week-capacity.ts for the derivation.
  const week = useMemo(() => buildWeekPlan(tasks, todayISO, settings), [tasks, todayISO, settings]);
  const metrics = useMemo(() => weekMetrics(tasks, todayISO, week), [tasks, todayISO, week]);

  return (
    <PageShell
      label="Next 7 Days"
      maxWidth="max-w-3xl shell:max-w-none"
      title={
        <>
          What&apos;s <span className="gradient-text">coming</span>
        </>
      }
    >
      <MetricStrip
        className="mt-6"
        items={[
          { key: "count", value: metrics.taskCount, label: metrics.taskCount === 1 ? "task" : "tasks" },
          { key: "planned", value: fmt(metrics.plannedMinutes), label: "planned" },
          { key: "overdue", value: metrics.overdueCount, label: "overdue" },
          {
            key: "busiest",
            value: metrics.busiestDate ? dayHeading(metrics.busiestDate, todayISO, tomorrowISO) : "—",
            label: "busiest day",
          },
        ]}
      />

      <QuickAdd autoFocus={false} />

      {/* Wide-viewport treatment: seven day-columns with per-day capacity bars. */}
      <div className="mt-10 hidden shell:block">
        {ready && week.every((day) => day.tasks.length === 0) && (
          <p className="mb-10 rounded-xl border border-dashed border-border px-6 py-14 text-center text-sm text-muted-foreground">
            Nothing scheduled in the next week.
          </p>
        )}
        {/* Track floor is 165px, NOT minmax(0,1fr): a grid item's own min-width
            never widens its track, so with 1fr tracks the columns overlap and
            the scroller can't reach them. Same shape components/calendar/WeekGrid.tsx uses for its
            week columns. */}
        <div className="grid grid-cols-[repeat(7,minmax(165px,1fr))] gap-2.5 overflow-x-auto pb-2.5">
          {week.map((day) => {
            const overCapacity = !day.ceilingIsProvisional && day.trueCapacityRatio > 1;
            const pct = Math.round(day.capacityRatio * 100);
            return (
              <section
                key={day.date}
                className={`rounded-xl p-3 ${
                  day.date === todayISO ? "bg-accent/10" : "bg-muted/40"
                }`}
              >
                <div className="border-b border-border pb-3 font-mono text-[10px] uppercase tracking-[0.13em] text-muted-foreground">
                  {dayHeading(day.date, todayISO, tomorrowISO)}
                  <b className="mt-1 block font-serif text-lg font-bold not-italic tracking-tight text-foreground">
                    {shortDate(day.date)}
                  </b>
                  {day.ceilingIsProvisional ? (
                    <div className="mt-3 h-1 overflow-hidden rounded-full bg-border" aria-hidden />
                  ) : (
                    <div
                      className="mt-3 h-1 overflow-hidden rounded-full bg-border"
                      role="progressbar"
                      aria-valuenow={Math.round(day.trueCapacityRatio * 100)}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`${fmt(day.plannedMinutes)} planned, ${Math.round(
                        day.trueCapacityRatio * 100,
                      )}% of capacity${overCapacity ? ", over capacity" : ""}`}
                    >
                      <div
                        className={`h-full rounded-full ${overCapacity ? "bg-attention" : "bg-accent"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  )}
                  <div
                    className={`mt-1.5 normal-case tracking-normal ${
                      overCapacity ? "font-semibold text-attention" : ""
                    }`}
                  >
                    {day.ceilingIsProvisional
                      ? `${fmt(day.plannedMinutes)} planned`
                      : `${fmt(day.plannedMinutes)} planned${overCapacity ? " · over capacity" : ""}`}
                  </div>
                </div>
                <ul className="mt-2 space-y-2">
                  {day.tasks.map((t) => (
                    <TaskRow key={t.id} task={t} todayISO={todayISO} compact showDate={false} />
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      </div>

      {/* Narrow-viewport treatment: the original stacked, grouped-by-day list. */}
      <div className="mt-10 space-y-10 shell:hidden">
        {ready && days.length === 0 && (
          <p className="rounded-xl border border-dashed border-border px-6 py-14 text-center text-sm text-muted-foreground">
            Nothing scheduled in the next week.
          </p>
        )}
        {days.map(([day, dayTasks]) => (
          <section key={day}>
            <SectionLabel>{fmtDate(day)}</SectionLabel>
            <ul className="mt-5 space-y-2.5">
              {dayTasks.map((t) => (
                <TaskRow key={t.id} task={t} todayISO={todayISO} />
              ))}
            </ul>
          </section>
        ))}
      </div>
    </PageShell>
  );
}
