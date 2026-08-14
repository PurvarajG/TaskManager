"use client";

import { useState } from "react";
import { useTasks } from "@/lib/store-context";
import { daysBetween } from "@/lib/parse";
import { fmt, fmtDate, fmtTime, PRIORITY_LABEL } from "@/lib/format";
import { STALE_AFTER_DAYS, type Task } from "@/lib/types";
import TimerButton from "./TimerButton";

export default function TaskRow({
  task,
  todayISO,
  onPushTomorrow,
  showProject = true,
  showDate = false,
  compact = false,
  draggable = false,
  dragHandleProps,
}: {
  task: Task;
  todayISO: string;
  onPushTomorrow?: () => void;
  showProject?: boolean;
  showDate?: boolean;
  /** Used by the bounded Today workspace; other lists keep their roomier default. */
  compact?: boolean;
  draggable?: boolean;
  dragHandleProps?: React.LiHTMLAttributes<HTMLLIElement>;
}) {
  const {
    projects,
    openTask,
    completeTask,
    reopenTask,
    trashTask,
    patchTask,
    addSubtask,
    toggleSubtask,
    deleteSubtask,
  } = useTasks();
  const [open, setOpen] = useState(false);
  const [subtaskText, setSubtaskText] = useState("");

  const project = projects.find((p) => p.id === task.projectId);
  const age = daysBetween(task.scheduled, todayISO);
  const stale = task.status === "open" && age > STALE_AFTER_DAYS;
  const done = task.status === "done";
  const doneSubtasks = task.subtasks.filter((s) => s.done).length;

  return (
    <li
      {...(draggable ? dragHandleProps : undefined)}
      className={`group relative flex items-start gap-3 rounded-xl border border-border bg-card shadow-sm transition-all duration-300 hover:border-accent/30 hover:shadow-lg ${compact ? "p-3 lg:py-2.5" : "p-4"} ${
        stale ? "opacity-70" : ""
      } ${done ? "opacity-60" : ""} ${draggable ? "cursor-grab active:cursor-grabbing" : ""}`}
    >
      {draggable && (
        <span
          className="mt-1 shrink-0 text-muted-foreground/40 opacity-0 transition-opacity group-hover:opacity-100"
          aria-hidden
        >
          <svg width="12" height="16" viewBox="0 0 12 16" fill="currentColor">
            <circle cx="3" cy="3" r="1.3" />
            <circle cx="9" cy="3" r="1.3" />
            <circle cx="3" cy="8" r="1.3" />
            <circle cx="9" cy="8" r="1.3" />
            <circle cx="3" cy="13" r="1.3" />
            <circle cx="9" cy="13" r="1.3" />
          </svg>
        </span>
      )}

      <button
        onClick={() => (done ? reopenTask(task.id) : completeTask(task.id))}
        aria-label={done ? `Reopen ${task.title}` : `Complete ${task.title}`}
        className={`mt-0.5 size-5 shrink-0 rounded-full border-2 transition-colors ${
          done
            ? "border-accent bg-gradient-to-br from-accent to-accent-secondary"
            : "border-border hover:border-accent hover:bg-accent/10"
        }`}
      />

      <div className="min-w-0 flex-1">
        {/* The title is the way into the full editor, from every list. */}
        <button
          onClick={() => openTask(task.id)}
          className={`block w-full truncate text-left font-semibold tracking-[-0.01em] transition-colors hover:text-accent ${compact ? "text-sm" : "text-[15px]"} ${
            done ? "line-through" : ""
          }`}
        >
          {task.title}
        </button>

        <div className={`${compact ? "mt-1 gap-x-2 text-[10px]" : "mt-1.5 gap-x-3 text-[11px]"} flex flex-wrap items-center gap-y-1 font-mono uppercase tracking-[0.08em] text-muted-foreground`}>
          <span>{fmt(task.minutes)}</span>
          {task.dueTime && <span>{fmtTime(task.dueTime)}</span>}
          {task.priority > 0 && (
            <span className="text-accent">{PRIORITY_LABEL[task.priority]}</span>
          )}
          {showDate && <span>{fmtDate(task.scheduled)}</span>}
          {showProject && project && (
            <span className="inline-flex items-center gap-1.5 normal-case tracking-normal">
              <span className="size-1.5 rounded-full" style={{ background: project.color }} />
              {project.name}
            </span>
          )}
          {task.tags.map((tag) => (
            <span key={tag} className="rounded-full bg-muted px-1.5 py-0.5 normal-case tracking-normal">
              @{tag}
            </span>
          ))}
          {task.recurrence && <span title="Repeats">↻ {task.recurrence.freq}</span>}
          {task.subtasks.length > 0 && (
            <button onClick={() => setOpen((v) => !v)} className="hover:text-foreground">
              {doneSubtasks}/{task.subtasks.length}
            </button>
          )}
          {!stale && !done && age > 0 && <span>{age}d waiting</span>}
        </div>

        {stale && (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Sat here {age} days.</span>
            <button
              onClick={() => patchTask(task.id, { scheduled: todayISO })}
              className="rounded-md bg-muted px-2 py-1 text-xs font-medium transition-colors hover:bg-border"
            >
              Still doing it
            </button>
            <button
              onClick={() => trashTask(task.id)}
              className="rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted"
            >
              Let it go
            </button>
          </div>
        )}

        {(open || task.subtasks.length === 0) && (
          <div className={task.subtasks.length > 0 || open ? "mt-3 space-y-1.5" : ""}>
            {open &&
              task.subtasks.map((s) => (
                <div key={s.id} className="group/sub flex items-center gap-2.5 pl-0.5">
                  <button
                    onClick={() => toggleSubtask(task.id, s.id, !s.done)}
                    aria-label={s.done ? `Reopen ${s.title}` : `Complete ${s.title}`}
                    className={`size-3.5 shrink-0 rounded-full border-2 transition-colors ${
                      s.done ? "border-accent bg-accent" : "border-border hover:border-accent"
                    }`}
                  />
                  <span className={`flex-1 truncate text-sm ${s.done ? "text-muted-foreground line-through" : ""}`}>
                    {s.title}
                  </span>
                  <button
                    onClick={() => deleteSubtask(task.id, s.id)}
                    aria-label={`Delete ${s.title}`}
                    className="shrink-0 text-muted-foreground opacity-0 hover:text-foreground group-hover/sub:opacity-100"
                  >
                    ×
                  </button>
                </div>
              ))}
            {open && (
              <input
                value={subtaskText}
                onChange={(e) => setSubtaskText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && subtaskText.trim()) {
                    addSubtask(task.id, subtaskText.trim());
                    setSubtaskText("");
                  }
                }}
                placeholder="Add subtask"
                className="h-7 w-full rounded-md border border-border bg-background px-2 text-sm outline-none placeholder:text-muted-foreground/50 focus:border-accent/40"
              />
            )}
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        {!done && <TimerButton taskId={task.id} title={task.title} />}
        {task.subtasks.length === 0 && (
          <button
            onClick={() => setOpen((v) => !v)}
            className="rounded-md px-2 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            + Sub
          </button>
        )}
        {onPushTomorrow && !done && (
          <button
            onClick={onPushTomorrow}
            className="rounded-md px-2 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            Tomorrow
          </button>
        )}
        <button
          onClick={() => trashTask(task.id)}
          aria-label={`Delete ${task.title}`}
          className="rounded-md px-2 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          Delete
        </button>
      </div>
    </li>
  );
}
