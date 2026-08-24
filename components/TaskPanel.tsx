"use client";

import { useMemo } from "react";
import { useTasks } from "@/lib/store-context";
import { fmt, PRIORITY_LABEL } from "@/lib/format";
import { DURATIONS, type Priority, type RecurrenceFreq } from "@/lib/types";
import SidePanel from "./ui/SidePanel";
import { Field, inputClass, selectClass, SavingInput } from "./ui/Field";
import TaskTime from "./TaskTime";
import SubtaskList from "./SubtaskList";

/**
 * The one editing surface. Today, Kanban, Calendar, search, and the smart
 * lists all open this same panel, so a field only has to be right once.
 */
export default function TaskPanel() {
  const {
    tasks,
    projects,
    stagesFor,
    openTaskId,
    closeTask,
    patchTask,
    completeTask,
    reopenTask,
    trashTask,
  } = useTasks();

  const task = useMemo(() => tasks.find((t) => t.id === openTaskId) ?? null, [tasks, openTaskId]);
  const stages = task?.projectId ? stagesFor(task.projectId) : [];
  const done = task?.status === "done";

  if (!task) return null;

  return (
    <SidePanel
      open
      onClose={closeTask}
      title="Task"
      // min-h-11 keeps these actions at the 44px touch minimum on phones.
      footer={
        <div className="flex items-center justify-between">
          <button
            onClick={() => (done ? reopenTask(task.id) : completeTask(task.id))}
            className="min-h-11 rounded-lg bg-gradient-to-r from-accent to-accent-secondary px-3 py-2 text-sm font-medium text-accent-foreground transition-all hover:brightness-110 sm:min-h-9"
          >
            {done ? "Reopen task" : "Mark complete"}
          </button>
          <button
            onClick={() => {
              trashTask(task.id);
              closeTask();
            }}
            className="min-h-11 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:min-h-9"
          >
            Move to trash
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        <SavingInput
          id="task-title"
          label="Title"
          value={task.title}
          onSave={(title) => title.trim() && patchTask(task.id, { title: title.trim() })}
        />

        <SavingInput
          id="task-notes"
          label="Notes"
          value={task.notes ?? ""}
          multiline
          placeholder="Anything worth remembering"
          onSave={(notes) => patchTask(task.id, { notes })}
        />

        <div className="grid grid-cols-2 gap-4">
          <Field label="Project" htmlFor="task-project">
            <select
              id="task-project"
              value={task.projectId ?? ""}
              onChange={(e) => patchTask(task.id, { projectId: e.target.value })}
              className={selectClass}
            >
              <option value="">No project</option>
              {projects
                .filter((p) => !p.archived || p.id === task.projectId)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
          </Field>

          <Field label="Column" htmlFor="task-stage">
            <select
              id="task-stage"
              value={task.stageId ?? ""}
              disabled={!task.projectId}
              onChange={(e) => patchTask(task.id, { stageId: e.target.value })}
              className={`${selectClass} disabled:opacity-50`}
            >
              {!task.projectId && <option value="">Needs a project</option>}
              {stages.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Scheduled" htmlFor="task-date">
            <input
              id="task-date"
              type="date"
              value={task.scheduled}
              onChange={(e) => e.target.value && patchTask(task.id, { scheduled: e.target.value })}
              className={inputClass}
            />
          </Field>

          {task.isComplex ? (
            <Field label="Finish" htmlFor="task-finish">
              <input
                id="task-finish"
                type="date"
                min={task.scheduled}
                value={task.finishDate ?? task.scheduled}
                onChange={(e) => e.target.value && patchTask(task.id, { finishDate: e.target.value })}
                className={inputClass}
              />
            </Field>
          ) : (
            <Field label="Time" htmlFor="task-time">
              <input
                id="task-time"
                type="time"
                value={task.dueTime ?? ""}
                onChange={(e) => patchTask(task.id, { dueTime: e.target.value })}
                className={inputClass}
              />
            </Field>
          )}

          <Field label="Complex task" htmlFor="task-complex">
            <div className="flex h-9 items-center gap-2 text-sm">
              <input
                id="task-complex"
                type="checkbox"
                checked={task.isComplex}
                onChange={(e) => {
                  const isComplex = e.target.checked;
                  patchTask(task.id, {
                    isComplex,
                    finishDate: isComplex ? (task.finishDate ?? task.scheduled) : undefined,
                  });
                }}
                className="size-4 rounded border-border accent-accent"
              />
              <span className="text-muted-foreground">Spans multiple days</span>
            </div>
          </Field>

          <Field label="Estimate" htmlFor="task-estimate">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <input
                  id="task-estimate"
                  type="number"
                  min={1}
                  step={5}
                  value={task.minutes}
                  onChange={(e) => {
                    const n = Math.round(Number(e.target.value));
                    if (Number.isFinite(n) && n >= 1) patchTask(task.id, { minutes: n });
                  }}
                  className={`${inputClass} w-28`}
                />
                <span className="text-xs text-muted-foreground">minutes ({fmt(task.minutes)})</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {DURATIONS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => patchTask(task.id, { minutes: d })}
                    className={`rounded-md border px-2 py-1 text-xs transition-colors ${
                      task.minutes === d
                        ? "border-accent text-accent"
                        : "border-border text-muted-foreground hover:border-accent/40"
                    }`}
                  >
                    {fmt(d)}
                  </button>
                ))}
              </div>
            </div>
          </Field>

          <Field label="Priority" htmlFor="task-priority">
            <select
              id="task-priority"
              value={task.priority}
              onChange={(e) =>
                patchTask(task.id, { priority: Number(e.target.value) as Priority })
              }
              className={selectClass}
            >
              <option value={0}>None</option>
              {[1, 2, 3].map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABEL[p as 1 | 2 | 3]}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <SavingInput
          id="task-tags"
          label="Tags"
          value={task.tags.join(", ")}
          placeholder="errands, deep-work"
          onSave={(raw) =>
            patchTask(task.id, {
              tags: raw
                .split(",")
                .map((t) => t.trim().replace(/^@/, ""))
                .filter(Boolean),
            })
          }
        />

        <Field label="Repeats" htmlFor="task-recurrence">
          <select
            id="task-recurrence"
            value={task.recurrence?.freq ?? ""}
            onChange={(e) =>
              patchTask(task.id, {
                recurrence: e.target.value
                  ? { freq: e.target.value as RecurrenceFreq, interval: 1 }
                  : undefined,
              })
            }
            className={selectClass}
          >
            <option value="">Never</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </Field>

        <SubtaskList task={task} />
        <TaskTime task={task} />
      </div>
    </SidePanel>
  );
}
