"use client";

import Link from "next/link";
import { useState } from "react";
import { useTasks } from "@/lib/store-context";
import { shiftDays } from "@/lib/summary";
import type { Task } from "@/lib/types";
import SectionLabel from "../SectionLabel";

const SPANS = [1, 2, 3, 5, 7, 10, 14] as const;

function dateParts(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

/** A compact, adjustable window into scheduled work on the Today dashboard. */
export default function DashboardTimeline({ todayISO }: { todayISO: string }) {
  const { tasks, projects, openTask } = useTasks();
  const [rangeIndex, setRangeIndex] = useState(4);
  const [startISO, setStartISO] = useState(todayISO);
  const span = SPANS[rangeIndex];

  const colorOf = (task: Task) =>
    projects.find((project) => project.id === task.projectId)?.color ??
    "var(--color-muted-foreground)";

  const days = Array.from({ length: span }, (_, index) => {
    const iso = shiftDays(startISO, index);
    return {
      iso,
      tasks: tasks.filter((task) => task.status !== "trashed" && task.scheduled === iso),
    };
  });

  return (
    <section data-testid="today-timeline" aria-label="Task timeline">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <SectionLabel>Timeline</SectionLabel>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label={`Previous ${span} ${span === 1 ? "day" : "days"}`}
            onClick={() => setStartISO((current) => shiftDays(current, -span))}
            className="rounded-md border border-border px-2 py-1 font-mono text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            ←
          </button>
          <button
            type="button"
            aria-label={`Next ${span} ${span === 1 ? "day" : "days"}`}
            onClick={() => setStartISO((current) => shiftDays(current, span))}
            className="rounded-md border border-border px-2 py-1 font-mono text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            →
          </button>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <label htmlFor="timeline-range" className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
          Range
        </label>
        <input
          id="timeline-range"
          aria-label="Timeline range"
          type="range"
          min={0}
          max={SPANS.length - 1}
          step={1}
          value={rangeIndex}
          onChange={(event) => setRangeIndex(Number(event.target.value))}
          className="h-1.5 min-w-36 flex-1 accent-[var(--color-accent)]"
        />
        <output className="w-14 text-right font-mono text-[11px] text-muted-foreground">
          {span} {span === 1 ? "day" : "days"}
        </output>
      </div>

      <div className="mt-3 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${span}, minmax(0, 1fr))` }}>
        {days.map(({ iso, tasks: dayTasks }) => {
          const date = dateParts(iso);
          const isToday = iso === todayISO;
          const weekend = date.getDay() === 0 || date.getDay() === 6;
          const label = date.toLocaleDateString(undefined, { weekday: "short" });

          return (
            <div
              key={iso}
              className={`flex min-h-28 min-w-0 flex-col rounded-lg border p-1.5 ${
                isToday
                  ? "border-accent/50 bg-accent/5"
                  : weekend
                    ? "border-border/60 bg-muted/40"
                    : "border-border/60"
              }`}
            >
              <Link
                href={`/calendar?date=${iso}`}
                aria-label={`Open calendar for ${iso}`}
                className="flex items-baseline justify-between rounded px-0.5 hover:bg-muted"
              >
                <span className={`font-mono text-[10px] ${isToday ? "font-semibold text-accent" : "text-muted-foreground"}`}>
                  {label} {date.getDate()}
                </span>
                {isToday && <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-accent">Today</span>}
              </Link>

              <div className="mt-1 min-h-0 flex-1 space-y-0.5">
                {dayTasks.slice(0, 3).map((task) => {
                  const color = colorOf(task);
                  return (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() => openTask(task.id)}
                      title={task.title}
                      className={`flex w-full items-center gap-1 rounded border-l-2 px-1 py-0.5 text-left text-[10px] leading-tight transition-colors hover:bg-muted ${
                        task.status === "done" ? "text-muted-foreground opacity-60 line-through" : ""
                      }`}
                      style={{ borderLeftColor: color }}
                    >
                      <span className="truncate">{task.title}</span>
                    </button>
                  );
                })}
                {dayTasks.length > 3 && (
                  <Link href={`/calendar?date=${iso}`} className="block px-1 font-mono text-[9px] text-muted-foreground hover:text-foreground">
                    +{dayTasks.length - 3} more
                  </Link>
                )}
              </div>

              {dayTasks.length === 0 && (
                <Link href={`/calendar?date=${iso}`} aria-label={`Add a task on ${iso}`} className="mt-1 block flex-1 rounded px-1 py-0.5 text-[10px] text-muted-foreground/50 hover:bg-muted hover:text-foreground">
                  +
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
