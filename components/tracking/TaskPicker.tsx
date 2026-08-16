"use client";

import { useMemo, useState } from "react";
import { toISODate } from "@/lib/parse";
import type { Project, Task } from "@/lib/types";

/**
 * A searchable picker over open tasks — scheduled today first, then most
 * recently scheduled. Used anywhere a segment can be pointed at a task: the
 * dashboard's "start a task" lane, retro-linking a segment, and gap fill.
 */
export default function TaskPicker({
  tasks,
  projects,
  value,
  onChange,
  label = "Task",
  placeholder = "Pick a task",
  /** Adds a "No task" entry that calls onChange("") — for retro-linking, where unlinking is a real choice. */
  clearable = false,
}: {
  tasks: Task[];
  projects: Project[];
  value: string | undefined;
  onChange: (taskId: string) => void;
  label?: string;
  placeholder?: string;
  clearable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const projectById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const selected = tasks.find((t) => t.id === value);

  const today = toISODate(new Date());
  const open_ = useMemo(
    () =>
      tasks
        .filter((t) => t.status === "open")
        .sort((a, b) => {
          const aToday = a.scheduled === today;
          const bToday = b.scheduled === today;
          if (aToday !== bToday) return aToday ? -1 : 1;
          return b.scheduled.localeCompare(a.scheduled);
        }),
    [tasks, today],
  );

  const filtered = query.trim()
    ? open_.filter((t) => t.title.toLowerCase().includes(query.trim().toLowerCase()))
    : open_;

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-11 max-w-64 items-center gap-2 truncate rounded-lg border border-border bg-card px-3 py-2 text-sm transition-colors hover:border-accent/30 sm:min-h-9"
      >
        {selected ? (
          <span className="flex min-w-0 items-center gap-1.5 truncate">
            {selected.projectId && projectById.get(selected.projectId) && (
              <span
                aria-hidden
                className="size-1.5 shrink-0 rounded-full"
                style={{ background: projectById.get(selected.projectId)!.color }}
              />
            )}
            <span className="truncate">{selected.title}</span>
          </span>
        ) : (
          <span className="text-muted-foreground">{placeholder}</span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 w-72 rounded-lg border border-border bg-card py-1 shadow-lg">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tasks…"
            className="w-full border-b border-border bg-transparent px-3 py-2 text-sm outline-none"
          />
          <div className="max-h-64 overflow-y-auto">
            {clearable && value && (
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                  setQuery("");
                }}
                className="flex w-full items-center px-3 py-2 text-left text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                No task
              </button>
            )}
            {filtered.length === 0 && (
              <p className="px-3 py-2 text-sm text-muted-foreground">No open tasks match.</p>
            )}
            {filtered.map((task) => {
              const project = task.projectId ? projectById.get(task.projectId) : undefined;
              return (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => {
                    onChange(task.id);
                    setOpen(false);
                    setQuery("");
                  }}
                  disabled={task.id === value}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted disabled:opacity-40"
                >
                  {project && (
                    <span aria-hidden className="size-1.5 shrink-0 rounded-full" style={{ background: project.color }} />
                  )}
                  <span className="min-w-0 flex-1 truncate">{task.title}</span>
                  {task.scheduled === today && (
                    <span className="shrink-0 text-xs text-muted-foreground">Today</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
