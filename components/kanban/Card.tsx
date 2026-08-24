"use client";

import { useState } from "react";
import { useTasks } from "@/lib/store-context";
import { fmt, fmtTime, PRIORITY_LABEL } from "@/lib/format";
import { fmtDate } from "@/lib/format";
import type { ProjectStage, Task } from "@/lib/types";
import { hasTextSelection } from "@/lib/selection";
import TimerButton from "../TimerButton";

/**
 * A compact card. Everything it shows is also stated in words somewhere on the
 * card, so colour alone never carries priority, overdue, or running state.
 */
export default function Card({
  task,
  stages,
  todayISO,
  dragging,
  dragProps,
  onMoveToStage,
}: {
  task: Task;
  stages: ProjectStage[];
  todayISO: string;
  dragging: boolean;
  dragProps: React.HTMLAttributes<HTMLElement> & { draggable: boolean };
  onMoveToStage: (stageId: string) => void;
}) {
  const { openTask, running, recordedMinutes } = useTasks();
  const [menuOpen, setMenuOpen] = useState(false);

  const dateLabel =
    task.isComplex && task.finishDate
      ? `${fmtDate(task.scheduled)} → ${fmtDate(task.finishDate)}`
      : fmtDate(task.scheduled);
  const overdue =
    task.status === "open" && (task.isComplex ? task.finishDate! : task.scheduled) < todayISO;
  const isRunning = running?.taskId === task.id;
  const recorded = recordedMinutes(task.id);
  const doneSubtasks = task.subtasks.filter((s) => s.done).length;

  return (
    <li
      {...dragProps}
      className={`group relative rounded-xl border border-border bg-card p-3 shadow-sm transition-all motion-safe:duration-200 hover:border-accent/30 ${
        dragging ? "opacity-40" : ""
      } ${task.status === "done" ? "opacity-60" : ""}`}
    >
      <div className="flex items-start gap-2">
        <button
          onClick={() => {
            if (hasTextSelection()) return;
            openTask(task.id);
          }}
          className={`select-text min-w-0 flex-1 text-left text-sm font-semibold leading-snug tracking-[-0.01em] transition-colors hover:text-accent ${
            task.status === "done" ? "line-through" : ""
          }`}
        >
          {task.title}
        </button>

        {task.status !== "done" && (
          <div className="shrink-0 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
            <TimerButton taskId={task.id} title={task.title} />
          </div>
        )}

        <div className="relative shrink-0">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={`Move ${task.title} to another column`}
            aria-expanded={menuOpen}
            className="flex size-11 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground focus:opacity-100 group-hover:opacity-100 sm:size-6"
          >
            ⋯
          </button>

          {/* The keyboard path to the same move that dragging performs. */}
          {menuOpen && (
            <div className="absolute right-0 top-full z-20 mt-1 w-44 rounded-lg border border-border bg-card py-1 shadow-lg">
              {stages.map((stage) => (
                <button
                  key={stage.id}
                  disabled={stage.id === task.stageId}
                  onClick={() => {
                    onMoveToStage(stage.id);
                    setMenuOpen(false);
                  }}
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-muted disabled:opacity-40"
                >
                  {stage.id === task.stageId ? `${stage.name} (here)` : `Move to ${stage.name}`}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
        <span>{fmt(task.minutes)}</span>
        {recorded > 0 && <span>{fmt(recorded)} done</span>}
        {task.priority > 0 && <span className="text-accent">{PRIORITY_LABEL[task.priority]}</span>}
        <span className={overdue ? "text-accent" : ""}>
          {overdue ? `Overdue · ${dateLabel}` : dateLabel}
        </span>
        {task.dueTime && <span>{fmtTime(task.dueTime)}</span>}
        {task.subtasks.length > 0 && (
          <span>
            {doneSubtasks}/{task.subtasks.length} subtasks
          </span>
        )}
        {isRunning && <span className="text-accent">● Timing now</span>}
      </div>
    </li>
  );
}
