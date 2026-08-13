"use client";

import { useEffect, useMemo, useState } from "react";
import { DAY_END_HOUR } from "@/lib/types";
import { addDays, toISODate } from "@/lib/parse";
import { fmt, rank } from "@/lib/format";
import { useTasks } from "@/lib/store-context";
import SectionLabel from "./SectionLabel";
import TaskRow from "./TaskRow";
import QuickAdd from "./QuickAdd";

export default function Today() {
  const { tasks, ready, error, dismissError, completeTask, patchTask, reopenTask } = useTasks();
  const [now, setNow] = useState(() => new Date());
  // Date and "time left" only exist on the client; rendering them during SSR
  // would disagree with the browser and break hydration.
  const [mounted, setMounted] = useState(false);

  const todayISO = toISODate(now);

  useEffect(() => {
    setMounted(true);
    const tick = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(tick);
  }, []);

  const open = useMemo(() => tasks.filter((t) => t.status === "open"), [tasks]);

  const today = useMemo(
    () =>
      open
        .filter((t) => t.scheduled <= todayISO)
        .sort((a, b) => rank(a) - rank(b) || a.scheduled.localeCompare(b.scheduled)),
    [open, todayISO],
  );

  const doneToday = useMemo(
    () =>
      tasks.filter(
        (t) => t.status === "done" && t.completedAt?.slice(0, 10) === todayISO,
      ),
    [tasks, todayISO],
  );

  const committed = today.reduce((sum, t) => sum + t.minutes, 0);
  const dayEnd = new Date(now);
  dayEnd.setHours(DAY_END_HOUR, 0, 0, 0);
  const minutesLeft = Math.max(
    0,
    Math.round((dayEnd.getTime() - now.getTime()) / 60_000),
  );
  const overcommitted = committed > minutesLeft;
  const fill = minutesLeft ? Math.min(100, (committed / minutesLeft) * 100) : 100;

  const [upNext, ...rest] = today;

  return (
    <div className="mx-auto max-w-3xl px-6 py-12 sm:px-10 sm:py-16">
      {!mounted ? (
        <div className="h-10 w-64 rounded-lg bg-muted" />
      ) : (
        <>
          <header className="animate-fade-up">
            <SectionLabel pulse>Today</SectionLabel>

            <h1 className="mt-5 font-display text-4xl leading-[1.1] tracking-[-0.02em] sm:text-5xl">
              <span className="gradient-text">
                {now.toLocaleDateString(undefined, { weekday: "long" })}
              </span>{" "}
              {now.toLocaleDateString(undefined, {
                day: "numeric",
                month: "long",
              })}
            </h1>

            {ready && (
              <div className="mt-7">
                <div className="flex items-baseline justify-between">
                  <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
                    {fmt(committed)} planned
                  </span>
                  <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
                    {fmt(minutesLeft)} left
                  </span>
                </div>
                <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-accent to-accent-secondary transition-all duration-500"
                    style={{ width: `${fill}%` }}
                  />
                </div>
                {overcommitted && (
                  <p className="mt-3 text-sm text-muted-foreground">
                    More than fits. Push something to tomorrow — that&apos;s
                    planning, not failing.
                  </p>
                )}
              </div>
            )}
          </header>

          <div className="mt-10 animate-fade-up" style={{ animationDelay: "0.08s" }}>
            <QuickAdd />
          </div>

          {error && (
            <p className="mt-6 flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
              {error}
              <button onClick={dismissError} className="ml-3 text-xs underline">
                dismiss
              </button>
            </p>
          )}

          {ready && today.length === 0 && (
            <p className="mt-10 rounded-xl border border-dashed border-border px-6 py-14 text-center text-sm text-muted-foreground animate-fade-up">
              Nothing on today. Either you&apos;re done, or nothing&apos;s
              captured yet.
            </p>
          )}

          {/* The one thing. Inverted so it can't be confused with the list. */}
          {upNext && (
            <section
              className="mt-10 animate-fade-up"
              style={{ animationDelay: "0.16s" }}
            >
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

                  <div className="mt-7 flex items-center gap-3">
                    <button
                      onClick={() => completeTask(upNext.id)}
                      className="h-11 rounded-xl bg-gradient-to-r from-accent to-accent-secondary px-5 text-sm font-medium text-accent-foreground transition-all duration-200 hover:shadow-accent-lg hover:brightness-110 active:scale-[0.98]"
                    >
                      Mark done
                    </button>
                    <button
                      onClick={() =>
                        patchTask(upNext.id, { scheduled: addDays(todayISO, 1) })
                      }
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
            <section
              className="mt-12 animate-fade-up"
              style={{ animationDelay: "0.24s" }}
            >
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
        </>
      )}
    </div>
  );
}
