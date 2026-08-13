"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useTasks } from "@/lib/store-context";
import { toISODate } from "@/lib/parse";
import { useDragReorder } from "@/lib/useDragReorder";
import SectionLabel from "@/components/SectionLabel";
import TaskRow from "@/components/TaskRow";
import QuickAdd from "@/components/QuickAdd";
import ProjectSettings from "@/components/ProjectSettings";

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const { tasks, projects, ready, reorderTasks } = useTasks();
  const todayISO = toISODate(new Date());
  const [settingsOpen, setSettingsOpen] = useState(false);

  const project = projects.find((p) => p.id === id);

  const open = useMemo(
    () =>
      tasks
        .filter((t) => t.status === "open" && t.projectId === id)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [tasks, id],
  );
  const done = useMemo(
    () => tasks.filter((t) => t.status === "done" && t.projectId === id),
    [tasks, id],
  );

  const { list, dragHandleProps } = useDragReorder(open, reorderTasks);

  if (ready && !project) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-16 text-center text-sm text-muted-foreground">
        Project not found.
      </div>
    );
  }
  if (!project) return null;

  return (
    <div className="mx-auto max-w-3xl px-6 py-12 sm:px-10 sm:py-16">
      <div className="flex items-center justify-between">
        <SectionLabel>Project</SectionLabel>
        <button
          onClick={() => setSettingsOpen(true)}
          className="rounded-lg px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          Settings
        </button>
      </div>

      <h1 className="mt-5 flex items-center gap-3 font-display text-4xl leading-[1.1] tracking-[-0.02em] sm:text-5xl">
        <span className="size-3 shrink-0 rounded-full" style={{ background: project.color }} />
        {project.name}
      </h1>

      {settingsOpen && (
        <ProjectSettings project={project} onClose={() => setSettingsOpen(false)} />
      )}

      <div className="mt-10">
        <QuickAdd projectId={project.id} autoFocus={false} />
      </div>

      {ready && open.length === 0 && (
        <p className="mt-10 rounded-xl border border-dashed border-border px-6 py-14 text-center text-sm text-muted-foreground">
          Nothing open in this project.
        </p>
      )}

      <ul className="mt-10 space-y-2.5">
        {list.map((t) => (
          <TaskRow
            key={t.id}
            task={t}
            todayISO={todayISO}
            showProject={false}
            showDate
            draggable
            dragHandleProps={dragHandleProps(t.id)}
          />
        ))}
      </ul>

      {done.length > 0 && (
        <details className="mt-10">
          <summary className="cursor-pointer list-none">
            <SectionLabel>Done · {done.length}</SectionLabel>
          </summary>
          <ul className="mt-5 space-y-2.5">
            {done.map((t) => (
              <TaskRow key={t.id} task={t} todayISO={todayISO} showProject={false} />
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
