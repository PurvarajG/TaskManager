"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useTasks } from "@/lib/store-context";
import { toISODate } from "@/lib/parse";
import { fmt } from "@/lib/format";
import { projectSummary } from "@/lib/summary";
import SectionLabel from "@/components/SectionLabel";
import ProjectSettings from "@/components/ProjectSettings";
import Board from "@/components/kanban/Board";

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const { tasks, projects, stages, timeEntries, ready } = useTasks();
  const todayISO = toISODate(new Date());
  const [settingsOpen, setSettingsOpen] = useState(false);

  const project = projects.find((p) => p.id === id);

  const summary = useMemo(
    () => projectSummary(id, tasks, stages, timeEntries, todayISO),
    [id, tasks, stages, timeEntries, todayISO],
  );

  if (ready && !project) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-16 text-center text-sm text-muted-foreground">
        Project not found.
      </div>
    );
  }
  if (!project) return null;

  return (
    <div className="px-6 py-12 sm:px-10 sm:py-16">
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

      {/* Plain counts, not a score: every figure here is recomputed from tasks,
          stage semantics, and time entries. */}
      <dl className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
        <Stat label="Complete" value={`${summary.percentComplete}%`} />
        <Stat label="Open" value={String(summary.open)} />
        <Stat label="Done" value={String(summary.completed)} />
        {summary.overdue > 0 && <Stat label="Overdue" value={String(summary.overdue)} />}
        {summary.blocked > 0 && <Stat label="Blocked" value={String(summary.blocked)} />}
        <Stat label="Estimated" value={fmt(summary.estimatedMinutes)} />
        <Stat label="Recorded" value={fmt(summary.recordedMinutes)} />
      </dl>

      <div className="mt-8">
        <Board project={project} todayISO={todayISO} />
      </div>

      {settingsOpen && (
        <ProjectSettings project={project} onClose={() => setSettingsOpen(false)} />
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dt>{label}</dt>
      <dd className="text-foreground">{value}</dd>
    </div>
  );
}
