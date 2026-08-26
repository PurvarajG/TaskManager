"use client";

import { useTasks } from "@/lib/store-context";
import type { CalendarDay } from "@/lib/calendar";
import { externalEventLabel } from "@/lib/external-events-view";
import type { ExternalEvent } from "@/lib/icloud";
import { useNow } from "@/lib/useNow";
import { projectColorVar, type Task } from "@/lib/types";
import { dayHeight, DAY_WINDOW_HOURS, HourGridBox, HourRail, instantToPx, timeToPx } from "../time/HourGrid";

const PX_PER_HOUR = 56;
const WINDOW_HOURS = DAY_WINDOW_HOURS;
const HEIGHT = dayHeight(PX_PER_HOUR);

/**
 * One wide day column with room for full event titles, rather than the
 * truncated chips the month/week grids use. Shares the hour-rail primitive
 * with the other two views, but NOT `useDragReschedule`: this view only ever
 * shows one day, so there is no second date to drop a marker onto — dragging
 * a task here could only ever no-op. Rescheduling stays available through
 * `onSelectDay` → `DayPanel`'s "Move date" control, the same accessible
 * equivalent touch and keyboard users already rely on for the month/week
 * grids' drag.
 */
export default function DayGrid({
  day,
  todayISO,
  tasksByDate,
  externalByDate,
  onSelectDay,
}: {
  day: CalendarDay;
  todayISO: string;
  tasksByDate: Map<string, Task[]>;
  externalByDate?: Map<string, ExternalEvent[]>;
  onSelectDay: (iso: string) => void;
}) {
  const { projects, openTask } = useTasks();
  const now = useNow();

  const colorOf = (task: Task) => {
    const color = projects.find((p) => p.id === task.projectId)?.color;
    return color ? projectColorVar(color) : "var(--color-muted-foreground)";
  };

  const isToday = day.iso === todayISO;
  const nowOffset = isToday && now ? instantToPx(now.toISOString(), PX_PER_HOUR) : null;

  const dayTasks = tasksByDate.get(day.iso) ?? [];
  const timed = dayTasks.filter((t) => t.dueTime);
  const untimed = dayTasks.filter((t) => !t.dueTime);
  const dayExternal = externalByDate?.get(day.iso) ?? [];
  const timedExternal = dayExternal.filter((e) => !e.allDay);
  const allDayExternal = dayExternal.filter((e) => e.allDay);

  return (
    <div>
      {(untimed.length > 0 || allDayExternal.length > 0) && (
        <div className="mb-3 space-y-1">
          {untimed.map((task) => (
            <button
              key={task.id}
              onClick={() => openTask(task.id)}
              title={task.title}
              className={`flex w-full items-center gap-2 rounded-lg border border-border/60 px-3 py-2 text-left text-sm hover:bg-muted ${
                task.status === "done" ? "text-muted-foreground line-through" : ""
              }`}
            >
              <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: colorOf(task) }} />
              <span className="truncate">{task.title}</span>
            </button>
          ))}
          {allDayExternal.map((event) => (
            <div
              key={event.id}
              data-external-event
              title={`${event.title} — All day (Apple Calendar)`}
              className="truncate rounded-lg border border-dashed border-border px-3 py-2 text-sm text-muted-foreground"
            >
              {event.title}
            </div>
          ))}
        </div>
      )}

      <button
        onClick={() => {
          // Day view's side rail (app/calendar/page.tsx) already renders the
          // exact same add-task input for this day inline — focus that one
          // rather than opening a second copy in a modal behind it.
          const input = document.querySelector<HTMLInputElement>("[data-day-add-input]");
          if (input) input.focus();
          else onSelectDay(day.iso);
        }}
        className="mb-2 text-left font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground hover:text-foreground"
      >
        Add a task on this day
      </button>

      <div className="flex rounded-xl border border-border bg-card p-2">
        <HourRail windowStartHour={0} windowHours={WINDOW_HOURS} height={HEIGHT} className="w-12 shrink-0 sm:w-14" />
        <HourGridBox
          windowHours={WINDOW_HOURS}
          height={HEIGHT}
          nowOffset={nowOffset}
          aria-label={`${day.iso} hours`}
        >
          {timed.map((task) => {
            const top = timeToPx(task.dueTime as string, PX_PER_HOUR);
            return (
              <button
                key={task.id}
                onClick={() => openTask(task.id)}
                title={task.title}
                className={`absolute inset-x-1 flex items-center gap-2 truncate rounded border-l-[3px] py-1 pl-2.5 pr-2 text-left text-xs font-medium text-foreground hover:opacity-85 ${
                  task.status === "done" ? "opacity-55 line-through" : ""
                }`}
                style={{
                  top,
                  borderLeftColor: colorOf(task),
                  backgroundColor: `color-mix(in srgb, ${colorOf(task)} 14%, var(--color-card))`,
                }}
              >
                <span className="truncate">{task.title}</span>
              </button>
            );
          })}

          {timedExternal.map((event) => (
            <div
              key={event.id}
              data-external-event
              title={`${event.title} — ${externalEventLabel(event)} (Apple Calendar)`}
              className="absolute inset-x-1 truncate rounded border border-dashed border-border bg-card px-2 py-1 text-xs text-muted-foreground"
              style={{ top: instantToPx(event.start, PX_PER_HOUR) }}
            >
              {event.title}
            </div>
          ))}
        </HourGridBox>
      </div>
    </div>
  );
}
