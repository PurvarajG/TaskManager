"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTasks } from "@/lib/store-context";
import { toISODate } from "@/lib/parse";
import { useDragReorder } from "@/lib/useDragReorder";
import { PROJECT_COLORS } from "@/lib/types";
import SectionLabel from "@/components/SectionLabel";
import TaskRow from "@/components/TaskRow";
import QuickAdd from "@/components/QuickAdd";

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { tasks, projects, ready, reorderTasks, updateProject, deleteProject } = useTasks();
  const todayISO = toISODate(new Date());
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState("");

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
          onClick={() => {
            if (confirm(`Delete "${project.name}"? Tasks move to no project.`)) {
              deleteProject(project.id);
              router.push("/all");
            }
          }}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Delete project
        </button>
      </div>

      {renaming ? (
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => {
            if (name.trim()) updateProject(project.id, { name: name.trim() });
            setRenaming(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            if (e.key === "Escape") setRenaming(false);
          }}
          className="mt-5 h-12 w-full rounded-lg border border-border bg-card px-3 font-display text-4xl outline-none focus:border-accent/40 sm:text-5xl"
        />
      ) : (
        <h1
          onClick={() => {
            setName(project.name);
            setRenaming(true);
          }}
          className="mt-5 cursor-text font-display text-4xl leading-[1.1] tracking-[-0.02em] sm:text-5xl"
        >
          {project.name}
        </h1>
      )}

      <div className="mt-4 flex items-center gap-2">
        {PROJECT_COLORS.map((c) => (
          <button
            key={c}
            onClick={() => updateProject(project.id, { color: c })}
            aria-label={`Set color ${c}`}
            className="size-5 rounded-full ring-offset-2 ring-offset-background transition-all"
            style={{ background: c, boxShadow: project.color === c ? `0 0 0 2px ${c}` : undefined }}
          />
        ))}
      </div>

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
