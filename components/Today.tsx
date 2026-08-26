"use client";

import { useMemo } from "react";
import { DAY_END_HOUR } from "@/lib/types";
import { addDays, toISODate } from "@/lib/parse";
import { fmt, rank } from "@/lib/format";
import { useNow } from "@/lib/useNow";
import { todaySummary } from "@/lib/summary";
import { useTasks } from "@/lib/store-context";
import PageShell from "./ui/PageShell";
import MetricStrip from "./ui/MetricStrip";
import FocusCard from "./ui/FocusCard";
import SectionLabel from "./SectionLabel";
import TaskRow from "./TaskRow";
import QuickAdd from "./QuickAdd";
import GeneralNote from "./today/GeneralNote";
import QuickTodos from "./today/QuickTodos";
import TaskGroup from "./today/TaskGroup";
import DashboardTimeline from "./today/DashboardTimeline";
import RailPanel from "./ui/RailPanel";

export default function Today() {
  const { tasks, stages, timeEntries, running, ready, completeTask, patchTask, reopenTask, settings, patchSettings } =
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

  const collapsedModules = settings?.collapsedModules ?? [];
  // Guarded the same way Tracking's own collapse toggle is (app/tracking/
  // page.tsx): settings loads async, and patchSettings replaces the WHOLE
  // collapsedModules array rather than merging one key into it. Firing this
  // before settings has arrived would persist a single-entry array and wipe
  // out everything already collapsed elsewhere (including Tracking's
  // backfilled records/rollups/signals default).
  const toggleRailPanel = (key: string) => {
    if (!settings) return;
    patchSettings({
      collapsedModules: collapsedModules.includes(key)
        ? collapsedModules.filter((k) => k !== key)
        : [...collapsedModules, key],
    });
  };

  return (
    <PageShell
      label="Today"
      pulse
      maxWidth="max-w-6xl shell:max-w-none"
      workspaceTestId="today-workspace"
      title={
        <>
          <span className="gradient-text">
            {now.toLocaleDateString(undefined, { weekday: "long" })}
          </span>{" "}
          {now.toLocaleDateString(undefined, { day: "numeric", month: "long" })}
        </>
      }
      headerExtra={
        ready && (
          <>
            <MetricStrip
              className="mt-6 lg:mt-3"
              items={[
                { key: "active", value: String(today.length), label: "Active" },
                ...(summary.overdue.length > 0
                  ? [{ key: "overdue", value: String(summary.overdue.length), label: "Overdue" }]
                  : []),
                { key: "planned", value: fmt(committed), label: "Planned" },
                { key: "capacity-left", value: fmt(minutesLeft), label: "Capacity left" },
                {
                  key: "recorded-today",
                  value: fmt(summary.recordedTodayMinutes),
                  label: "Recorded today",
                },
                ...(runningTask
                  ? [
                      {
                        key: "timing",
                        value: <span className="inline-block max-w-40 truncate align-bottom">{runningTask.title}</span>,
                        label: "Timing",
                      },
                    ]
                  : []),
              ]}
            />

            <div className="mt-4 lg:mt-2">
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
        )
      }
      rail={
        <>
          <RailPanel
            title={summary.dueToday.length > 0 ? `Due today · ${summary.dueToday.length}` : "Due today"}
            collapsed={collapsedModules.includes("today-due")}
            onToggleCollapse={() => toggleRailPanel("today-due")}
            empty={summary.dueToday.length === 0}
            emptyText="Nothing is scheduled for today."
          >
            <TaskGroup
              label="Due today"
              tasks={summary.dueToday}
              emptyText="Nothing is scheduled for today."
              hideLabel
            />
          </RailPanel>
          <RailPanel
            title={summary.blocked.length > 0 ? `Blocked · ${summary.blocked.length}` : "Blocked"}
            collapsed={collapsedModules.includes("today-blocked")}
            onToggleCollapse={() => toggleRailPanel("today-blocked")}
            empty={summary.blocked.length === 0}
            emptyText="Nothing is waiting on anything."
          >
            <TaskGroup
              label="Blocked"
              tasks={summary.blocked}
              emptyText="Nothing is waiting on anything."
              hideLabel
            />
          </RailPanel>
          <RailPanel
            title="Notepad"
            collapsed={collapsedModules.includes("today-notepad")}
            onToggleCollapse={() => toggleRailPanel("today-notepad")}
          >
            <GeneralNote compact hideLabel />
          </RailPanel>
          <RailPanel
            title="Quick list"
            collapsed={collapsedModules.includes("today-quicklist")}
            onToggleCollapse={() => toggleRailPanel("today-quicklist")}
          >
            <QuickTodos hideLabel />
          </RailPanel>
        </>
      }
    >
      {/* Below the `shell:` breakpoint (900px) this remains ordinary
          document flow. From `rail:` (1200px) up, the primary column
          scrolls independently within the shell's two-column grid; between
          900 and 1200 it shares one scrolling region with the stacked
          rail — see PageShell.tsx. */}
      <div data-testid="today-primary-pane" data-density="compact" className="min-w-0">
        <QuickAdd id="tempo-quick-add" />

        <div className="mt-8 lg:mt-6">
          <DashboardTimeline todayISO={todayISO} />
        </div>

        {ready && today.length === 0 && (
          <p className="mt-10 rounded-xl border border-dashed border-border px-6 py-14 text-center text-sm text-muted-foreground">
            Nothing on today. Either you&apos;re done, or nothing&apos;s captured yet.
          </p>
        )}

        {/* The one thing. Inverted so it can't be confused with the list. */}
        {upNext && (
          <section className="mt-10 lg:mt-6">
            <FocusCard
              tag="Up next"
              title={upNext.title}
              meta={[
                fmt(upNext.minutes),
                ...(upNext.priority > 0 ? [`P${upNext.priority}`] : []),
              ]}
              primaryLabel="Mark done"
              onPrimary={() => completeTask(upNext.id)}
              secondaryLabel="Not today"
              onSecondary={() => patchTask(upNext.id, { scheduled: addDays(todayISO, 1) })}
            />
          </section>
        )}

        {rest.length > 0 && (
          <section className="mt-12 lg:mt-6">
            <SectionLabel>Then</SectionLabel>
            <ul className="mt-5 space-y-2.5 lg:mt-3 lg:space-y-1.5">
              {rest.map((t) => (
                <TaskRow
                  key={t.id}
                  task={t}
                  todayISO={todayISO}
                  compact
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
    </PageShell>
  );
}
