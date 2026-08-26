"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useTasks } from "@/lib/store-context";
import { toISODate } from "@/lib/parse";
import { fmt } from "@/lib/format";
import { projectSummary } from "@/lib/summary";
import PageShell from "@/components/ui/PageShell";
import MetricStrip from "@/components/ui/MetricStrip";
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
    <PageShell
      label="Project"
      maxWidth="max-w-6xl shell:max-w-none"
      actions={
        <button
          onClick={() => setSettingsOpen(true)}
          className="rounded-lg px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          Settings
        </button>
      }
      title={
        <span className="flex items-center gap-3">
          <span className="size-3 shrink-0 rounded-full" style={{ background: project.color }} />
          <span className="select-text">{project.name}</span>
        </span>
      }
      headerExtra={
        <>
          {/* Plain counts, not a score: every figure here is recomputed from tasks,
              stage semantics, and time entries. */}
          <MetricStrip
            className="mt-5"
            items={[
              { key: "complete", value: `${summary.percentComplete}%`, label: "Complete" },
              { key: "open", value: String(summary.open), label: "Open" },
              { key: "done", value: String(summary.completed), label: "Done" },
              ...(summary.overdue > 0
                ? [{ key: "overdue", value: String(summary.overdue), label: "Overdue" }]
                : []),
              ...(summary.blocked > 0
                ? [{ key: "blocked", value: String(summary.blocked), label: "Blocked" }]
                : []),
              { key: "estimated", value: fmt(summary.estimatedMinutes), label: "Estimated" },
              { key: "recorded", value: fmt(summary.recordedMinutes), label: "Recorded" },
              { key: "today", value: fmt(summary.recordedTodayMinutes), label: "Today" },
              { key: "last-7-days", value: fmt(summary.recordedWeekMinutes), label: "Last 7 days" },
            ]}
          />

          {/* Counts by column, so the board's shape is legible before you scan it. */}
          <MetricStrip
            className="mt-2"
            items={summary.byStage.map(({ stage, count }) => ({
              key: stage.id,
              value: String(count),
              label: stage.name,
            }))}
          />
        </>
      }
    >
      <div className="mt-8">
        <Board project={project} todayISO={todayISO} />
      </div>

      {settingsOpen && (
        <ProjectSettings project={project} onClose={() => setSettingsOpen(false)} />
      )}
    </PageShell>
  );
}
