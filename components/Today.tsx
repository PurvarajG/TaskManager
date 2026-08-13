"use client";

import { useMemo } from "react";
import { DAY_END_HOUR } from "@/lib/types";
import { addDays, toISODate } from "@/lib/parse";
import { fmt, rank } from "@/lib/format";
import { useNow } from "@/lib/useNow";
import { todaySummary } from "@/lib/summary";
import { useTasks } from "@/lib/store-context";
import SectionLabel from "./SectionLabel";
import TaskRow from "./TaskRow";
import QuickAdd from "./QuickAdd";
import GeneralNote from "./today/GeneralNote";
import QuickTodos from "./today/QuickTodos";
import TaskGroup from "./today/TaskGroup";
import ThreeWeekTimeline from "./today/ThreeWeekTimeline";

export default function Today() {
  const { tasks, stages, timeEntries, running, ready, completeTask, patchTask, reopenTask } =
    useTasks();

  // Null until the browser takes over, so the server never renders a date the
  // client would disagree with.
  const now = useNow();
  const todayISO = now ? toISODate(now) : "";

  const summary = useMemo(
    () => todaySummary(tasks, stages, timeEntries, todayISO),
    [tasks, stages, timeEntries, todayISO],
  );

  const today = useMemo(
    () =>
      tasks
        .filter((t) => t.status === "open" && todayISO && t.scheduled <= todayISO)
        .sort((a, b) => rank(a) - rank(b) || a.scheduled.localeCompare(b.scheduled)),
    [tasks, todayISO],
  );

  const doneToday = useMemo(
    () => tasks.filter((t) => t.status === "done" && t.completedAt?.slice(0, 10) === todayISO),
    [tasks, todayISO],
  );

  if (!now) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-12 sm:px-10 sm:py-16">
        <div className="h-10 w-64 rounded-lg bg-muted" />
      </div>
    );
  }

  const committed = today.reduce((sum, t) => sum + t.minutes, 0);
  const dayEnd = new Date(now);
  dayEnd.setHours(DAY_END_HOUR, 0, 0, 0);
  const minutesLeft = Math.max(0, Math.round((dayEnd.getTime() - now.getTime()) / 60_000));
  const overcommitted = committed > minutesLeft;
  const fill = minutesLeft ? Math.min(100, (committed / minutesLeft) * 100) : 100;
  const runningTask = running ? tasks.find((t) => t.id === running.taskId) : null;

  const [upNext, ...rest] = today;

  return (
    <div className="mx-auto max-w-6xl px-6 py-12 sm:px-10 sm:py-16">
      <header className="animate-fade-up">
        <SectionLabel pulse>Today</SectionLabel>

        <h1 className="mt-5 font-display text-4xl leading-[1.1] tracking-[-0.02em] sm:text-5xl">
          <span className="gradient-text">
            {now.toLocaleDateString(undefined, { weekday: "long" })}
          </span>{" "}
          {now.toLocaleDateString(undefined, { day: "numeric", month: "long" })}
        </h1>

        {ready && (
          <>
            <dl className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
              <Stat label="Active" value={String(today.length)} />
              {summary.overdue.length > 0 && (
                <Stat label="Overdue" value={String(summary.overdue.length)} />
              )}
              <Stat label="Planned" value={fmt(committed)} />
              <Stat label="Capacity left" value={fmt(minutesLeft)} />
              <Stat label="Recorded today" value={fmt(summary.recordedTodayMinutes)} />
              {runningTask && <Stat label="Timing" value={runningTask.title} />}
            </dl>

            <div className="mt-4">
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-accent to-accent-secondary transition-all duration-500"
                  style={{ width: `${fill}%` }}
                />
              </div>
              {overcommitted && (
                <p className="mt-3 text-sm text-muted-foreground">
                  More than fits. Push something to tomorrow — that&apos;s planning, not failing.
                </p>
              )}
            </div>
          </>
        )}
      </header>

      {/* Main column carries the work; the utility column holds the things you
          glance at. Below `lg` it all becomes one vertical flow. */}
      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0">
          <div className="animate-fade-up" style={{ animationDelay: "0.08s" }}>
            <QuickAdd />
          </div>

          {ready && today.length === 0 && (
            <p className="mt-10 rounded-xl border border-dashed border-border px-6 py-14 text-center text-sm text-muted-foreground animate-fade-up">
              Nothing on today. Either you&apos;re done, or nothing&apos;s captured yet.
            </p>
          )}

          {/* The one thing. Inverted so it can't be confused with the list. */}
          {upNext && (
            <section className="mt-10 animate-fade-up" style={{ animationDelay: "0.16s" }}>
              <div className="relative overflow-hidden rounded-2xl bg-foreground p-7 text-background shadow-xl">
                <div className="dot-texture pointer-events-none absolute inset-0" />
                <div className="relative">
                  <span className="inline-flex items-center gap-2.5 rounded-full bg-gradient-to-r from-accent to-accent-secondary px-3.5 py-1.5">
                    <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-accent-foreground">
                      Up next
                    </span>
                  </span>

                  <h2 className="mt-5 font-display text-3xl leading-[1.15] tracking-[-0.01em]">
                    {upNext.title}
                  </h2>

                  <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] uppercase tracking-[0.1em] text-background/60">
                    <span>{fmt(upNext.minutes)}</span>
                    {upNext.priority > 0 && <span>P{upNext.priority}</span>}
                  </div>

                  <div className="mt-7 flex flex-wrap items-center gap-3">
                    <button
                      onClick={() => completeTask(upNext.id)}
                      className="h-11 rounded-xl bg-gradient-to-r from-accent to-accent-secondary px-5 text-sm font-medium text-accent-foreground transition-all duration-200 hover:shadow-accent-lg hover:brightness-110 active:scale-[0.98]"
                    >
                      Mark done
                    </button>
                    <button
                      onClick={() => patchTask(upNext.id, { scheduled: addDays(todayISO, 1) })}
                      className="h-11 rounded-xl px-4 text-sm text-background/70 transition-colors hover:bg-background/10 hover:text-background"
                    >
                      Not today
                    </button>
                  </div>
                </div>
              </div>
            </section>
          )}

          {rest.length > 0 && (
            <section className="mt-12 animate-fade-up" style={{ animationDelay: "0.24s" }}>
              <SectionLabel>Then</SectionLabel>
              <ul className="mt-5 space-y-2.5">
                {rest.map((t) => (
                  <TaskRow
                    key={t.id}
                    task={t}
                    todayISO={todayISO}
                    onPushTomorrow={() => patchTask(t.id, { scheduled: addDays(todayISO, 1) })}
                  />
                ))}
              </ul>
            </section>
          )}

          {doneToday.length > 0 && (
            <details className="mt-8">
              <summary className="cursor-pointer list-none">
                <SectionLabel>Done · {doneToday.length}</SectionLabel>
              </summary>
              <ul className="mt-5 space-y-1.5">
                {doneToday.map((t) => (
                  <li
                    key={t.id}
                    className="flex items-center gap-3 px-4 py-2 text-sm text-muted-foreground"
                  >
                    <button
                      onClick={() => reopenTask(t.id)}
                      aria-label={`Reopen ${t.title}`}
                      className="size-4 shrink-0 rounded-full bg-gradient-to-br from-accent to-accent-secondary opacity-40 transition-opacity hover:opacity-100"
                    />
                    <span className="truncate line-through">{t.title}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>

        <aside className="min-w-0 space-y-10">
          <TaskGroup
            label="Due today"
            tasks={summary.dueToday}
            emptyText="Nothing is scheduled for today."
          />
          <TaskGroup
            label="Blocked"
            tasks={summary.blocked}
            emptyText="Nothing is waiting on anything."
          />
          <GeneralNote />
          <QuickTodos />
        </aside>
      </div>

      <div className="mt-12">
        <ThreeWeekTimeline todayISO={todayISO} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dt>{label}</dt>
      <dd className="max-w-40 truncate text-foreground">{value}</dd>
    </div>
  );
}
