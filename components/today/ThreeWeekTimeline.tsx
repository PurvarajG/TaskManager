"use client";

import Link from "next/link";
import { useTasks } from "@/lib/store-context";
import { shiftDays } from "@/lib/summary";
import type { Task } from "@/lib/types";
import SectionLabel from "../SectionLabel";

const DAYS_BEFORE = 7;
const DAYS_AFTER = 14;

/**
 * A week behind, today, and a fortnight ahead — an overview and a way in, not
 * a Gantt chart. Nothing here resizes durations or draws dependencies;
 * selecting an item opens its task, and selecting an empty day goes to the
 * calendar for that date.
 */
export default function ThreeWeekTimeline({ todayISO }: { todayISO: string }) {
  const { tasks, projects, openTask } = useTasks();

  const days: { iso: string; tasks: Task[] }[] = [];
  for (let offset = -DAYS_BEFORE; offset <= DAYS_AFTER; offset++) {
    const iso = shiftDays(todayISO, offset);
    days.push({
      iso,
      tasks: tasks.filter((t) => t.status !== "trashed" && t.scheduled === iso),
    });
  }

  const colorOf = (task: Task) =>
    projects.find((p) => p.id === task.projectId)?.color ?? "var(--color-muted-foreground)";

  return (
    <section>
      <SectionLabel>Next three weeks</SectionLabel>

      <div className="mt-4 grid grid-cols-7 gap-1.5">
        {days.map(({ iso, tasks: dayTasks }) => {
          const [y, m, d] = iso.split("-").map(Number);
          const date = new Date(y, m - 1, d);
          const weekend = date.getDay() === 0 || date.getDay() === 6;
          const isToday = iso === todayISO;
          const past = iso < todayISO;

          return (
            <div
              key={iso}
              className={`min-h-20 rounded-lg border p-1.5 ${
                isToday
                  ? "border-accent/50 bg-accent/5"
                  : weekend
                    ? "border-border/60 bg-muted/40"
                    : "border-border/60"
              } ${past && !isToday ? "opacity-60" : ""}`}
            >
              <div className="flex items-baseline justify-between px-0.5">
                <span
                  className={`font-mono text-[10px] ${
                    isToday ? "font-semibold text-accent" : "text-muted-foreground"
                  }`}
                >
                  {d}
                </span>
                {isToday && (
                  <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-accent">
                    Today
                  </span>
                )}
                {weekend && !isToday && (
                  <span className="font-mono text-[9px] uppercase text-muted-foreground/70">
                    {date.toLocaleDateString(undefined, { weekday: "narrow" })}
                  </span>
                )}
              </div>

              <div className="mt-1 space-y-0.5">
                {dayTasks.slice(0, 3).map((task) => (
                  <button
                    key={task.id}
                    onClick={() => openTask(task.id)}
                    title={task.title}
                    className={`flex w-full items-center gap-1 rounded px-1 py-0.5 text-left text-[10px] leading-tight hover:bg-muted ${
                      task.status === "done" ? "text-muted-foreground line-through" : ""
                    }`}
                  >
                    <span
                      aria-hidden
                      className="size-1.5 shrink-0 rounded-full"
                      style={{ background: colorOf(task) }}
                    />
                    <span className="truncate">{task.title}</span>
                  </button>
                ))}

                {dayTasks.length > 3 && (
                  <Link
                    href={`/calendar?date=${iso}`}
                    className="block px-1 font-mono text-[9px] text-muted-foreground hover:text-foreground"
                  >
                    +{dayTasks.length - 3} more
                  </Link>
                )}

                {dayTasks.length === 0 && (
                  <Link
                    href={`/calendar?date=${iso}`}
                    aria-label={`Add a task on ${iso}`}
                    className="block rounded px-1 py-0.5 text-[10px] text-muted-foreground/50 hover:bg-muted hover:text-foreground"
                  >
                    +
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
