"use client";

import { useTasks } from "@/lib/store-context";
import { fmt } from "@/lib/format";
import { projectColorVar, type Task } from "@/lib/types";
import SectionLabel from "../SectionLabel";

/**
 * A compact list used for the Due Today and Blocked summaries. Each entry
 * opens the same shared task panel the rest of the app uses.
 */
export default function TaskGroup({
  label,
  tasks,
  emptyText,
  hideLabel = false,
}: {
  label: string;
  tasks: Task[];
  emptyText: string;
  /** Omits the internal SectionLabel — for use inside a rail panel whose
   *  disclosure header already shows the title. */
  hideLabel?: boolean;
}) {
  const { openTask, projects } = useTasks();

  return (
    <section>
      {!hideLabel && (
        <SectionLabel>
          {label}
          {tasks.length > 0 && ` · ${tasks.length}`}
        </SectionLabel>
      )}

      {tasks.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        <ul className="mt-3 space-y-1">
          {tasks.map((task) => {
            const project = projects.find((p) => p.id === task.projectId);
            return (
              <li key={task.id}>
                <button
                  onClick={() => openTask(task.id)}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-muted"
                >
                  {project && (
                    <span
                      aria-hidden
                      className="size-1.5 shrink-0 rounded-full"
                      style={{ background: projectColorVar(project.color) }}
                    />
                  )}
                  <span className="select-text min-w-0 flex-1 truncate">{task.title}</span>
                  <span className="shrink-0 font-mono text-[10px] uppercase text-muted-foreground">
                    {fmt(task.minutes)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
