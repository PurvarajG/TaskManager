"use client";

import { useTasks } from "@/lib/store-context";
import type { CalendarDay } from "@/lib/calendar";
import { externalEventLabel } from "@/lib/external-events-view";
import type { ExternalEvent } from "@/lib/icloud";
import { useNow } from "@/lib/useNow";
import { projectColorVar, type Task } from "@/lib/types";
import { dayHeight, DAY_WINDOW_HOURS, HourGridBox, HourRail, instantToPx, timeToPx } from "../time/HourGrid";
import { useDragReschedule } from "./useDragReschedule";

const PX_PER_HOUR = 36;
const WINDOW_HOURS = DAY_WINDOW_HOURS;
const HEIGHT = dayHeight(PX_PER_HOUR);

/**
 * Seven hour-gridded day columns sharing one hour rail. Uses the same
 * `HourRail`/`HourGridBox` primitive as the tracking ribbon and `DayGrid`,
 * and the `useDragReschedule` hook shared with `MonthGrid` so dropping a task
 * on a column behaves identically to dropping it on a month square.
 */
export default function WeekGrid({
  days,
  todayISO,
  tasksByDate,
  externalByDate,
  onSelectDay,
  onAnnounce,
}: {
  days: CalendarDay[];
  todayISO: string;
  tasksByDate: Map<string, Task[]>;
  /** Read-only events imported from Apple Calendar; absent when not configured. */
  externalByDate?: Map<string, ExternalEvent[]>;
  onSelectDay: (iso: string) => void;
  onAnnounce: (message: string) => void;
}) {
  const { projects, openTask } = useTasks();
  const now = useNow();
  const { dragTaskId, overDate, startDrag, endDrag, dragOver, dragLeave, drop } = useDragReschedule(
    tasksByDate,
    onAnnounce,
  );

  const colorOf = (task: Task) => {
    const color = projects.find((p) => p.id === task.projectId)?.color;
    return color ? projectColorVar(color) : "var(--color-muted-foreground)";
  };

  const nowOffset = now ? instantToPx(now.toISOString(), PX_PER_HOUR) : null;

  return (
    // Padding lives on the scroll container itself, not on the flex row
    // inside it: `sticky left-0` positions against the nearest scrolling
    // ancestor's PADDING box, so padding on an inner element left a gap
    // between that box and where the row's content actually starts — a
    // sliver of the first column slid through underneath the sticky rail
    // whenever the week was scrolled. Padding here keeps the rail flush.
    <div className="overflow-x-auto rounded-xl border border-border bg-card p-1.5">
      <div className="flex min-w-[808px] gap-1.5">
        {/* Sticky so the hour labels stay put while the columns scroll
            horizontally underneath — at the app's 900px window minimum this
            grid never fits without scrolling, and Thu–Sat would otherwise be
            unreadable once the rail scrolls off with them. */}
        <div className="sticky left-0 z-10 flex shrink-0 flex-col bg-card">
          <div className="h-14" />
          <HourRail windowStartHour={0} windowHours={WINDOW_HOURS} height={HEIGHT} />
        </div>

        {days.map((day) => {
          const dayTasks = tasksByDate.get(day.iso) ?? [];
          const timed = dayTasks.filter((t) => t.dueTime);
          const untimed = dayTasks.filter((t) => !t.dueTime);
          const dayExternal = externalByDate?.get(day.iso) ?? [];
          const timedExternal = dayExternal.filter((e) => !e.allDay);
          const allDayExternal = dayExternal.filter((e) => e.allDay);
          const isToday = day.iso === todayISO;

          return (
            <div
              key={day.iso}
              onDragOver={(e) => dragOver(e, day.iso)}
              onDragLeave={() => dragLeave(day.iso)}
              onDrop={(e) => drop(e, day.iso)}
              className={`flex min-w-0 flex-1 flex-col rounded-lg transition-colors ${
                overDate === day.iso ? "bg-accent/10" : ""
              }`}
            >
              <button
                onClick={() => onSelectDay(day.iso)}
                aria-label={`${day.iso}, ${dayTasks.length} ${dayTasks.length === 1 ? "task" : "tasks"}`}
                className={`flex h-14 flex-col items-center justify-center rounded-lg px-1 py-1 text-center hover:bg-muted ${
                  isToday ? "bg-accent/10" : ""
                }`}
              >
                <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground">
                  {new Date(`${day.iso}T00:00:00`).toLocaleDateString(undefined, { weekday: "short" })}
                </span>
                <span
                  className={`font-mono text-[13px] ${isToday ? "font-semibold text-accent" : "text-foreground"}`}
                >
                  {day.dayOfMonth}
                </span>
              </button>

              <div className="min-h-6 space-y-0.5 px-0.5 pb-1">
                {untimed.slice(0, 2).map((task) => (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={(e) => startDrag(e, task.id)}
                    onDragEnd={endDrag}
                    className={dragTaskId === task.id ? "opacity-40" : ""}
                  >
                    <button
                      onClick={() => openTask(task.id)}
                      title={task.title}
                      className={`flex w-full items-center gap-1 rounded px-1 py-0.5 text-left text-[10px] leading-tight hover:bg-muted ${
                        task.status === "done" ? "text-muted-foreground line-through" : ""
                      }`}
                    >
                      <span aria-hidden className="size-1.5 shrink-0 rounded-full" style={{ background: colorOf(task) }} />
                      <span className="truncate">{task.title}</span>
                    </button>
                  </div>
                ))}
                {untimed.length > 2 && (
                  <button onClick={() => onSelectDay(day.iso)} className="px-1 font-mono text-[9px] text-muted-foreground hover:text-foreground">
                    +{untimed.length - 2} more
                  </button>
                )}
                {allDayExternal.slice(0, 1).map((event) => (
                  <div
                    key={event.id}
                    data-external-event
                    title={`${event.title} — All day (Apple Calendar)`}
                    className="truncate rounded border border-dashed border-border px-1 py-0.5 text-[10px] leading-tight text-muted-foreground"
                  >
                    {event.title}
                  </div>
                ))}
                {allDayExternal.length > 1 && (
                  <button
                    onClick={() => onSelectDay(day.iso)}
                    className="px-1 font-mono text-[9px] text-muted-foreground hover:text-foreground"
                  >
                    +{allDayExternal.length - 1} more from Apple Calendar
                  </button>
                )}
              </div>

              <HourGridBox
                windowHours={WINDOW_HOURS}
                height={HEIGHT}
                nowOffset={isToday ? nowOffset : null}
                aria-label={`${day.iso} hours`}
                className={overDate === day.iso ? "border-accent" : ""}
              >
                {timed.map((task) => {
                  const top = timeToPx(task.dueTime as string, PX_PER_HOUR);
                  return (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={(e) => startDrag(e, task.id)}
                      onDragEnd={endDrag}
                      className={`absolute inset-x-0.5 ${dragTaskId === task.id ? "opacity-40" : ""}`}
                      style={{ top }}
                    >
                      <button
                        onClick={() => openTask(task.id)}
                        title={task.title}
                        className={`flex w-full items-center gap-1 truncate rounded border-l-[3px] py-0.5 pl-1.5 pr-1 text-left text-[10px] font-medium text-foreground hover:opacity-85 ${
                          task.status === "done" ? "opacity-55 line-through" : ""
                        }`}
                        style={{
                          borderLeftColor: colorOf(task),
                          backgroundColor: `color-mix(in srgb, ${colorOf(task)} 14%, var(--color-card))`,
                        }}
                      >
                        <span className="truncate">{task.title}</span>
                      </button>
                    </div>
                  );
                })}

                {timedExternal.map((event) => (
                  <div
                    key={event.id}
                    data-external-event
                    title={`${event.title} — ${externalEventLabel(event)} (Apple Calendar)`}
                    className="absolute inset-x-0.5 truncate rounded border border-dashed border-border bg-card px-1 py-0.5 text-[10px] leading-tight text-muted-foreground"
                    style={{ top: instantToPx(event.start, PX_PER_HOUR) }}
                  >
                    {event.title}
                  </div>
                ))}
              </HourGridBox>
            </div>
          );
        })}
      </div>
    </div>
  );
}
