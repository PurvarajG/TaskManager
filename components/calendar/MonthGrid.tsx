"use client";

import { useTasks } from "@/lib/store-context";
import { WEEKDAY_LABELS, type CalendarDay } from "@/lib/calendar";
import { externalEventLabel } from "@/lib/external-events-view";
import type { ExternalEvent } from "@/lib/icloud";
import { projectColorVar, type Task } from "@/lib/types";
import { useDragReschedule } from "./useDragReschedule";

/**
 * The month itself. Dragging a marker to another date reschedules it; on touch
 * (and from the keyboard) the same move lives in the day panel as "Move date",
 * so the grid never becomes the only way to do it.
 */
export default function MonthGrid({
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
  const { dragTaskId, overDate, startDrag, endDrag, dragOver, dragLeave, drop } = useDragReschedule(
    tasksByDate,
    onAnnounce,
  );

  const colorOf = (task: Task) => {
    const color = projects.find((p) => p.id === task.projectId)?.color;
    return color ? projectColorVar(color) : "var(--color-muted-foreground)";
  };

  return (
    <div>
      <div className="grid grid-cols-7 gap-px">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="px-2 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground"
          >
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {days.map((day) => {
          const dayTasks = tasksByDate.get(day.iso) ?? [];
          const dayExternal = externalByDate?.get(day.iso) ?? [];
          const isToday = day.iso === todayISO;

          return (
            <div
              key={day.iso}
              onDragOver={(e) => dragOver(e, day.iso)}
              onDragLeave={() => dragLeave(day.iso)}
              onDrop={(e) => drop(e, day.iso)}
              className={`flex min-h-24 flex-col rounded-lg border p-1.5 transition-colors sm:min-h-28 ${
                overDate === day.iso ? "border-accent bg-accent/10" : "border-border/60"
              } ${day.isWeekend && !isToday ? "bg-muted/40" : ""} ${
                day.inMonth ? "" : "opacity-45"
              } ${isToday ? "border-accent/50 bg-accent/10" : ""}`}
            >
              <button
                onClick={() => onSelectDay(day.iso)}
                aria-label={`${day.iso}, ${dayTasks.length} ${
                  dayTasks.length === 1 ? "task" : "tasks"
                }`}
                className="flex items-baseline justify-between rounded px-0.5 py-0.5 text-left hover:bg-muted"
              >
                <span
                  className={`font-mono text-[11px] ${
                    isToday ? "font-semibold text-accent" : "text-muted-foreground"
                  }`}
                >
                  {day.dayOfMonth}
                </span>
                {isToday && (
                  <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-accent">
                    Today
                  </span>
                )}
              </button>

              <div className="mt-1 space-y-0.5">
                {dayTasks.slice(0, 3).map((task) => (
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
                      <span
                        aria-hidden
                        className="size-1.5 shrink-0 rounded-full"
                        style={{ background: colorOf(task) }}
                      />
                      <span className="truncate">{task.title}</span>
                    </button>
                  </div>
                ))}

                {dayTasks.length > 3 && (
                  <button
                    onClick={() => onSelectDay(day.iso)}
                    className="px-1 font-mono text-[9px] text-muted-foreground hover:text-foreground"
                  >
                    +{dayTasks.length - 3} more
                  </button>
                )}

                {/*
                  Imported events are outlined rather than filled, and are plain
                  divs: not draggable, not clickable. They're reference material
                  for planning, and nothing here can edit them in Apple Calendar.
                */}
                {dayExternal.slice(0, 2).map((event) => (
                  <div
                    key={event.id}
                    data-external-event
                    title={`${event.title} — ${externalEventLabel(event)} (Apple Calendar)`}
                    className="flex items-center gap-1 rounded border border-dashed border-border px-1 py-0.5 text-[10px] leading-tight text-muted-foreground"
                  >
                    <span className="truncate">{event.title}</span>
                  </div>
                ))}

                {dayExternal.length > 2 && (
                  <button
                    onClick={() => onSelectDay(day.iso)}
                    className="px-1 font-mono text-[9px] text-muted-foreground hover:text-foreground"
                  >
                    +{dayExternal.length - 2} more from Apple Calendar
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
