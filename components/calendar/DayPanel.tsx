"use client";

import { useId, useState } from "react";
import { useTasks } from "@/lib/store-context";
import { externalEventLabel } from "@/lib/external-events-view";
import { fmt, fmtDate, fmtTime } from "@/lib/format";
import type { ExternalEvent } from "@/lib/icloud";
import { projectColorVar, type Task } from "@/lib/types";
import { hasTextSelection } from "@/lib/selection";
import SidePanel from "../ui/SidePanel";

/**
 * The day's work, plus the two things you'd want from a date you just clicked:
 * add something to it, or move something off it. The Move date control is the
 * accessible equivalent of dragging a marker across the grid, and it's the
 * only way on touch.
 *
 * The interior content is split into `DayPanelBody` so the Day calendar view
 * can embed the exact same add/list/move-date affordances inline in its side
 * rail instead of only reaching them through this click-to-open modal — one
 * implementation of "a day's tasks, with add and move" either way.
 */
export function DayPanelBody({
  iso,
  tasks,
  externalEvents = [],
}: {
  iso: string;
  tasks: Task[];
  /** Read-only, from Apple Calendar. Never editable from this app. */
  externalEvents?: ExternalEvent[];
}) {
  const { addTask, openTask, patchTask, projects } = useTasks();
  const [draft, setDraft] = useState("");
  const [moving, setMoving] = useState<string | null>(null);
  // Unique per mounted instance so the rail's inline copy (app/calendar/page.tsx)
  // and this modal can never collide on id/htmlFor even if both are ever
  // mounted at once — see the calendar page for why that's now suppressed.
  const inputId = useId();

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <label htmlFor={inputId} className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
          Add a task on this day
        </label>
        <input
          id={inputId}
          data-day-add-input
          value={draft}
          placeholder="What needs doing?"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={async (e) => {
            if (e.key !== "Enter" || !draft.trim()) return;
            const text = draft;
            setDraft("");
            // The date comes from the day you opened, not from parsing.
            await addTask(text, { scheduled: iso }).catch(() => {});
          }}
          className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm outline-none placeholder:text-muted-foreground/60 focus:border-accent/40"
        />
      </div>

        {tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing scheduled. Add the first thing above.</p>
        ) : (
          <ul className="space-y-2">
            {tasks.map((task) => {
              const project = projects.find((p) => p.id === task.projectId);
              return (
                <li key={task.id} className="rounded-xl border border-border bg-card p-3">
                  <div className="flex items-start gap-2">
                    <button
                      onClick={() => {
                        if (hasTextSelection()) return;
                        openTask(task.id);
                      }}
                      className={`select-text min-w-0 flex-1 text-left text-sm font-medium hover:text-accent ${
                        task.status === "done" ? "line-through opacity-60" : ""
                      }`}
                    >
                      {task.title}
                    </button>
                  </div>

                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                    <span>{fmt(task.minutes)}</span>
                    {task.dueTime && <span>{fmtTime(task.dueTime)}</span>}
                    {project && (
                      <span className="inline-flex items-center gap-1.5 normal-case tracking-normal">
                        <span
                          aria-hidden
                          className="size-1.5 rounded-full"
                          style={{ background: projectColorVar(project.color) }}
                        />
                        {project.name}
                      </span>
                    )}
                  </div>

                  {moving === task.id ? (
                    <div className="mt-2 flex items-center gap-2">
                      <input
                        type="date"
                        autoFocus
                        aria-label={`New date for ${task.title}`}
                        defaultValue={task.scheduled}
                        onChange={(e) => {
                          if (!e.target.value) return;
                          // The time of day is deliberately preserved.
                          patchTask(task.id, { scheduled: e.target.value });
                          setMoving(null);
                        }}
                        className="h-9 rounded-lg border border-border bg-background px-2 text-sm outline-none focus:border-accent/40"
                      />
                      <button
                        onClick={() => setMoving(null)}
                        className="rounded-lg px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setMoving(task.id)}
                      aria-label={`Move date for ${task.title}`}
                      className="mt-2 rounded-md px-2 py-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      Move date
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {externalEvents.length > 0 && (
          <section>
            <h3 className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
              From Apple Calendar
            </h3>
            {/* No buttons, no inputs: nothing in this app can change these. */}
            <ul className="mt-2 space-y-1.5">
              {externalEvents.map((event) => (
                <li
                  key={event.id}
                  className="rounded-xl border border-dashed border-border px-3 py-2 text-sm text-muted-foreground"
                >
                  <span className="text-foreground">{event.title}</span>
                  <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.08em]">
                    {externalEventLabel(event)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
  );
}

export default function DayPanel({
  iso,
  tasks,
  externalEvents = [],
  onClose,
}: {
  iso: string;
  tasks: Task[];
  /** Read-only, from Apple Calendar. Never editable from this app. */
  externalEvents?: ExternalEvent[];
  onClose: () => void;
}) {
  return (
    <SidePanel open onClose={onClose} title={fmtDate(iso)}>
      <DayPanelBody iso={iso} tasks={tasks} externalEvents={externalEvents} />
    </SidePanel>
  );
}
