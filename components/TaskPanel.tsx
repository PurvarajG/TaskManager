"use client";

import { useMemo } from "react";
import { useTasks } from "@/lib/store-context";
import { fmt, PRIORITY_LABEL } from "@/lib/format";
import { DURATIONS, type Priority, type RecurrenceFreq } from "@/lib/types";
import SidePanel from "./ui/SidePanel";
import { Field, inputClass, SavingInput } from "./ui/Field";
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
              className={inputClass}
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
              className={`${inputClass} disabled:opacity-50`}
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

          <Field label="Time" htmlFor="task-time">
            <input
              id="task-time"
              type="time"
              value={task.dueTime ?? ""}
              onChange={(e) => patchTask(task.id, { dueTime: e.target.value })}
              className={inputClass}
            />
          </Field>

          <Field label="Estimate" htmlFor="task-estimate">
            <select
              id="task-estimate"
              value={task.minutes}
              onChange={(e) => patchTask(task.id, { minutes: Number(e.target.value) as never })}
              className={inputClass}
            >
              {DURATIONS.map((d) => (
                <option key={d} value={d}>
                  {fmt(d)}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Priority" htmlFor="task-priority">
            <select
              id="task-priority"
              value={task.priority}
              onChange={(e) =>
                patchTask(task.id, { priority: Number(e.target.value) as Priority })
              }
              className={inputClass}
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
            className={inputClass}
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
